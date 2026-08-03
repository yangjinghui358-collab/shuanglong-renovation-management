const phaseRules = [
  ['防水验收', /楼下.*(渗漏|漏水)|无渗漏|楼下查验/],
  ['闭水试验', /闭水|蓄水试验/],
  ['防水找坡', /找坡|磨坡|沙灰.*坡/],
  ['基层养护', /晾干|养护干燥|基层干燥/],
  ['防水涂刷', /防水涂刷|刷胶防水|刚性防水|柔性防水|刷防水/],
  ['水电改造', /水电|打压|布线|开槽|管路/],
  ['主体拆改', /拆除|拆改|垃圾清运/],
  ['瓦工铺贴', /铺砖|贴砖|瓷砖铺贴|墙砖|地砖/],
  ['木工施工', /木工|吊顶|柜体基层/],
  ['油工施工', /油工|腻子|乳胶漆|墙面打磨/],
  ['主材安装', /洁具安装|灯具安装|木门安装|橱柜安装|主材安装/],
  ['竣工验收', /竣工验收|交付验收|整改完成/]
]

export function classifyConstructionMessage(content) {
  const text=String(content||'').trim()
  if (!text || /^\[[a-z]+\]$/i.test(text)) return null
  const phase=phaseRules.find(([,rule])=>rule.test(text))?.[0]
  if (!phase) return null
  let status='pending_review',progress=0,label='计划'
  if (/(完成后|待.+完成|后进行|明天|明日|明早|计划|准备|后续|下一)/.test(text)) { status='pending_review'; progress=0; label='计划' }
  else if (/(完成|完毕|已完成|验收合格|合格|结束)/.test(text)) { status='done'; progress=100; label='完成' }
  else if (/(开始|进场|施工中|正在|已进场)/.test(text)) { status='in_progress'; progress=40; label='施工中' }
  else { status='in_progress'; progress=20; label='进展' }
  return {phase,status,progress,label}
}

export async function analyzeNewConstructionMessages(db) {
  const stateKey='construction_analysis_seq'
  const last=Number((await db.query('SELECT state_value FROM pipeline_state WHERE state_key=$1',[stateKey])).rows[0]?.state_value||0)
  const rows=(await db.query(`SELECT m.*,gp.project_name,gp.default_location FROM messages m
    JOIN group_projects gp ON gp.group_id=m.group_id WHERE m.seq>$1 ORDER BY m.seq LIMIT 1000`,[last])).rows
  let classified=0,updated=0,createdEvents=0,maxSeq=last
  for (const row of rows) {
    maxSeq=Math.max(maxSeq,Number(row.seq))
    const result=classifyConstructionMessage(row.content)
    if (!result) continue
    classified++
    const actualStart=result.status==='in_progress'?row.sent_at:null
    const actualEnd=result.status==='done'?row.sent_at:null
    const update=await db.query(`UPDATE todos SET status=$1,progress=GREATEST(progress,$2),
      actual_start=COALESCE(actual_start,$3),actual_end=COALESCE(actual_end,$4),updated_at=NOW()
      WHERE project_name=$5 AND phase=$6 AND status<>'cancelled'`,[
      result.status,result.progress,actualStart,actualEnd,row.project_name,result.phase
    ])
    updated+=update.rowCount
    const exists=await db.query(`SELECT 1 FROM events WHERE source_msg_ids @> $1::jsonb LIMIT 1`,[JSON.stringify([row.msg_id])])
    if (!exists.rowCount) {
      await db.query(`INSERT INTO events(group_id,project_name,event_type,title,summary,status,owner,event_date,conclusion,risk_level,follow_up,raw_chat,source_msg_ids,confidence)
        VALUES($1,$2,'施工进展',$3,$4,'active',$5,$6,$7,'低',$8,$4,$9::jsonb,$10)`,[
        row.group_id,row.project_name,`${result.phase}${result.label}`,row.content,row.sender_name||row.sender_id,
        row.sent_at.toISOString(),`${result.phase}状态识别为${result.label}`,result.status==='done'?'否':'是',JSON.stringify([row.msg_id]),0.9
      ])
      createdEvents++
    }
  }
  if (maxSeq>last) await db.query(`INSERT INTO pipeline_state(state_key,state_value,updated_at) VALUES($1,$2,NOW())
    ON CONFLICT(state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW()`,[stateKey,String(maxSeq)])
  return {scanned:rows.length,classified,updated,createdEvents,lastSeq:maxSeq}
}
