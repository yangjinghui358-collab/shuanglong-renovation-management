import { RefreshCw } from "lucide-react";
import { ApprovalQueue } from "./ApprovalQueue";
import { DigestCard } from "./DigestCard";
import { MetricGrid } from "./MetricGrid";
import { OpportunityList } from "./OpportunityList";
import { ProjectAttentionList } from "./ProjectAttentionList";
import { useOwnerDashboard } from "./useOwnerDashboard";
import "./dashboard.css";

const freshness = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

function formatFreshness(value: string) {
  return freshness.format(new Date(value)).replace("/", "月").replace(" ", "日 ");
}

export function OwnerDashboardPage() {
  const { data, error, isPending, isFetching, refetch } = useOwnerDashboard();

  if (isPending) return <DashboardSkeleton />;
  if (error || !data) {
    return <section className="dashboard-error"><span>DATA UNAVAILABLE</span><h1>{error instanceof Error ? error.message : "经营数据暂时无法加载，请稍后重试"}</h1><p>已有业务数据不会受影响，请检查本地 API 后重新加载。</p><button type="button" onClick={() => void refetch()}><RefreshCw size={16} />重新加载</button></section>;
  }

  const sourceUnavailable = data.sourceFreshness.statusLabel === "真实数据暂不可用";
  const actionableHighRiskProjects = data.projects.filter(
    (project) => project.status !== "demo" && project.riskLevel === "high",
  );
  const actionableApprovals = data.approvals.filter(
    (approval) => approval.status !== "demo",
  );

  return (
    <div className="owner-dashboard">
      <header className="page-heading">
        <div><span className="section-kicker">EXECUTIVE OVERVIEW</span><h1>经营总览</h1><p>早上好，今日优先处理 <strong>{actionableHighRiskProjects.length} 个高风险工地</strong>和 <strong>{actionableApprovals.length} 项待确认</strong>。</p></div>
        <div className="freshness"><span className={isFetching ? "is-refreshing" : ""}><RefreshCw size={14} />{isFetching ? "正在刷新" : sourceUnavailable ? "真实数据暂不可用" : "数据已同步"}</span><small>最后消息 {data.sourceFreshness.lastMessageAt ? formatFreshness(data.sourceFreshness.lastMessageAt) : "暂无"}</small></div>
      </header>
      <DigestCard digest={data.digest} />
      <MetricGrid metrics={data.metrics} />
      <div className="dashboard-columns"><ProjectAttentionList projects={data.projects} /><ApprovalQueue approvals={data.approvals} /></div>
      <OpportunityList leads={data.leads} />
    </div>
  );
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-label="正在加载经营数据"><span /><span /><span /><span /></div>;
}
