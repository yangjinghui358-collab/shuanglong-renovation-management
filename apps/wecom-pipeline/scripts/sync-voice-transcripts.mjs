#!/usr/bin/env node
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../src/config.js'
import { openPostgresDatabase } from '../src/database-postgres.js'

const run = promisify(execFile)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = loadConfig(rootDir)
const adapter = path.join(rootDir, 'scripts/wecom-archive-adapter.mjs')
const financeCli = process.env.WECOM_FINANCE_CLI || '/opt/wecom-sdk/bin/wecom-finance-cli'
const ffmpeg = process.env.FFMPEG_BIN || '/usr/local/bin/ffmpeg'

if (config.databaseDriver !== 'postgres') throw new Error('语音同步仅使用 PostgreSQL')
if (!config.aiBaseUrl || !config.aiApiKey || !config.asrModel) throw new Error('ASR 尚未配置')

const db = await openPostgresDatabase(config)
try {
  await fs.mkdir(config.mediaDir, { recursive: true, mode: 0o700 })
  const discovered = await discoverVoices(db)
  const transcribed = await transcribePending(db)
  const unresolved = Number((await db.query(`SELECT COUNT(*)::int AS count FROM media
    WHERE group_id=$1 AND media_type='voice' AND sdkfileid<>'' AND status<>'transcribed'`, [config.groupId])).rows[0]?.count || 0)
  console.log(JSON.stringify({ ok: unresolved === 0, discovered, transcribed, unresolved }, null, 2))
  if (unresolved > 0) process.exitCode = 1
} finally {
  await db.end()
}

async function discoverVoices(db) {
  const { stdout } = await run(adapter, ['fetch', '--seq', '0', '--limit', '1000'], {
    env: process.env,
    maxBuffer: 30 * 1024 * 1024
  })
  const messages = JSON.parse(stdout)
  let found = 0
  for (const item of messages) {
    if (item.group_id !== config.groupId || item.msg_type !== 'voice' || !item.media?.sdkfileid) continue
    found++
    await db.query(`INSERT INTO messages
      (msg_id,seq,group_id,sender_id,sender_name,sent_at,msg_type,content,raw_json)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      ON CONFLICT(msg_id) DO UPDATE SET raw_json=EXCLUDED.raw_json`, [
      item.msg_id, Number(item.seq), item.group_id, item.sender_id || '', item.sender_name || '',
      new Date(item.sent_at), item.msg_type, item.content || '', JSON.stringify(item)
    ])
    await db.query(`INSERT INTO media(msg_id,group_id,media_type,local_path,sha256,size_bytes,transcript,status,sdkfileid,source_format,error)
      VALUES($1,$2,'voice','', '',$3,'','pending_download',$4,'amr','')
      ON CONFLICT(msg_id,media_type) DO UPDATE SET
        sdkfileid=EXCLUDED.sdkfileid,size_bytes=EXCLUDED.size_bytes`, [
      item.msg_id, item.group_id, item.media.filesize || 0, item.media.sdkfileid
    ])
  }
  return found
}

