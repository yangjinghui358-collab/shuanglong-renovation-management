import type { OwnerDashboard } from "@shuanglong/contracts";
import { describe, expect, it } from "vitest";

import { composeOwnerDashboard } from "./compose-dashboard";
import type { DashboardReader, DashboardSnapshot } from "./ports/dashboard-reader";

const fixedNow = new Date("2026-08-03T07:00:00+08:00");

function reader(snapshot: DashboardSnapshot): DashboardReader {
  return { async read() { return snapshot; } };
}

const realSnapshot: DashboardSnapshot = {
  sourceFreshness: {
    lastMessageAt: "2026-08-02T22:40:00+08:00",
    status: "real",
    statusLabel: "真实数据",
  },
  digest: {
    title: "真实简报",
    summary: "合成测试摘要",
    evidence: [],
    status: "real",
    statusLabel: "真实数据",
  },
  metrics: [],
  projects: [
    {
      id: "project-1",
      name: "测试工地甲",
      stage: "防水",
      progress: 62,
      riskLevel: "medium",
      evidence: [],
      status: "real",
      statusLabel: "真实数据",
    },
  ],
  materials: [],
  leads: [],
  approvals: [],
};

const demoSnapshot: DashboardSnapshot = {
  sourceFreshness: {
    lastMessageAt: null,
    status: "demo",
    statusLabel: "演示数据",
  },
  digest: {
    title: "演示简报",
    summary: "演示摘要",
    evidence: [],
    status: "demo",
    statusLabel: "演示数据",
  },
  metrics: [],
  projects: [],
  materials: [
    {
      id: "demo-material-1",
      projectName: "演示工地 A",
      materialName: "演示材料",
      state: "待验收",
      expectedAt: null,
      status: "demo",
      statusLabel: "演示数据",
    },
  ],
  leads: [
    {
      id: "demo-lead-1",
      customerName: "演示客户 A",
      stage: "报价",
      probability: 70,
      nextActionAt: null,
      status: "demo",
      statusLabel: "演示数据",
    },
  ],
  approvals: [
    {
      id: "demo-approval-1",
      type: "报价",
      title: "演示报价待确认",
      amount: 100_000,
      status: "demo",
      statusLabel: "演示数据",
    },
  ],
};

describe("composeOwnerDashboard", () => {
  it("keeps real project data and fills only unavailable domains with demo records", async () => {
    const result = await composeOwnerDashboard(
      reader(realSnapshot),
      reader(demoSnapshot),
      fixedNow,
    );

    expect(result.projects[0]?.status).toBe("real");
    expect(result.materials[0]?.status).toBe("demo");
    expect(result.metrics.find((item) => item.key === "active_projects")).toMatchObject({
      status: "real",
      value: "1 个",
    });
  });

  it("fails closed when the formal data source is unavailable", async () => {
    const unavailable: DashboardReader = {
      async read() { throw new Error("database unavailable"); },
    };

    await expect(composeOwnerDashboard(
      unavailable,
      reader(demoSnapshot),
      fixedNow,
    )).rejects.toThrow("正式数据源暂不可用");
  });

  it("uses the demo digest when the real source has no digest row", async () => {
    const withoutDigest: DashboardSnapshot = {
      ...realSnapshot,
      digest: null,
    };

    const result = await composeOwnerDashboard(
      reader(withoutDigest),
      reader(demoSnapshot),
      fixedNow,
    );

    expect(result.digest).toMatchObject({
      title: "演示简报",
      status: "demo",
      statusLabel: "演示数据",
    });
  });

  it("keeps an AI-inferred digest read from the real source", async () => {
    const withAiDigest: DashboardSnapshot = {
      ...realSnapshot,
      digest: {
        ...realSnapshot.digest!,
        status: "ai_inferred",
        statusLabel: "AI 推测",
      },
    };

    const result = await composeOwnerDashboard(
      reader(withAiDigest),
      reader(demoSnapshot),
      fixedNow,
    );

    expect(result.digest).toMatchObject({
      title: "真实简报",
      status: "ai_inferred",
      statusLabel: "AI 推测",
    });
  });

  it.each([false, true])(
    "labels identity and risk metrics independently of project row order (reversed=%s)",
    async (reversed) => {
      const plainProject = realSnapshot.projects[0]!;
      const pendingRiskProject: DashboardSnapshot["projects"][number] = {
        ...plainProject,
        id: "project-2",
        name: "测试工地乙",
        riskLevel: "high",
        status: "pending_confirmation",
        statusLabel: "待确认",
      };
      const projects = reversed
        ? [pendingRiskProject, plainProject]
        : [plainProject, pendingRiskProject];

      const result = await composeOwnerDashboard(
        reader({ ...realSnapshot, projects }),
        reader(demoSnapshot),
        fixedNow,
      );

      expect(
        result.metrics.find((item) => item.key === "active_projects"),
      ).toMatchObject({ value: "2 个", status: "real", statusLabel: "真实数据" });
      expect(
        result.metrics.find((item) => item.key === "at_risk_projects"),
      ).toMatchObject({
        value: "2 个",
        status: "pending_confirmation",
        statusLabel: "待确认",
      });
    },
  );
});
