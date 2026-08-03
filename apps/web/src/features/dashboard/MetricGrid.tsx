import { Activity, CircleDollarSign, HardHat, PackageCheck, TimerOff, UsersRound } from "lucide-react";
import { DataStatusTag } from "../../components/DataStatusTag";
import type { OwnerDashboard } from "@shuanglong/contracts";

const icons = [HardHat, Activity, TimerOff, PackageCheck, UsersRound, CircleDollarSign];

export function MetricGrid({ metrics }: { metrics: OwnerDashboard["metrics"] }) {
  return (
    <section className="metric-grid" aria-label="核心经营指标">
      {metrics.map((metric, index) => {
        const Icon = icons[index % icons.length];
        return (
          <article className="metric-card" key={metric.key}>
            <div className="metric-top"><span className="metric-icon"><Icon size={17} /></span><DataStatusTag status={metric.status} label={metric.statusLabel} /></div>
            <span className="metric-label">{metric.label}</span>
            <strong className="metric-value">{metric.value}</strong>
            <span className="metric-trend">{metric.trend ?? "—"}</span>
          </article>
        );
      })}
    </section>
  );
}
