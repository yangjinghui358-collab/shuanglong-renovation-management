const schemas = {
  todos: {
    f4nJit:{title:'待办事项',type:'text'}, fAhcMD:{title:'项目名称',type:'text'}, fB4NED:{title:'详细要求',type:'text'},
    fJPLiD:{title:'状态',type:'single_select',enum:['待确认']}, fPA07s:{title:'优先级',type:'single_select',enum:['高']},
    fUr7k5:{title:'负责人',type:'text'}, fbcj6D:{title:'截止时间',type:'date_time'}, fcGyYR:{title:'发起人',type:'text'},
    fcIPjZ:{title:'会话名称',type:'text'}, fdKIHV:{title:'原始聊天',type:'text'}, fpISiW:{title:'来源消息ID',type:'text'},
    fpbJ8O:{title:'AI可信度',type:'number'}, fsS35Q:{title:'AI判断依据',type:'text'}, fvu5qu:{title:'创建时间',type:'date_time'},
    fzx9LN:{title:'最近同步时间',type:'date_time'}
  },
  events: {
    f7oM24:{title:'事件标题',type:'text'}, f96AyS:{title:'项目名称',type:'text'}, fvRfh4:{title:'智能总结',type:'text'},
    fFMjcp:{title:'客户名称',type:'text'}, fNj1zT:{title:'事件类型',type:'single_select',enum:['客户需求']},
    fbjVyr:{title:'事件详情',type:'text'}, fcXfpP:{title:'涉及人员',type:'text'}, fchqHR:{title:'发生时间',type:'date_time'},
    fdExIs:{title:'当前结论',type:'text'}, fdaGZ9:{title:'风险等级',type:'single_select',enum:['中']},
    fnF2dP:{title:'是否需跟进',type:'single_select',enum:['是']}, fpKqwY:{title:'原始聊天',type:'text'},
    fqSNJg:{title:'来源消息ID',type:'text'}, fsoxb1:{title:'AI可信度',type:'number'}, fyA3qJ:{title:'创建时间',type:'date_time'}
  },
  risks: {
    f0mtar:{title:'风险标题',type:'text'}, f2l74y:{title:'项目名称',type:'text'}, f4oZEt:{title:'风险类型',type:'single_select',enum:['质量风险']},
    f5yurh:{title:'风险说明',type:'text'}, fCmh8X:{title:'风险等级',type:'single_select',enum:['中']}, fKpzlX:{title:'责任人',type:'text'},
    fPWOLg:{title:'发现时间',type:'date_time'}, fSwbZK:{title:'建议处理',type:'text'}, fWGMxA:{title:'处理状态',type:'single_select',enum:['待处理']},
    fcsLVU:{title:'截止时间',type:'date_time'}, fgP52B:{title:'原始聊天',type:'text'}, fhgXwj:{title:'来源消息ID',type:'text'},
    fogeFb:{title:'AI可信度',type:'number'}, fosNTX:{title:'更新时间',type:'date_time'}
  },
  digests: {
    f2J34N:{title:'简报日期',type:'date_time'}, f5Id2V:{title:'项目名称',type:'text'}, f5xvzf:{title:'今日重点',type:'text'},
    fFIp5u:{title:'重要进展',type:'text'}, fMotnk:{title:'客户关注',type:'multiple_select',enum:['需要可验证的防水检测结果']},
    fSS4qK:{title:'新增待办数',type:'number'}, fTvHGd:{title:'未完成待办数',type:'number'}, fXzd4E:{title:'风险数量',type:'number'},
    feVwGX:{title:'最高风险等级',type:'single_select',enum:['中']}, fjZ017:{title:'老板需关注',type:'text'},
    foaTAK:{title:'建议动作',type:'text'}, fpDz6o:{title:'消息数量',type:'number'}, fsybai:{title:'生成时间',type:'date_time'}
  }
}

export async function syncSmartSheets(db, config, fetchImpl = fetch) {
  const targets = [
    ['events', config.smartSheetEventsWebhook, 'event_id', eventQuery, eventValues],
    ['todos', config.smartSheetTodosWebhook, 'id', todoQuery, todoValues],
    ['risks', config.smartSheetRisksWebhook, 'risk_id', riskQuery, riskValues],
    ['digests', config.smartSheetDigestsWebhook, 'id', digestQuery, digestValues]
  ]
  const result = {}
  for (const [name, webhook, idColumn, query, mapper] of targets) {
    if (!webhook) { result[name] = { skipped:true, reason:'webhook_missing' }; continue }
    const stateKey = `smartsheet:${name}:last_id`
    const last = Number((await db.query('SELECT state_value FROM pipeline_state WHERE state_key=$1',[stateKey])).rows[0]?.state_value || 0)
    const rows = (await db.query(query,[last])).rows
    if (!rows.length) { result[name] = { synced:0, lastId:last }; continue }
    const response = await fetchImpl(webhook,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:schemas[name],add_records:rows.map(row=>({values:mapper(row)}))})})
    const body = await response.json()
    if (!response.ok || body.errcode !== 0) throw new Error(`智能表格 ${name} 同步失败: ${body.errmsg || response.status}`)
    const maxId = Math.max(...rows.map(row=>Number(row[idColumn])))
    await db.query(`INSERT INTO pipeline_state(state_key,state_value,updated_at) VALUES($1,$2,NOW())
      ON CONFLICT(state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW()`,[stateKey,String(maxId)])
    result[name] = { synced:rows.length, lastId:maxId }
  }
  return result
}

