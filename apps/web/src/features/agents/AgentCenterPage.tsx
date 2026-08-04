import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BellRing, Bot, CheckCircle2, ChevronDown, ClipboardList, Clock3, Copy, DraftingCompass, MessagesSquare, Sparkles, UsersRound } from "lucide-react";
import "./agent-center.css";

type AgentKey = "chat_archive" | "todo_reminder" | "owner_alert";
type Run = { id:string; agent_key:AgentKey; status:"queued"|"running"|"succeeded"|"failed"; result?:{submitted?:number}; error?:string; requested_at:string; finished_at?:string };
type AgentProfile = { key:AgentKey|"quotation_future"; employeeName:string; role:string; number:string; description:string; avatar:string; icon:typeof Bot; minutesPerItem:number; future?:boolean };

const agents:AgentProfile[] = [
  { key:"chat_archive", employeeName:"小龙", role:"聊天信息归档助理", number:"数字员工 01", description:"每天整理企业微信聊天，把客户、工地、采购、财务和库存信息分门别类。", avatar:"龙", icon:MessagesSquare, minutesPerItem:3 },
  { key:"todo_reminder", employeeName:"小双", role:"事项督办助理", number:"数字员工 02", description:"盯住未完成、临期和需要继续跟进的工作，整理成老板可确认的待办清单。", avatar:"双", icon:CheckCircle2, minutesPerItem:2 },
  { key:"owner_alert", employeeName:"安安", role:"老板要情助理", number:"数字员工 03", description:"从风险和异常中筛选必须由老板知晓的事项，给出重点和下一步建议。", avatar:"安", icon:BellRing, minutesPerItem:5 },
  { key:"quotation_future", employeeName:"小筑", role:"设计报价助理", number:"数字员工 04", description:"根据户型、客户需求、材料选择和历史报价生成待确认的报价草稿。", avatar:"筑", icon:DraftingCompass, minutesPerItem:8, future:true },
];
const statusText={queued:"等待接单",running:"正在工作",succeeded:"工作完成",failed:"需要重试"};
const chatTemplates=[
  {tag:"客户建档",description:"建立客户销售档案",content:"【客户建档】\n客户姓名：\n客户微信昵称：\n客户电话：\n客户来源：\n小区房号：\n户型面积：\n房屋现状：\n装修类型：\n预算范围：\n意向风格：\n核心需求：\n负责人：\n当前阶段：\n下次跟进："},
  {tag:"施工进度",description:"更新工地阶段和完成比例",content:"【施工进度】\n工地：\n当前阶段：\n施工位置：\n今天完成：\n当前进度：\n明天计划：\n现场负责人：\n更新时间："},
  {tag:"工地待办",description:"明确负责人和完成时间",content:"【工地待办】\n工地：\n待办事项：\n负责人：\n要求完成时间：\n优先级：\n完成标准："},
  {tag:"问题风险",description:"需要处理或老板决策的异常",content:"【问题风险】\n工地：\n问题位置：\n问题描述：\n影响：\n处理负责人：\n要求解决时间：\n建议方案：\n是否需要老板决定："},
  {tag:"材料采购",description:"材料需求、供应商和到货计划",content:"【材料采购】\n工地：\n材料名称：\n品牌型号：\n规格数量：\n需求时间：\n预算：\n申请人：\n供应商："},
  {tag:"到货验收",description:"记录数量和质量异常",content:"【到货验收】\n工地：\n材料名称：\n实际数量：\n到货时间：\n验收结果：\n验收人：\n异常说明："},
  {tag:"阶段验收",description:"长期保存验收与整改结果",content:"【阶段验收】\n工地：\n验收阶段：\n验收位置：\n验收结果：\n验收人：\n客户是否确认：\n整改事项：\n复验时间："},
  {tag:"客户变更",description:"记录客户要求及价格工期影响",content:"【客户变更】\n客户：\n工地：\n变更内容：\n提出时间：\n是否影响价格：\n预计增减金额：\n是否影响工期：\n客户是否确认：\n负责人："},
  {tag:"财务记录",description:"仅在内部管理群使用",content:"【财务记录】\n客户或工地：\n款项类型：\n应收或应付：\n金额：\n付款节点：\n到期时间：\n实际付款状态：\n经办人："},
];

