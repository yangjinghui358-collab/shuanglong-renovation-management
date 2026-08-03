import { AlertTriangle, ArrowUpRight, CalendarDays, UserRound } from "lucide-react";
import { DataStatusTag } from "../../components/DataStatusTag";
import type { OwnerDashboard } from "@shuanglong/contracts";
import { EvidenceDrawer } from "../evidence/EvidenceDrawer";

const riskRank = { high: 3, medium: 2, low: 1, none: 0 };
const riskLabel = { high: "高风险", medium: "需关注", low: "按计划", none: "正常" };

export function ProjectAttentionList({ projects }: { projects: OwnerDashboard["projects"] }) {
  const ordered = [...projects].sort((a, b) => riskRank[b.riskLevel] - riskRank[a.riskLevel] || b.delayDays - a.delayDays);
  return (
    <section className="dashboard-card project-card" aria-labelledby="project-title">
      <div className="section-head"><div><span className="section-kicker">PROJECT PULSE</span><h2 id="project-title">需要关注的工地</h2></div><button type="button" className="text-action">查看全部<ArrowUpRight size={15} /></button></div>
      <div className="project-list">
        {ordered.map((project) => (
          <article className="project-row" key={project.id}>
            <div className={`risk-line risk-line--${project.riskLevel}`} aria-hidden="true" />
            <div className="project-main">
              <div className="project-name-line"><strong>{project.name}</strong><span className={`risk-label risk-label--${project.riskLevel}`}><AlertTriangle size={12} />{riskLabel[project.riskLevel]}</span><DataStatusTag status={project.status} label={project.statusLabel} /></div>
              <p>{project.issue}</p>
              <div className="project-meta"><span><UserRound size={13} />{project.ownerName}</span><span><CalendarDays size={13} />{project.delayDays > 0 ? `已延期 ${project.delayDays} 天` : "今日按计划"}</span>{project.evidence.length > 0 ? <EvidenceDrawer open={false} onClose={() => undefined} title={`${project.name} · 施工依据`} evidence={project.evidence} /> : <span>暂无依据</span>}</div>
            </div>
            <div className="project-progress"><span>{project.stage}</span><strong>{project.progress}%</strong><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div></div>
          </article>
        ))}
      </div>
    </section>
  );
}
