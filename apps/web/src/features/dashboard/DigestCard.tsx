import { ArrowUpRight, Clock3, Sparkles } from "lucide-react";
import { DataStatusTag } from "../../components/DataStatusTag";
import type { OwnerDashboard } from "@shuanglong/contracts";
import { EvidenceDrawer } from "../evidence/EvidenceDrawer";

export function DigestCard({ digest }: { digest: OwnerDashboard["digest"] }) {
  return (
    <section className="digest-card" aria-labelledby="digest-title">
      <div className="digest-icon"><Sparkles size={21} aria-hidden="true" /></div>
      <div className="digest-copy">
        <div className="card-title-row">
          <span className="section-kicker">07:00 DAILY BRIEF</span>
          <DataStatusTag status={digest.status} label={digest.statusLabel} />
        </div>
        <h2 id="digest-title">{digest.title}</h2>
        <p>{digest.summary}</p>
        <div className="digest-meta"><span><Clock3 size={14} /> 今日经营重点 · {digest.evidence.length} 条来源</span>{digest.evidence.length > 0 ? <EvidenceDrawer open={false} onClose={() => undefined} title="AI 简报依据" evidence={digest.evidence} /> : null}</div>
      </div>
      <button className="text-action" type="button">查看今日重点<ArrowUpRight size={15} /></button>
    </section>
  );
}