async function transcribePending(db) {
  const rows = (await db.query(`WITH candidates AS (
      SELECT media_id FROM media
      WHERE media_type='voice' AND sdkfileid<>'' AND attempts<5
        AND (status IN ('pending_download','failed')
          OR (status IN ('downloading','transcribing') AND updated_at<NOW()-INTERVAL '15 minutes'))
        AND (next_attempt_at IS NULL OR next_attempt_at<=NOW())
      ORDER BY media_id FOR UPDATE SKIP LOCKED LIMIT 100
    )
    UPDATE media m SET status='downloading',attempts=m.attempts+1,error='',updated_at=NOW()
    FROM candidates c WHERE m.media_id=c.media_id
    RETURNING m.media_id,m.msg_id,m.sdkfileid,m.attempts`)).rows
  let success = 0
  let failed = 0
  for (const row of rows) {
    const safeName = String(row.msg_id).replace(/[^a-zA-Z0-9_-]/g, '_')
    const amrPath = path.join(config.mediaDir, `${safeName}.amr`)
    const wavPath = path.join(config.mediaDir, `${safeName}.wav`)
    try {
      const media = await run(financeCli, ['media', row.sdkfileid], {
        env: process.env,
        encoding: 'buffer',
        maxBuffer: 20 * 1024 * 1024
      })
      await fs.writeFile(amrPath, media.stdout, { mode: 0o600 })
      await run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', amrPath,
        '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath], { maxBuffer: 2 * 1024 * 1024 })
      await db.query(`UPDATE media SET status='transcribing',updated_at=NOW() WHERE media_id=$1`, [row.media_id])
      const transcript = await transcribeWav(db, wavPath)
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query(`UPDATE media SET local_path=$2,transcript=$3,status='transcribed',
          size_bytes=$4,error='',next_attempt_at=NULL,transcribed_at=NOW(),updated_at=NOW() WHERE media_id=$1`, [
          row.media_id, wavPath, transcript, media.stdout.length
        ])
        await client.query(`UPDATE messages SET content=$2::text,
          raw_json=jsonb_set(raw_json,'{asr}',jsonb_build_object('model',$3::text,'transcript',$2::text),true)
          WHERE msg_id=$1`, [row.msg_id, transcript, config.asrModel])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
      await fs.rm(amrPath, { force: true })
      success++
    } catch (error) {
      failed++
      const finalAttempt = Number(row.attempts) >= 5
      await db.query(`UPDATE media SET status='failed',error=$2,
        next_attempt_at=CASE WHEN $3 THEN NULL ELSE NOW()+(INTERVAL '5 minutes' * POWER(2,LEAST(attempts-1,4))) END,
        updated_at=NOW() WHERE media_id=$1`, [
        row.media_id, safeErrorCode(error), finalAttempt
      ])
    }
  }
  return { queued: rows.length, success, failed }
}

async function transcribeWav(db, wavPath) {
  const startedAt = Date.now()
  let status = 'failed'
  let errorMessage = ''
  let usage = {}
  try {
    const wav = await fs.readFile(wavPath)
    const response = await fetch(config.aiBaseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.aiApiKey}` },
      body: JSON.stringify({
        model: config.asrModel,
        messages: [{ role: 'user', content: [{
          type: 'input_audio',
          input_audio: { data: `data:audio/wav;base64,${wav.toString('base64')}` }
        }] }],
        asr_options: { language: 'auto' }
      })
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error?.message || `ASR HTTP ${response.status}`)
    const transcript = String(body.choices?.[0]?.message?.content || '').trim()
    if (!transcript) throw new Error('ASR 返回空文本')
    usage = body.usage || {}
    status = 'success'
    return transcript
  } catch (error) {
    errorMessage = error.message
    throw error
  } finally {
    await db.query(`INSERT INTO ai_api_calls
      (agent_key,provider,model,purpose,status,input_message_count,prompt_tokens,completion_tokens,latency_ms,error_message)
      VALUES($1,'xiaomi-mimo',$2,'voice_transcription',$3,1,$4,$5,$6,$7)`, [
      config.agentKey, config.asrModel, status,
      numberOrNull(usage.prompt_tokens), numberOrNull(usage.completion_tokens),
      Date.now() - startedAt, errorMessage.slice(0, 500)
    ])
  }
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null
}

function safeErrorCode(error) {
  const message = String(error?.message || error).toLowerCase()
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout'
  if (message.includes('429') || message.includes('quota') || message.includes('limit')) return 'rate_or_quota_limit'
  if (message.includes('401') || message.includes('403') || message.includes('auth')) return 'authentication_failed'
  if (message.includes('ffmpeg')) return 'audio_conversion_failed'
  if (message.includes('asr')) return 'asr_request_failed'
  return 'voice_processing_failed'
}
