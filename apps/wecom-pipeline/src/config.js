import fs from 'node:fs'
import path from 'node:path'

export function loadConfig(rootDir = process.cwd()) {
  loadEnv(path.join(rootDir, '.env'))
  return {
    rootDir,
    archiveProvider: env('ARCHIVE_PROVIDER', 'mock'),
    mockArchiveFile: resolve(rootDir, env('MOCK_ARCHIVE_FILE', 'fixtures/messages.json')),
    archiveCommand: env('WECOM_ARCHIVE_COMMAND', ''),
    databaseDriver: env('DATABASE_DRIVER', 'sqlite'),
    databasePath: resolve(rootDir, env('DATABASE_PATH', 'data/wecom-chat.db')),
    postgresUrl: env('POSTGRES_URL', ''),
    groupId: env('GROUP_ID', 'demo-group-01'),
    groupName: env('GROUP_NAME', '测试客户群'),
    timezone: env('TIMEZONE', 'Asia/Shanghai'),
    pollIntervalSeconds: numberEnv('POLL_INTERVAL_SECONDS', 60),
    digestHour: numberEnv('DIGEST_HOUR', 22),
    digestMinute: numberEnv('DIGEST_MINUTE', 5),
    digestCutoffHour: numberEnv('DIGEST_CUTOFF_HOUR', 22),
    digestEnabled: booleanEnv('DIGEST_ENABLED', true),
    wecomCorpId: env('WECOM_CORP_ID', ''),
    wecomAppSecret: env('WECOM_APP_SECRET', ''),
    wecomSenderUserId: env('WECOM_SENDER_USER_ID', ''),
    wecomGroupSendEnabled: booleanEnv('WECOM_GROUP_SEND_ENABLED', false),
    wecomCallbackEnabled: booleanEnv('WECOM_CALLBACK_ENABLED', false),
    wecomCallbackPort: numberEnv('WECOM_CALLBACK_PORT', 80),
    wecomCallbackPath: env('WECOM_CALLBACK_PATH', '/wecom/callback'),
    wecomCallbackToken: env('WECOM_CALLBACK_TOKEN', ''),
    wecomCallbackAesKey: env('WECOM_CALLBACK_AES_KEY', ''),
    pushplusEnabled: booleanEnv('PUSHPLUS_ENABLED', false),
    pushplusToken: env('PUSHPLUS_TOKEN', ''),
    aiBaseUrl: env('AI_BASE_URL', ''),
    aiApiKey: env('AI_API_KEY', ''),
    aiModel: env('AI_MODEL', ''),
    asrModel: env('ASR_MODEL', 'mimo-v2.5-asr'),
    mediaDir: resolve(rootDir, env('MEDIA_DIR', '/var/lib/wecom-chat-pipeline/media')),
    agentKey: env('AGENT_KEY', 'project_manager'),
    smartSheetTodosWebhook: env('WECOM_SMARTSHEET_WEBHOOK', ''),
    smartSheetEventsWebhook: env('WECOM_SMARTSHEET_EVENTS_WEBHOOK', ''),
    smartSheetRisksWebhook: env('WECOM_SMARTSHEET_RISKS_WEBHOOK', ''),
    smartSheetDigestsWebhook: env('WECOM_SMARTSHEET_DIGESTS_WEBHOOK', '')
  }
}

function booleanEnv(key, fallback) {
  const value = String(env(key, fallback)).toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(value)) return true
  if (['0', 'false', 'no', 'off'].includes(value)) return false
  throw new Error(`${key} 必须是 true 或 false`)
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue
    const index = value.indexOf('=')
    if (index < 1) continue
    const key = value.slice(0, index).trim()
    if (process.env[key] === undefined) process.env[key] = value.slice(index + 1).trim()
  }
}

function env(key, fallback) {
  return process.env[key] === undefined ? fallback : process.env[key]
}

function numberEnv(key, fallback) {
  const value = Number(env(key, fallback))
  if (!Number.isFinite(value)) throw new Error(`${key} 必须是数字`)
  return value
}

function resolve(rootDir, value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value)
}
