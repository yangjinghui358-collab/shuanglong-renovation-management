import { ArrowUpRight, Clock3, UserRound } from "lucide-react";
import { DataStatusTag } from "../../components/DataStatusTag";
import type { OwnerDashboard } from "@shuanglong/contracts";

const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
const shortTime = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

export function OpportunityList({ leads }: { leads: OwnerDashboard["leads"] }) {
  const ordered = [...leads].sort((a, b) => b.expectedAmount * b.probability - a.expectedAmount * a.probability);
  return (
    <section className="dashboard-card opportunity-card" aria-labelledby="opportunity-title">
      <div className="section-head"><div><span className="section-kicker">SALES PIPELINE</span><h2 id="opportunity-title">成交机会</h2></div><button className="text-action" type="button">客户销售<ArrowUpRight size={15} /></button></div>
      <div className="opportunity-list">
        {ordered.map((lead) => (
          <article className="opportunity-row" key={lead.id}>
            <div className="probability"><strong>{lead.probability}%</strong><span>成交概率</span></div>
            <div className="opportunity-main"><div><strong>{lead.customerName}</strong><span className="stage-chip">{lead.stage}</span><DataStatusTag status={lead.status} label={lead.statusLabel} /></div><p><UserRound size={13} />{lead.ownerName}<Clock3 size={13} />下次跟进 {lead.nextActionAt ? shortTime.format(new Date(lead.nextActionAt)) : "待安排"}</p></div>
            <strong className="opportunity-amount">{currency.format(lead.expectedAmount)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
