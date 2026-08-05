#!/usr/bin/env node
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../src/config.js'
import { openPostgresDatabase } from '../src/database-postgres.js'

const moduleUrl = import.meta.url
const rootDir = process.env.WECOM_PIPELINE_ROOT || (moduleUrl ? path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..') : '/opt/wecom-chat-pipeline')
const config = loadConfig(rootDir)
if (config.databaseDriver !== 'postgres') throw new Error('Agent 审核仅使用 PostgreSQL')
if (!config.aiBaseUrl || !config.aiApiKey || !config.aiModel) throw new Error('AI 尚未配置')

async function main() {
const db = await openPostgresDatabase(config)
const startedAt = Date.now()
let apiStatus = 'failed'
let apiError = ''
let usage = {}
let inputMessageCount = 0
try {
  const project = (await db.query(`SELECT gp.group_id,gp.project_name,gp.default_location
    FROM group_projects gp WHERE gp.group_id=$1`, [config.groupId])).rows[0]
  if (!project) throw new Error(`群 ${config.groupId} 尚未映射项目`)
  const messages = (await db.query(`SELECT msg_id,seq,sender_name,sender_id,sent_at,msg_type,content
    FROM messages WHERE group_id=$1 ORDER BY sent_at,seq`, [config.groupId])).rows
  if (!messages.length) throw new Error('没有可分析的聊天记录')
  inputMessageCount = messages.length
  const terms = (await db.query(`SELECT term,aliases,definition,category,examples
    FROM industry_terms WHERE enabled=TRUE ORDER BY category,term LIMIT 300`)).rows
  const activePrompt = (await db.query(`SELECT prompt_id,system_prompt FROM prompt_versions
    WHERE agent_key=$1 AND status='active' ORDER BY version DESC LIMIT 1`, [config.agentKey])).rows[0]
  const feedback = (await db.query(`SELECT action,before_payload,after_payload,correction_note
    FROM agent_feedback ORDER BY created_at DESC LIMIT 50`)).rows.reverse()

  const messagesWithRefs = messages.map((item, index) => ({ ...item, ref: `M${String(index + 1).padStart(3, '0')}` }))
  const transcript = messagesWithRefs.map(item =>
    `[ref=${item.ref}] [${new Date(item.sent_at).toISOString()}] [${item.msg_type}] ${item.sender_name || item.sender_id}: ${item.content}`
  ).join('\n')
  const systemPrompt = `${activePrompt?.system_prompt || ''}\n
你要模拟装修项目管理后台的AI审核助手。结合完整上下文合并重复信息，按业务板块生成候选记录。
允许的module_type只有：event、construction_progress、todo、risk、customer_requirement、material、procurement、financial_record、inventory_record、acceptance、digest。
所有事实必须有聊天ref证据，只能使用输入中存在的M编号。禁止猜测不存在的金额、日期、负责人和完成状态；推算内容必须在reasoning中明确写“推算”。
每个实际事项只保留一条；闲聊、测试系统、拉人进群等非施工业务不得生成正式候选。
项目字段以“项目：${project.project_name}”为当前企业微信群对应的小区工地名称；群内另有明确【工地】字段时可以细化，但不得凭空改名。
结构化标签是强分类提示：【客户建档】→customer_requirement、【施工进度】→construction_progress、【工地待办】→todo、【问题风险】→risk、【材料采购】→procurement、【到货验收】→material或acceptance、【阶段验收】→acceptance、【客户变更】→event（同时保留客户和价格/工期影响）、【财务记录】→financial_record。标签只帮助分类，字段事实仍必须来自原文。
没有标签的自由聊天仍需分析，但“尊敬的客户/业主您好”等模板称呼不能单独生成客户档案；项目经理自报的联系方式不能当作客户电话；施工播报优先归入工地进度，不得误判为销售线索。
customer_requirement用于客户销售板块。仅从聊天明确内容提取：customerName、phone、source、stage（新线索/已联系/量房/出方案/报价/谈单/签约/流失）、houseType、area、address、budget、requirements、tags、owner、nextActionAt、probability、expectedAmount。没有明确依据的字段留空，禁止猜测手机号、地址、预算、金额和成交概率。
各模块优先使用这些字段：施工进度 summary/phase/location/progress/owner/status/next_action；待办 details/owner/due_date/priority/acceptanceCriteria；风险 description/impact/owner/dueAt/recommendation/needsOwnerDecision；采购 materialName/brand/model/specification/quantity/requiredAt/budget/applicant/supplier；到货验收 materialName/quantity/arrivedAt/acceptanceResult/inspector/exception；阶段验收 phase/location/acceptanceResult/inspector/customerConfirmed/corrections/reinspectionAt；客户变更 customerName/changeContent/event_date/amountImpact/scheduleImpact/customerConfirmed/owner；财务 customerName/projectName/paymentType/direction/amount/paymentStage/dueAt/paymentStatus/owner。
digest必须且只能有一条，概括当前项目状态、已完成、进行中、待确认、风险和下一步。
只输出JSON对象，格式：
{"drafts":[{"module_type":"todo","title":"","payload":{"summary":"","owner":"","status":"","event_date":"","due_date":"","phase":"","location":"","progress":0,"risk_level":"","next_action":""},"source_refs":["M001"],"confidence":0.0,"ai_reasoning":""}]}。

以下是老板过去对 Agent 结果的确认、纠正和驳回案例。把纠正当作高优先级示例，遇到相似表达时遵循；不要复制案例中的具体人名、金额或日期到无关事项：
${JSON.stringify(feedback)}`
  const response = await fetch(config.aiBaseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.aiApiKey}` },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: config.aiModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `项目：${project.project_name}\n默认位置：${project.default_location || '未设置'}\n行业词库：${JSON.stringify(terms)}\n聊天记录：\n${transcript}` }
      ]
    })
  })
  const body = await response.json().catch(() => ({}))
  usage = body.usage || {}
  if (!response.ok) throw new Error(body?.error?.message || `AI HTTP ${response.status}`)
  apiStatus = 'success'
  const parsed = parseJson(body.choices?.[0]?.message?.content || '')
  const messageById = new Map(messages.map(item => [item.msg_id, item]))
  const messageIdByRef = new Map(messagesWithRefs.map(item => [item.ref, item.msg_id]))
  const allowedModules = new Set(['event','construction_progress','todo','risk','customer_requirement','material','procurement','financial_record','inventory_record','acceptance','digest'])
  const drafts = (Array.isArray(parsed.drafts) ? parsed.drafts : []).filter(item =>
    allowedModules.has(item.module_type) && String(item.title || '').trim()
  )
  const client = await db.connect()
  const saved = []
  try {
    await client.query('BEGIN')
    for (const item of drafts) {
      const sourceIds = [...new Set((Array.isArray(item.source_refs) ? item.source_refs : [])
        .map(ref => messageIdByRef.get(String(ref).toUpperCase())).filter(Boolean))]
      if (!sourceIds.length) continue
      const title = String(item.title).trim().slice(0, 200)
      const dedupeKey = crypto.createHash('sha256').update(JSON.stringify([
        config.groupId, item.module_type, title, sourceIds.sort()
      ])).digest('hex')
      const result = await client.query(`INSERT INTO ai_drafts
        (dedupe_key,agent_key,project_name,group_id,module_type,title,payload,confidence,ai_reasoning,status,prompt_id,model)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'pending_review',$10,$11)
        ON CONFLICT(dedupe_key) DO UPDATE SET payload=EXCLUDED.payload,confidence=EXCLUDED.confidence,
          ai_reasoning=EXCLUDED.ai_reasoning,prompt_id=EXCLUDED.prompt_id,model=EXCLUDED.model,updated_at=NOW()
        RETURNING draft_id,status`, [
        dedupeKey, config.agentKey, project.project_name, config.groupId, item.module_type, title,
        JSON.stringify(item.payload || {}), clampConfidence(item.confidence), String(item.ai_reasoning || '').slice(0, 1000),
        activePrompt?.prompt_id || null, config.aiModel
      ])
      const draftId = result.rows[0].draft_id
      for (const msgId of sourceIds) {
        const source = messageById.get(msgId)
        await client.query(`INSERT INTO ai_draft_sources(draft_id,msg_id,excerpt)
          VALUES($1,$2,$3) ON CONFLICT(draft_id,msg_id) DO UPDATE SET excerpt=EXCLUDED.excerpt`, [
          draftId, msgId, String(source?.content || '').slice(0, 500)
        ])
      }
      saved.push({ draft_id: draftId, module_type: item.module_type, title, payload: item.payload || {},
        confidence: clampConfidence(item.confidence), ai_reasoning: String(item.ai_reasoning || ''), source_count: sourceIds.length })
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  console.log(JSON.stringify({ ok: true, project: project.project_name, message_count: messages.length,
    model: config.aiModel, usage, drafts: saved }, null, 2))
} catch (error) {
  apiError = String(error.message || error)
  throw error
} finally {
  await db.query(`INSERT INTO ai_api_calls
    (agent_key,provider,model,purpose,status,input_message_count,prompt_tokens,completion_tokens,latency_ms,error_message)
    VALUES($1,'xiaomi-mimo',$2,'project_review',$3,$4,$5,$6,$7,$8)`, [
    config.agentKey, config.aiModel, apiStatus, inputMessageCount, numberOrNull(usage.prompt_tokens),
    numberOrNull(usage.completion_tokens), Date.now() - startedAt, apiError.slice(0, 500)
  ]).catch(() => {})
  await db.end()
}
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

function parseJson(value) {
  const text = String(value).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(text)
}

function clampConfidence(value) {
  return Math.max(0, Math.min(1, Number(value) || 0))
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null
}
