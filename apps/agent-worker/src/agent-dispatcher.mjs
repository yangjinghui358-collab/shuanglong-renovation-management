#!/usr/bin/env node
import { spawn } from "node:child_process"
import pg from "pg"
import { toManagementCandidate } from "./candidate-mapping.mjs"

const { Pool } = pg
const managementPool = new Pool({ connectionString: required("MANAGEMENT_DATABASE_URL"), max: 1 })
const sourcePool = new Pool({ connectionString: required("POSTGRES_URL"), max: 1 })
const apiBaseUrl = (process.env.MANAGEMENT_API_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "")
const agentToken = required("AGENT_INGEST_TOKEN")

async function main() {
  await managementPool.query(`UPDATE agent_run_requests SET status='failed',error='Agent 运行中断，已自动收口',finished_at=now() WHERE status='running' AND started_at<now()-interval '5 minutes'`)
  const job = await claimJob()
  if (!job) return console.log(JSON.stringify({ ok: true, status: "idle" }))
  try {
    const result = await runAgent(job.agent_key)
    await managementPool.query(`UPDATE agent_run_requests SET status='succeeded',result=$2,finished_at=now() WHERE id=$1`, [job.id, result])
    console.log(JSON.stringify({ ok: true, jobId: job.id, agentKey: job.agent_key, ...result }))
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 500)
    await managementPool.query(`UPDATE agent_run_requests SET status='failed',error=$2,finished_at=now() WHERE id=$1`, [job.id, message])
    throw error
  }
}

async function claimJob() {
  const result = await managementPool.query(`
    UPDATE agent_run_requests SET status='running',started_at=now()
     WHERE id=(SELECT id FROM agent_run_requests WHERE status='queued' ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING id,agent_key
  `)
  return result.rows[0] || null
}

async function runAgent(key) {
  if (key === "chat_archive") {
    let refresh = "succeeded"
    try { await runProcess("/usr/bin/node", [required("MANAGEMENT_AGENT_REVIEW_SCRIPT")]) }
    catch { refresh = "failed_using_existing_drafts" }
    const result = await syncChatDrafts()
    if (!result.submitted && refresh !== "succeeded") throw new Error("聊天 AI 刷新失败，且没有可同步的已有草稿")
    return { ...result, refresh }
  }
  if (key === "todo_reminder") return submitTodoReminders()
  if (key === "owner_alert") return submitOwnerAlerts()
  throw new Error("未知 Agent")
}

async function syncChatDrafts() {
  const result = await sourcePool.query(`
    SELECT d.draft_id,d.dedupe_key,d.project_name,d.module_type,d.title,d.payload,d.confidence,d.ai_reasoning,d.updated_at,
           COUNT(s.msg_id)::int source_count,
           COALESCE(jsonb_agg(s.msg_id ORDER BY s.msg_id) FILTER (WHERE s.msg_id IS NOT NULL),'[]'::jsonb) source_message_ids
      FROM ai_drafts d LEFT JOIN ai_draft_sources s ON s.draft_id=d.draft_id
     WHERE d.status='pending_review' GROUP BY d.draft_id ORDER BY d.updated_at,d.draft_id LIMIT 200
  `)
  const candidates = result.rows.map(toManagementCandidate).filter(item => item?.payload.title && item?.payload.sourceCount)
  return submitAll(candidates)
}

async function submitTodoReminders() {
  const result = await sourcePool.query(`
    SELECT id,project_name,title,details,owner,due_date,status,priority,phase,progress,source_msg_id,updated_at
      FROM todos WHERE status NOT IN ('done','completed','已完成','cancelled','已取消')
     ORDER BY updated_at DESC LIMIT 100
  `)
  return submitAll(result.rows.map(row => ({
    module: "tasks", kind: "todo_reminder", confidence: 1,
    sourceKey: `wecom-todo:${row.id}:${new Date(row.updated_at).toISOString()}`,
    payload: { title: row.title, projectName: row.project_name, details: row.details, owner: row.owner, dueDate: row.due_date, status: row.status, priority: row.priority, phase: row.phase, progress: row.progress, sourceMessageIds: row.source_msg_id ? [row.source_msg_id] : [] },
  })))
}

async function submitOwnerAlerts() {
  const result = await sourcePool.query(`
    SELECT risk_id,project_name,title,description,risk_level,owner,status,recommendation,due_at,source_msg_id,confidence,updated_at
      FROM risks WHERE status NOT IN ('resolved','closed','已解决','已关闭')
     ORDER BY CASE risk_level WHEN '高' THEN 1 WHEN '中' THEN 2 ELSE 3 END,updated_at DESC LIMIT 100
  `)
  return submitAll(result.rows.map(row => ({
    module: "alerts", kind: "owner_alert", confidence: Number(row.confidence) || 0.8,
    sourceKey: `wecom-risk:${row.risk_id}:${new Date(row.updated_at).toISOString()}`,
    payload: { title: row.title, projectName: row.project_name, description: row.description, riskLevel: row.risk_level, owner: row.owner, status: row.status, recommendation: row.recommendation, dueAt: row.due_at, sourceMessageIds: row.source_msg_id ? [row.source_msg_id] : [] },
  })))
}

async function submitAll(candidates) {
  let submitted = 0
  for (const candidate of candidates) {
    const response = await fetch(`${apiBaseUrl}/api/agent/candidates`, { method: "POST", headers: { authorization: `Bearer ${agentToken}`, "content-type": "application/json" }, body: JSON.stringify(candidate), signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`管理后台候选接口返回 HTTP ${response.status}`)
    submitted += 1
  }
  return { scanned: candidates.length, submitted }
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"], env: process.env })
    let errorText = ""
    child.stderr.on("data", chunk => { errorText = (errorText + chunk).slice(-500) })
    child.once("error", reject)
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`聊天提炼失败 (${code}): ${errorText}`)))
  })
}

function required(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value }

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }).finally(async () => { await sourcePool.end(); await managementPool.end() })
