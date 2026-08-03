import type { OwnerDashboardInput } from "@shuanglong/contracts";

type DashboardSnapshotFields = Pick<
  OwnerDashboardInput,
  | "metrics"
  | "projects"
  | "materials"
  | "leads"
  | "approvals"
  | "sourceFreshness"
>;

export type DashboardSnapshot = DashboardSnapshotFields & {
  digest: OwnerDashboardInput["digest"] | null;
};

export interface DashboardReader {
  read(): Promise<DashboardSnapshot>;
}
