import { ArrowRight, FileCheck2 } from "lucide-react";
import { DataStatusTag } from "../../components/DataStatusTag";
import type { OwnerDashboard } from "@shuanglong/contracts";

const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });

export function ApprovalQueue({ approvals }: { approvals: OwnerDashboard["approvals"] }) {
  const actionableCount = approvals.filter((approval) => approval.status !== "demo").length;

  return (
    <section className="dashboard-card approval-card" aria-labelledby="approval-title">
      <div className="section-head"><div><span className="section-kicker">OWNER ACTIONS</span><h2 id="approval-title">老板待确认</h2></div><span className="count-pill">{actionableCount}</span></div>
      <div className="approval-list">
        {approvals.map((approval) => (
          <article className="approval-row" key={approval.id}>
            <span className="approval-icon"><FileCheck2 size={17} /></span>
            <div><span className="item-type">{approval.type}</span><strong>{approval.title}</strong><DataStatusTag status={approval.status} label={approval.statusLabel} /></div>
            <div className="approval-value"><strong>{approval.amount === null ? "待协调" : currency.format(approval.amount)}</strong>{approval.status === "demo" ? <span>待正式录入</span> : <button type="button" aria-label={`处理 ${approval.title}`}><ArrowRight size={16} /></button>}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
