import { AlertTriangle, Bot, CheckCircle2, ChevronDown, Clock3, FileText, HardHat, ListTodo, ShieldAlert, UsersRound, XCircle } from "lucide-react";
import { useEffect,useMemo,useState } from "react";
import "./review.css";

type Candidate={id:string;module:string;kind:string;payload:Record<string,unknown>;confidence:number;status:string;version:number;createdAt:string};
const moduleLabels:Record<string,string>={projects:"工地管理",procurement:"主材采购",crm:"客户销售",finance:"财务中心",inventory:"库存管理",tasks:"最近待办",alerts:"老板要情"};
const kindLabels:Record<string,string>={digest:"项目简报",construction_progress:"施工进度",todo:"工地待办",event:"工地事件",acceptance:"验收事项",risk:"问题风险",material:"材料事项",procurement:"采购事项",customer_requirement:"客户需求",financial_record:"财务记录",inventory_record:"库存记录",todo_reminder:"待办提醒",owner_alert:"重要风险"};
const fieldLabels:Record<string,string>={summary:"事件摘要",details:"详细说明",description:"问题说明",owner:"负责人",status:"当前状态",event_date:"发生日期",eventDate:"发生日期",due_date:"截止日期",dueDate:"截止日期",dueAt:"要求时间",phase:"施工阶段",location:"施工位置",progress:"完成进度",risk_level:"风险等级",riskLevel:"风险等级",recommendation:"处理建议",priority:"优先级",next_action:"下一步",nextAction:"下一步",planned_start:"计划开始",planned_end:"计划结束"};
const hiddenFields=new Set(["title","projectName","sourceMessageIds","sourceCount","agentReasoning","extractedAt","groupId"]);

export function AgentReviewPage(){
  const[items,setItems]=useState<Candidate[]>([]);const[error,setError]=useState("");const[filter,setFilter]=useState("all");const[working,setWorking]=useState<string|null>(null);
  async function load(){const r=await fetch("/api/review/candidates");if(!r.ok)throw new Error();const next=(await r.json()).items??[];setItems(next);window.dispatchEvent(new CustomEvent("review-count-changed",{detail:next.length}))}
  useEffect(()=>{load().catch(()=>setError("待确认事项加载失败"))},[]);
  const filtered=useMemo(()=>filter==="all"?items:items.filter(item=>item.module===filter),[items,filter]);
  const filters=[["all","全部"],...[...new Set(items.map(item=>item.module))].map(module=>[module,moduleLabels[module]??module])];
  async function decide(item:Candidate,decision:"confirm"|"reject"){
    setWorking(item.id);setError("");const body=decision==="confirm"?{version:item.version,idempotencyKey:crypto.randomUUID()}:{version:item.version,reason:"老板人工驳回"};
    const r=await fetch(`/api/review/candidates/${item.id}/${decision}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});setWorking(null);if(!r.ok){setError("操作失败，候选状态可能已变化");return}await load()
  }
  return <section className="review-page">
    <header><div><span>AGENT REVIEW</span><h1>AI 待确认</h1><p>数字员工整理业务事件；你逐条确认后，系统才写入对应正式模块。</p></div><div className="review-total"><Bot size={18}/><strong>{items.length}</strong><small>项等待你确认</small></div></header>
    <div className="review-explain"><AlertTriangle size={17}/><p><strong>请核对事件是否准确。</strong>确认后会写入卡片标明的模块；驳回后不会影响正式数据。</p></div>
    <nav className="review-filters" aria-label="待确认分类">{filters.map(([key,label])=><button key={key} className={filter===key?"is-active":""} onClick={()=>setFilter(key)}>{label}<small>{key==="all"?items.length:items.filter(item=>item.module===key).length}</small></button>)}</nav>
    {error&&<p role="alert" className="review-error">{error}</p>}
    <div className="review-list">{filtered.map(item=><ReviewCard key={item.id} item={item} busy={working===item.id} onDecision={decision=>void decide(item,decision)}/>)}{!filtered.length&&!error&&<div className="empty"><CheckCircle2 size={30}/><h2>当前分类没有待确认事项</h2><p>数字员工整理出新事件后会显示在这里。</p></div>}</div>
  </section>
}

function ReviewCard({item,busy,onDecision}:{item:Candidate;busy:boolean;onDecision:(decision:"confirm"|"reject")=>void}){
  const payload=item.payload;const title=text(payload.title)||kindLabels[item.kind]||"待确认事件";const projectName=text(payload.projectName);const summary=text(payload.summary)||text(payload.description)||text(payload.details);const fields=Object.entries(payload).filter(([key,value])=>!hiddenFields.has(key)&&!["summary","description","details"].includes(key)&&value!==""&&value!==null&&value!==undefined).slice(0,8);const sourceCount=Number(payload.sourceCount)||(Array.isArray(payload.sourceMessageIds)?payload.sourceMessageIds.length:0);const reasoning=text(payload.agentReasoning);const target=moduleLabels[item.module]??item.module;
  return <article className="review-card">
    <header><div className={`review-kind review-kind--${item.module}`}>{iconFor(item.kind)}<span>{kindLabels[item.kind]??item.kind}</span></div><div className="review-confidence"><i style={{width:`${Math.round(item.confidence*100)}%`}}/><span>AI 可信度 {Math.round(item.confidence*100)}%</span></div></header>
    <div className="review-title"><div><small>{projectName||"公司经营事项"}</small><h2>{title}</h2></div><span className="review-target">确认后写入：<strong>{target}</strong></span></div>
    {summary?<p className="review-summary">{summary}</p>:null}
    {fields.length?<dl className="review-fields">{fields.map(([key,value])=><div key={key}><dt>{fieldLabels[key]??humanizeKey(key)}</dt><dd>{displayValue(key,value)}</dd></div>)}</dl>:null}
    <div className="review-meta"><span><Clock3 size={14}/>{formatDate(item.createdAt)}</span><span><FileText size={14}/>{sourceCount} 条聊天证据</span></div>
    {reasoning?<details className="review-reasoning"><summary>查看小龙的判断依据 <ChevronDown size={14}/></summary><p>{reasoning}</p></details>:null}
    <footer><button disabled={busy} onClick={()=>onDecision("reject")}><XCircle size={16}/>不准确，驳回</button><button disabled={busy} className="confirm" onClick={()=>onDecision("confirm")}><CheckCircle2 size={16}/>{busy?"正在处理…":`确认并写入${target}`}</button></footer>
  </article>
}

function iconFor(kind:string){if(kind.includes("progress")||kind==="event"||kind==="digest")return <HardHat size={16}/>;if(kind.includes("todo"))return <ListTodo size={16}/>;if(kind.includes("risk")||kind==="owner_alert")return <ShieldAlert size={16}/>;if(kind.includes("customer"))return <UsersRound size={16}/>;return <FileText size={16}/>}
function text(value:unknown){return typeof value==="string"?value.trim():""}
function displayValue(key:string,value:unknown){if(typeof value==="number"&&key.toLowerCase().includes("progress"))return `${value}%`;if(Array.isArray(value))return value.join("、");if(typeof value==="object")return JSON.stringify(value);return String(value)}
function humanizeKey(key:string){return key.replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2")}
function formatDate(value:string){return new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value))}