export function AgentCenterPage(){
  const[runs,setRuns]=useState<Run[]>([]);const[error,setError]=useState("");const[templatesOpen,setTemplatesOpen]=useState(false);const[copied,setCopied]=useState("");
  const load=useCallback(async()=>{const r=await fetch("/api/agents");if(!r.ok)throw new Error();setRuns((await r.json()).items??[])},[]);
  useEffect(()=>{void load().catch(()=>setError("数字员工状态加载失败"));const timer=setInterval(()=>void load().catch(()=>undefined),5000);return()=>clearInterval(timer)},[load]);
  async function run(key:AgentKey){setError("");const r=await fetch(`/api/agents/${key}/runs`,{method:"POST"});if(!r.ok){setError("任务安排失败，请稍后重试");return}await load()}
  async function copyTemplate(tag:string,content:string){try{await navigator.clipboard.writeText(content);setCopied(tag);setTimeout(()=>setCopied(""),1800)}catch{setError("模板复制失败，请手动选择文字复制")}}
  const completed=agents.filter(agent=>!agent.future).map(agent=>({agent,run:runs.find(run=>run.agent_key===agent.key&&run.status==="succeeded")}));
  const handled=completed.reduce((sum,item)=>sum+(item.run?.result?.submitted??0),0);
  const savedMinutes=completed.reduce((sum,item)=>sum+(item.run?.result?.submitted??0)*item.agent.minutesPerItem,0);

  return <section className="agent-center">
    <header className="agent-center__hero"><div><span>DIGITAL EMPLOYEE TEAM</span><h1>我的数字员工</h1><p>像安排助理一样点击派活。数字员工先整理信息，所有结果仍由老板确认后才进入正式模块。</p></div><div className="agent-team-mark"><UsersRound size={24}/><strong>3 名</strong><small>数字员工在岗</small></div></header>
    <section className="agent-summary" aria-label="数字员工工作概览"><div><Bot size={19}/><span>在岗员工</span><strong>3</strong><small>名</small></div><div><CheckCircle2 size={19}/><span>本轮整理</span><strong>{handled}</strong><small>项候选</small></div><div><Clock3 size={19}/><span>预计节省人工</span><strong>{formatMinutes(savedMinutes)}</strong><small>按处理量估算</small></div></section>
    <section className="chat-standard"><header><div><ClipboardList size={20}/><span><strong>小龙群聊信息规范</strong><small>群名代表小区工地；重要事项加标签，固定字段越完整，提取越准确。</small></span></div><button type="button" onClick={()=>setTemplatesOpen(value=>!value)}>群聊模板 <ChevronDown className={templatesOpen?"is-open":""} size={15}/></button></header>{templatesOpen?<><div className="chat-standard__rules"><span>1. 群名固定代表工地</span><span>2. 一条消息只说一类事情</span><span>3. 图片和语音补一句文字说明</span></div><div className="chat-template-grid">{chatTemplates.map(template=><article key={template.tag}><header><div><strong>【{template.tag}】</strong><small>{template.description}</small></div><button type="button" onClick={()=>void copyTemplate(template.tag,template.content)}><Copy size={13}/>{copied===template.tag?"已复制":"复制模板"}</button></header><pre>{template.content}</pre></article>)}</div></>:null}</section>
    {error&&<p role="alert" className="agent-error">{error}</p>}
    <div className="agent-grid">{agents.map(agent=>{
      const latest=agent.future?undefined:runs.find(run=>run.agent_key===agent.key);const successful=agent.future?undefined:runs.find(run=>run.agent_key===agent.key&&run.status==="succeeded");const busy=latest?.status==="queued"||latest?.status==="running";const Icon=agent.icon;const count=successful?.result?.submitted??0;const saved=count*agent.minutesPerItem;
      return <article className={`employee-card${agent.future?" employee-card--future":""}`} key={agent.key}>
        <div className="employee-card__top"><div className="employee-avatar" aria-hidden="true"><span>{agent.avatar}</span><i className={busy?"is-busy":agent.future?"is-future":"is-online"}/></div><div><small>{agent.number}</small><h2>{agent.employeeName}</h2><p>{agent.role}</p></div><Icon className="employee-role-icon" size={22}/></div>
        <p className="employee-description">{agent.description}</p>
        <div className="employee-result">{agent.future?<><Sparkles size={16}/><span>岗位已预留，等待入职</span></>:latest?<><span className={`agent-status agent-status--${latest.status}`}>{statusText[latest.status]}</span>{successful?<small>最近整理 {count} 项 · 预计节省 {formatMinutes(saved)}</small>:null}</>:<><span className="agent-status">今日待命</span><small>尚未安排任务</small></>}</div>
        <button disabled={agent.future||busy} onClick={()=>!agent.future&&void run(agent.key as AgentKey)}><span>{agent.future?"待接入":busy?statusText[latest!.status]:"安排工作"}</span>{!agent.future&&!busy?<ArrowRight size={16}/>:null}</button>
      </article>})}</div>
    <section className="agent-history"><header><div><span>WORK LOG</span><h2>数字员工工作记录</h2></div><small>结果仅进入待确认区</small></header>{runs.slice(0,10).map(run=>{const profile=agents.find(agent=>agent.key===run.agent_key);return <div key={run.id}><span className="history-avatar">{profile?.avatar}</span><strong>{profile?.employeeName}<small>{profile?.role}</small></strong><span className={`agent-status agent-status--${run.status}`}>{statusText[run.status]}</span><time>{new Date(run.requested_at).toLocaleString("zh-CN",{hour12:false})}</time></div>})}{!runs.length?<p>数字员工还没有工作记录</p>:null}</section>
    <p className="agent-estimate-note">“预计节省人工”按每条信息的基础整理时间估算，仅用于体现辅助效率，不计入正式财务或绩效数据。</p>
  </section>
}

function formatMinutes(minutes:number){if(minutes<60)return `${minutes} 分钟`;const hours=Math.floor(minutes/60);const rest=minutes%60;return rest?`${hours} 小时 ${rest} 分`:`${hours} 小时`}
