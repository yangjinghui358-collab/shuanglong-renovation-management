import crypto from 'node:crypto'
import fs from 'node:fs'

const envFile = process.argv[2] || '/etc/wecom-chat-pipeline/secrets.env'
const text = fs.readFileSync(envFile, 'utf8')
const callbackAesKey = randomAlphaNumeric(43)
const values = {
  WECOM_CALLBACK_ENABLED: 'true',
  WECOM_CALLBACK_PORT: '80',
  WECOM_CALLBACK_PATH: '/wecom/callback',
  WECOM_CALLBACK_TOKEN: crypto.randomBytes(16).toString('hex'),
  WECOM_CALLBACK_AES_KEY: callbackAesKey
}
const keys = new Set(Object.keys(values))
const kept = text.split(/\r?\n/).filter(line => !keys.has(line.slice(0, line.indexOf('='))))
const additions = Object.entries(values).map(([key, value]) => `${key}=${value}`)
fs.writeFileSync(envFile, `${kept.join('\n').replace(/\n+$/, '')}\n${additions.join('\n')}\n`, { mode: 0o600 })
fs.chmodSync(envFile, 0o600)
console.log('企微回调凭据已在服务器本地生成，未输出凭据。')

function randomAlphaNumeric(length) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  while (result.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      // 丢弃会造成取模偏差的尾部值。
      if (byte >= 248) continue
      result += alphabet[byte % alphabet.length]
      if (result.length === length) break
    }
  }
  return result
}
