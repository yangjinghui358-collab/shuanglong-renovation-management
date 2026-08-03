import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import { createArchiveProvider } from './archive-provider.js'
import { buildDigest, collectMessages, createDigestGroupSendTask, pushDigestToPersonalWeChat } from './pipeline.js'
import { closeRepository, openRepository } from './repository.js'
import { WeComClient } from './wecom-client.js'
import { startWeComCallback } from './wecom-callback.js'
import { PushPlusClient } from './pushplus-client.js'
import { getAgentStatus, testAiConnection } from './domain-agent.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = loadConfig(rootDir)
const command = process.argv[2] || 'help'
const db = await openRepository(config)
const store = config.databaseDriver === 'postgres'
    ? await import('./database-postgres.js')
    : await import('./database.js')
const provider = createArchiveProvider(config)
const wecomClient = config.wecomGroupSendEnabled
  ? new WeComClient({ corpId: config.wecomCorpId, secret: config.wecomAppSecret })
  : null
const pushPlusClient = config.pushplusEnabled
  ? new PushPlusClient({ token: config.pushplusToken })
  : null

try {
  if (command === 'init') {
    console.log(JSON.stringify({ ok: true, database: config.databasePath }, null, 2))
  } else if (command === 'run-once') {
    const collection = await collectMessages(db, provider, store)
    const window = fixtureAwareWindow()
    const digest = await buildDigest(db, config, window.digestDate, window.start, window.end, store)
    console.log(JSON.stringify({ collection, ...digest }, null, 2))
  } else if (command === 'show') {
    console.log(JSON.stringify(await store.snapshot(db), null, 2))
  } else if (command === 'push-test') {
    if (!pushPlusClient) throw new Error('请先配置 PUSHPLUS_TOKEN 并启用 PUSHPLUS_ENABLED')
    const latestDigest = (await store.snapshot(db)).digests?.[0]
    if (!latestDigest) throw new Error('当前没有可用于测试的简报')
    await pushPlusClient.sendDigest(normalizeStoredDigest(latestDigest))
    console.log(`测试推送已提交：${latestDigest.digest_date}`)
  } else if (command === 'ai-test') {
    if (!config.aiBaseUrl || !config.aiApiKey || !config.aiModel) throw new Error('请先配置 AI_BASE_URL、AI_API_KEY 和 AI_MODEL')
    if (!pushPlusClient) throw new Error('请先启用 PushPlus')
    await collectMessages(db, provider, store)
    const window = dailyWindow(new Date(), config)
    const result = await buildDigest(db, config, window.digestDate, window.start, window.end, store)
    const sent = await pushPlusClient.sendDigest(result.digest)
    console.log(JSON.stringify({
      ok: true,
      digest_date: result.digest.digest_date,
      messages: result.digest.message_count,
      highlights: result.digest.highlights.length,
      todos: result.digest.todos.length,
      questions: result.digest.questions.length,
      message_id: sent.messageId
    }))
  } else if (command === 'agent-status') {
    console.log(JSON.stringify(await getAgentStatus(db, config), null, 2))
  } else if (command === 'agent-test') {
    console.log(JSON.stringify(await testAiConnection(db, config), null, 2))
  } else if (command === 'start') {
    await runDaemon()
  } else {
    console.log('命令: npm run init | npm run run:once | npm run show | node src/cli.js agent-status | node src/cli.js agent-test | npm start')
  }
} finally {
  if (command !== 'start') await closeRepository(db)
}

async function runDaemon() {
  const callbackServer = startWeComCallback(config)
  console.log(`企微会话流水线已启动，每 ${config.pollIntervalSeconds} 秒拉取一次`)
  let lastDigestKey = ''
  let lastCollectionAttemptAt = 0
  const tick = async () => {
    try {
      const now = zonedParts(new Date(), config.timezone)
      const digestKey = `${now.date}-${now.hour}:${now.minute}`
      const digestDue = config.digestEnabled && now.hour === config.digestHour && now.minute === config.digestMinute && digestKey !== lastDigestKey
      const nowMs = Date.now()
      if (digestDue || nowMs - lastCollectionAttemptAt >= config.pollIntervalSeconds * 1000) {
        // Record the attempt before calling the archive API so transient failures do not
        // turn a five-hour polling policy into one request per minute.
        lastCollectionAttemptAt = nowMs
        const collection = await collectMessages(db, provider, store)
        if (collection.inserted) console.log(`[collect] 新增 ${collection.inserted} 条消息，seq=${collection.lastSeq}`)
      }
      if (digestDue) {
        const window = dailyWindow(new Date(), config)
        const result = await buildDigest(db, config, window.digestDate, window.start, window.end, store)
        console.log(`[digest] ${result.digest.digest_date} 消息 ${result.digest.message_count} 条，待办 ${result.digest.todo_count} 条`)
        const send = await createDigestGroupSendTask(db, config, result.digest, store, wecomClient)
        if (!send.skipped) console.log(`[group-send] 已创建待群主确认的任务，msgid=${send.delivery.msgid}，失败 ${send.delivery.fail_list.length} 人`)
        const personalPush = await pushDigestToPersonalWeChat(db, config, result.digest, store, pushPlusClient)
        if (!personalPush.skipped) console.log(`[pushplus] ${result.digest.digest_date} 简报已推送到个人微信`)
        lastDigestKey = digestKey
      }
    } catch (error) {
      console.error('[pipeline-error]', error.stack || error.message)
    }
  }
  await tick()
  // 调度检查固定每分钟运行，避免较长的抓取间隔错过每日简报时间。
  // 只有达到 pollIntervalSeconds 后才会调用会话存档接口。
  const timer = setInterval(tick, 60 * 1000)
  process.on('SIGTERM', () => shutdown(timer, callbackServer))
  process.on('SIGINT', () => shutdown(timer, callbackServer))
}

function shutdown(timer, callbackServer) {
  clearInterval(timer)
  callbackServer?.close()
  closeRepository(db)
  process.exit(0)
}

function fixtureAwareWindow() {
  if (config.archiveProvider !== 'mock') return dailyWindow(new Date(), config)
  const messages = JSON.parse(fs.readFileSync(config.mockArchiveFile, 'utf8'))
  const date = messages[0]?.sent_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  return { digestDate: date, start: `${date}T00:00:00+08:00`, end: `${date}T23:59:59+08:00` }
}

function dailyWindow(now, value) {
  const parts = zonedParts(now, value.timezone)
  const cutoff = `${parts.date}T${String(value.digestCutoffHour).padStart(2, '0')}:00:00+08:00`
  const end = new Date(cutoff)
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return {
    digestDate: parts.date,
    start: start.toISOString(),
    end: end.toISOString()
  }
}

function zonedParts(date, timezone) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).map(item => [item.type, item.value]))
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour), minute: Number(values.minute) }
}

function normalizeStoredDigest(digest) {
  return {
    ...digest,
    decisions: digest.decisions || parseJsonArray(digest.decisions_json),
    questions: digest.questions || parseJsonArray(digest.questions_json)
  }
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
