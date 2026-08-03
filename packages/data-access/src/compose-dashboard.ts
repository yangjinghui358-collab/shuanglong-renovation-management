import {
  OwnerDashboardSchema,
  type OwnerDashboard,
  type OwnerDashboardInput,
} from "@shuanglong/contracts";

import type { DashboardReader, DashboardSnapshot } from "./ports/dashboard-reader";

type SnapshotArrayKey = "projects" | "materials" | "leads" | "approvals";
type StatusPair<T> = T extends { status: string; statusLabel: string }
  ? Pick<T, "status" | "statusLabel">
  : never;
type MetricStatus = StatusPair<OwnerDashboard["metrics"][number]>;

function chooseDomain<K extends SnapshotArrayKey>(
  key: K,
  real: DashboardSnapshot,
  demo: DashboardSnapshot,
): DashboardSnapshot[K] {
  return (real[key].length > 0 ? real[key] : demo[key]) as DashboardSnapshot[K];
}

function metricStatus(
  records: MetricStatus[],
  fallback: MetricStatus | OwnerDashboard["sourceFreshness"],
): MetricStatus {
  const priority: MetricStatus["status"][] = [
    "pending_confirmation",
    "ai_inferred",
    "demo",
    "real",
    "confirmed",
    "rejected",
    "archived",
  ];
  for (const status of priority) {
    const record = records.find((item) => item.status === status);
    if (record) return record;
  }
  if (fallback.statusLabel === "真实数据暂不可用") {
    return { status: "demo", statusLabel: "演示数据" };
  }
  return fallback;
}

function projectIdentityStatus(
  projects: MetricStatus[],
  sourceFreshness: OwnerDashboard["sourceFreshness"],
): MetricStatus {
  const demoProject = projects.find((item) => item.status === "demo");
  return demoProject ?? metricStatus([], sourceFreshness);
}

function composeMetrics(
  domains: Pick<OwnerDashboardInput, "projects" | "materials" | "leads" | "approvals">,
  sourceFreshness: OwnerDashboard["sourceFreshness"],
): OwnerDashboard["metrics"] {
  const projectStatus = projectIdentityStatus(
    domains.projects,
    sourceFreshness,
  );
  const riskStatus = metricStatus(
    domains.projects.filter((item) => item.riskLevel !== "none"),
    projectStatus,
  );
  const materialStatus = metricStatus(domains.materials, sourceFreshness);
  const leadStatus = metricStatus(domains.leads, sourceFreshness);
  const approvalStatus = metricStatus(domains.approvals, sourceFreshness);

  return [
    {
      key: "active_projects",
      label: "在建工地",
      value: `${domains.projects.length} 个`,
      ...projectStatus,
    },
    {
      key: "at_risk_projects",
      label: "风险工地",
      value: `${domains.projects.filter((item) => item.riskLevel !== "none").length} 个`,
      ...riskStatus,
    },
    {
      key: "material_arrivals",
      label: "材料事项",
      value: `${domains.materials.length} 项`,
      ...materialStatus,
    },
    {
      key: "high_intent_leads",
      label: "高意向客户",
      value: `${domains.leads.filter((item) => item.probability >= 70).length} 位`,
      ...leadStatus,
    },
    {
      key: "pending_approvals",
      label: "老板待确认",
      value: `${domains.approvals.length} 项`,
      ...approvalStatus,
    },
  ];
}

export async function composeOwnerDashboard(
  realReader: DashboardReader,
  demoReader: DashboardReader,
  now: Date,
): Promise<OwnerDashboard> {
  const demo = await demoReader.read();
  if (!demo.digest) {
    throw new Error("Demo dashboard reader must provide a digest");
  }

  let real: DashboardSnapshot;
  try {
    real = await realReader.read();
  } catch (error) {
    throw new Error("正式数据源暂不可用", { cause: error });
  }

  const domains = {
    projects: chooseDomain("projects", real, demo),
    materials: chooseDomain("materials", real, demo),
    leads: chooseDomain("leads", real, demo),
    approvals: chooseDomain("approvals", real, demo),
  };
  const dashboard = {
    generatedAt: now.toISOString(),
    sourceFreshness: real.sourceFreshness,
    digest:
      real.digest && real.digest.status !== "demo" ? real.digest : demo.digest,
    ...domains,
    metrics: composeMetrics(domains, real.sourceFreshness),
  };

  return OwnerDashboardSchema.parse(dashboard);
}
