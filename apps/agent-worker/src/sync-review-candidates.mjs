#!/usr/bin/env node
import pg from "pg"
import { toManagementCandidate } from "./candidate-mapping.mjs"

const { Pool } = pg
const databaseUrl = required("POSTGRES_URL")
const agentToken = required("AGENT_INGEST_TOKEN")
const apiBaseUrl = (process.env.MANAGEMENT_API_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "")
const pool = new Pool({ connectionString: databaseUrl, max: 1 })

try {
  const result = await pool.query(`
    SELECT d.draft_id,d.dedupe_key,d.project_name,d.module_type,d.title,d.payload,
           d.confidence,d.ai_reasoning,d.updated_at,
           COUNT(s.msg_id)::int AS source_count,
           COALESCE(jsonb_agg(s.msg_id ORDER BY s.msg_id) FILTER (WHERE s.msg_id IS NOT NULL),'[]'::jsonb) AS source_message_ids
      FROM ai_drafts d
      LEFT JOIN ai_draft_sources s ON s.draft_id=d.draft_id
     WHERE d.status='pending_review'
     GROUP BY d.draft_id
     ORDER BY d.updated_at,d.draft_id
     LIMIT 200
  `)

  let submitted = 0
  let skipped = 0
  for (const draft of result.rows) {
    const candidate = toManagementCandidate(draft)
    if (!candidate || !candidate.payload.title || !candidate.payload.sourceCount) {
      skipped += 1
      continue
    }
    const response = await fetch(`${apiBaseUrl}/api/agent/candidates`, {
      method: "POST",
      headers: { authorization: `Bearer ${agentToken}`, "content-type": "application/json" },
      body: JSON.stringify(candidate),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`管理后台候选接口返回 HTTP ${response.status}`)
    submitted += 1
  }
  console.log(JSON.stringify({ ok: true, scanned: result.rowCount, submitted, skipped }))
} finally {
  await pool.end()
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}
