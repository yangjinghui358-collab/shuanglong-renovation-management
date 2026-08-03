import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const envFile = process.argv[2] || '/etc/wecom-chat-pipeline/secrets.env'
const password = crypto.randomBytes(24).toString('hex')
const sql = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wecom_pipeline') THEN
    CREATE ROLE wecom_pipeline LOGIN;
  END IF;
END $$;
ALTER ROLE wecom_pipeline PASSWORD '${password}';
SELECT 'CREATE DATABASE wecom_chat OWNER wecom_pipeline'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='wecom_chat')\\gexec
`
execFileSync('runuser', ['-u', 'postgres', '--', 'psql', '-v', 'ON_ERROR_STOP=1'], { input: sql })

const existing = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
const removed = /^(CLOUDBASE_[A-Z0-9_]*|DATABASE_DRIVER|POSTGRES_URL|AI_BASE_URL|AI_API_KEY|AI_MODEL|PUSHPLUS_ENABLED)=/
const kept = existing.split(/\r?\n/).filter(line => !removed.test(line))
const additions = [
  'DATABASE_DRIVER=postgres',
  `POSTGRES_URL=postgresql://wecom_pipeline:${password}@127.0.0.1:5432/wecom_chat`,
  'PUSHPLUS_ENABLED=false'
]
fs.writeFileSync(envFile, `${kept.join('\n').replace(/\n+$/, '')}\n${additions.join('\n')}\n`, { mode: 0o600 })
fs.chmodSync(envFile, 0o600)
console.log('PostgreSQL 已初始化；CloudBase 与内置大模型配置已从生产密钥文件移除。')
