import type { DataStatus } from "@shuanglong/contracts";

const labels: Record<DataStatus, string> = {
  real: "真实数据",
  demo: "演示数据",
  ai_inferred: "AI 推测",
  pending_confirmation: "待确认",
  confirmed: "已确认",
  rejected: "已驳回",
  archived: "已归档",
};

export function DataStatusTag({ status, label }: { status: DataStatus; label?: string }) {
  return (
    <span className={`data-status data-status--${status}`} data-status={status}>
      <span className="data-status__dot" aria-hidden="true" />
      {label ?? labels[status]}
    </span>
  );
}
