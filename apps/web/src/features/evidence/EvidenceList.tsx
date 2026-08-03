import { Clock3, FileText, UserRound } from "lucide-react";
import type { DashboardEvidence } from "@shuanglong/contracts";

const sourceLabels: Record<DashboardEvidence["sourceType"], string> = {
  message: "会话摘要",
  digest: "经营简报",
  todo: "业务待办",
  risk: "风险记录",
  event: "项目事件",
  demo: "演示来源",
};

const dateTime = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});

export function EvidenceList({ evidence }: { evidence: DashboardEvidence[] }) {
  if (evidence.length === 0) return <p className="evidence-empty">当前摘要暂无可展开依据。</p>;

  return (
    <div className="evidence-list">
      {evidence.map((item) => (
        <article className="evidence-item" key={item.id}>
          <div className="evidence-item__top"><span><FileText size={14} />{sourceLabels[item.sourceType]}</span><span className="evidence-sequence">来源 {String(evidence.indexOf(item) + 1).padStart(2, "0")}</span></div>
          <blockquote>{item.excerpt}</blockquote>
          <div className="evidence-item__meta"><span><UserRound size={13} />{item.senderName ?? "来源未标注"}</span><span><Clock3 size={13} />{item.occurredAt ? dateTime.format(new Date(item.occurredAt)) : "时间未记录"}</span></div>
        </article>
      ))}
    </div>
  );
}