const todoQuery = `SELECT t.*,m.content source_content,m.sender_name source_sender,m.sent_at source_sent_at
  FROM todos t LEFT JOIN messages m ON m.msg_id=t.source_msg_id WHERE t.id>$1 ORDER BY t.id LIMIT 500`
const eventQuery = `SELECT e.* FROM events e WHERE e.event_id>$1 ORDER BY e.event_id LIMIT 500`
const riskQuery = `SELECT r.*,m.content source_content FROM risks r LEFT JOIN messages m ON m.msg_id=r.source_msg_id
  WHERE r.risk_id>$1 ORDER BY r.risk_id LIMIT 500`
const digestQuery = `SELECT d.* FROM digests d WHERE d.id>$1 ORDER BY d.id LIMIT 500`

function todoValues(r) { return compact({f4nJit:r.title,fAhcMD:r.project_name||r.group_id,fB4NED:r.details||'',fJPLiD:select(statusLabel(r.status)),
  fPA07s:select(r.priority||'高'),fUr7k5:r.owner,fbcj6D:dateValue(r.due_date),fcGyYR:r.source_sender||'',fcIPjZ:r.group_id,
  fdKIHV:r.source_content||'',fpISiW:r.source_msg_id,fpbJ8O:score(r.confidence),fsS35Q:r.reasoning||'由聊天中的明确行动要求识别',
  fvu5qu:dateValue(r.created_at),fzx9LN:dateValue(r.updated_at||new Date())}) }
function eventValues(r) { const sourceIds=jsonArray(r.source_msg_ids); return compact({f7oM24:r.title,f96AyS:r.project_name||r.group_id,fvRfh4:r.summary,
  fFMjcp:r.customer_name||'',fNj1zT:select(r.event_type||'客户需求'),fbjVyr:r.summary,fcXfpP:r.owner,
  fchqHR:dateValue(r.event_date||r.created_at),fdExIs:r.conclusion||r.status,fdaGZ9:select(r.risk_level||'中'),
  fnF2dP:select(r.follow_up||'是'),fpKqwY:r.raw_chat||'',fqSNJg:sourceIds.join(','),fsoxb1:score(r.confidence),fyA3qJ:dateValue(r.created_at)}) }
function riskValues(r) { return compact({f0mtar:r.title,f2l74y:r.project_name||r.group_id,f4oZEt:select(r.risk_type),f5yurh:r.description,fCmh8X:select(r.risk_level),
  fKpzlX:r.owner,fPWOLg:dateValue(r.discovered_at),fSwbZK:r.recommendation,fWGMxA:select(r.status),fcsLVU:dateValue(r.due_at),fgP52B:r.source_content||'',
  fhgXwj:r.source_msg_id,fogeFb:score(r.confidence),fosNTX:dateValue(r.updated_at)}) }
function digestValues(r) { const highlights=jsonArray(r.highlights); const questions=jsonArray(r.questions); return compact({f2J34N:dateValue(r.digest_date),f5Id2V:r.project_name||r.group_id,
  f5xvzf:r.summary,fFIp5u:highlights.join('；'),fMotnk:questions.slice(0,10).map(text=>({text:String(text)})),fSS4qK:r.todo_count,fTvHGd:r.todo_count,
  fXzd4E:0,feVwGX:select('中'),fjZ017:questions.join('；'),foaTAK:'查看并确认新增待办与风险',fpDz6o:r.message_count,fsybai:dateValue(r.updated_at)}) }

function compact(value) { return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined&&v!==null&&v!==''&&(!Array.isArray(v)||v.length))) }
function select(text) { return [{text:String(text)}] }
function score(value) { return Math.round(Number(value||0)*100) }
function dateValue(value) { if (!value) return undefined; const date=new Date(value); return Number.isNaN(date.getTime())?undefined:String(date.getTime()) }
function jsonArray(value) { if (Array.isArray(value)) return value; try { const parsed=JSON.parse(value||'[]'); return Array.isArray(parsed)?parsed:[] } catch { return [] } }
function statusLabel(value) { return ({pending_review:'待确认',pending:'未开始',in_progress:'进行中',done:'已完成',cancelled:'已取消'})[value]||'待确认' }
