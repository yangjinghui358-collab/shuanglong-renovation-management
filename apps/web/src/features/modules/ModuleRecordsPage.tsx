import { useEffect, useState } from "react";
import "./module-records.css";

type ModuleName = "projects" | "procurement" | "crm";
type ModuleRecord = { id: string; candidate_id: string; kind: string; payload: Record<string, unknown>; created_at: string };

const moduleCopy: Record<ModuleName, { eyebrow: string; title: string; empty: string }> = {
  projects: { eyebrow: "PROJECT RECORDS", title: "工地管理", empty: "暂无已确认的工地信息" },
  procurement: { eyebrow: "PROCUREMENT RECORDS", title: "主材采购", empty: "暂无已确认的采购信息" },
  crm: { eyebrow: "CUSTOMER RECORDS", title: "客户销售", empty: "暂无已确认的客户信息" },
};

export function ModuleRecordsPage({ module }: { module: ModuleName }) {
  const [items, setItems] = useState<ModuleRecord[]>([]);
  const [error, setError] = useState("");
  const copy = moduleCopy[module];
  useEffect(() => {
    fetch(`/api/modules/${module}/records`)
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(body => setItems(body.items ?? []))
      .catch(() => setError("正式记录暂时无法加载"));
  }, [module]);

  return <section className="module-records">
    <header><span>{copy.eyebrow}</span><h1>{copy.title}</h1><p>仅展示经老板确认后写入的正式信息。</p></header>
    {error && <p role="alert">{error}</p>}
    <div className="module-records__list">
      {items.map(item => <article key={item.id}>
        <div><strong>{String(item.payload.title || kindLabel(item.kind))}</strong><span>已确认</span></div>
        {item.payload.projectName ? <p>{String(item.payload.projectName)}</p> : null}
        <dl>{visibleEntries(item.payload).map(([key, value]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd>{displayValue(value)}</dd></div>)}</dl>
        <small>{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</small>
      </article>)}
      {!items.length && !error ? <div className="module-records__empty">{copy.empty}</div> : null}
    </div>
  </section>;
}

function visibleEntries(payload: Record<string, unknown>) {
  return Object.entries(payload).filter(([key, value]) => !["title","projectName","sourceMessageIds","sourceCount","agentReasoning","extractedAt"].includes(key) && value !== "" && value !== null && value !== undefined);
}
function displayValue(value: unknown) { return Array.isArray(value) ? value.join("、") : typeof value === "object" ? JSON.stringify(value) : String(value); }
function kindLabel(kind: string) { return ({ construction_progress:"施工进度",event:"项目事项",todo:"待办",risk:"风险",acceptance:"验收",digest:"项目简报",material:"材料事项",customer_requirement:"客户需求" } as Record<string,string>)[kind] || kind; }
function fieldLabel(key: string) { return ({ summary:"摘要",owner:"负责人",status:"状态",event_date:"发生日期",due_date:"截止日期",phase:"施工阶段",location:"位置",progress:"进度",risk_level:"风险等级",next_action:"下一步" } as Record<string,string>)[key] || key; }
