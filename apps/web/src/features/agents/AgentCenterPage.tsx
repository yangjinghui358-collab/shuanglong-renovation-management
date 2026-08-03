import { useCallback, useEffect, useState } from "react";
import { BellRing, Bot, DraftingCompass, MessagesSquare } from "lucide-react";
import "./agent-center.css";

type AgentKey = "chat_archive" | "todo_reminder" | "owner_alert";
type Run = { id:string; agent_key:AgentKey; status:"queued"|"running"|"succeeded"|"failed"; result?:{submitted?:number}; error?:string; requested_at:string; finished_at?:string };
const agents = [
  { key:"chat_archive" as const, name:"聊天归档 Agent", description:"读取企业微信聊天，提炼事件并分类到工地、采购、客户、财务和库存。", icon:MessagesSquare },
  { key:"todo_reminder" as const, name:"待办提醒 Agent", description:"整理近期未完成、临期和需要继续跟进的工作。", icon:Bot },
  { key:"owner_alert" as const, name:"老板要情 Agent", description:"筛选风险、异常和需要老板重点知晓的重要事项。", icon:BellRing },
  { key:"quotation_future" as const, name:"设计报价 Agent", description:"未来根据户型、客户需求、材料选择和历史报价生成待确认报价草稿。", icon:DraftingCompass, future:true },
];
const statusText={queued:"排队中",running:"运行中",succeeded:"已完成",failed:"运行失败"};

export function AgentCenterPage(){
  const[runs,setRuns]=useState<Run[]>([]);const[error,setError]=useState("");
  const load=useCallback(async()=>{const r=await fetch("/api/agents");if(!r.ok)throw new Error();setRuns((await r.json()).items??[])},[]);
  useEffect(()=>{void load().catch(()=>setError("Agent 状态加载失败"));const timer=setInterval(()=>void load().catch(()=>undefined),5000);return()=>clearInterval(timer)},[load]);
  async function run(key:AgentKey){setError("");const r=await fetch(`/api/agents/${key}/runs`,{method:"POST"});if(!r.ok){setError("Agent 启动失败");return}await load()}
  return <section className="agent-center"><header><span>AGENT CENTER</span><h1>Agent 中心</h1><p>点击运行后只生成待确认事项；由老板确认后才进入正式模块。</p></header>{error&&<p role="alert">{error}</p>}<div className="agent-grid">{agents.map(agent=>{const future="future" in agent&&agent.future;const latest=future?undefined:runs.find(run=>run.agent_key===agent.key);const busy=latest?.status==="queued"||latest?.status==="running";const Icon=agent.icon;return <article key={agent.key}><Icon size={25}/><h2>{agent.name}</h2><p>{agent.description}</p><div>{future?<span className="agent-status">待接入</span>:latest?<><span className={`agent-status agent-status--${latest.status}`}>{statusText[latest.status]}</span>{latest.status==="succeeded"?<small>生成 {latest.result?.submitted??0} 条候选</small>:null}</>:<span className="agent-status">尚未运行</span>}</div><button disabled={future||busy} onClick={()=>!future&&void run(agent.key as AgentKey)}>{future?"后续开发":busy?statusText[latest!.status]:"立即运行"}</button></article>})}</div><section className="agent-history"><h2>最近运行</h2>{runs.slice(0,10).map(run=><div key={run.id}><strong>{agents.find(a=>a.key===run.agent_key)?.name}</strong><span>{statusText[run.status]}</span><time>{new Date(run.requested_at).toLocaleString("zh-CN",{hour12:false})}</time></div>)}{!runs.length?<p>暂无运行记录</p>:null}</section></section>
}
