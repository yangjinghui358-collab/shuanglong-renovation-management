#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const cli = process.env.WECOM_FINANCE_CLI || '/opt/wecom-sdk/bin/wecom-finance-cli'
const privateKeyFile =
  process.env.WECOM_PRIVATE_KEY_FILE || '/etc/wecom-chat-pipeline/archive_private_key.pem'

async function main() {
  const [action, ...args] = process.argv.slice(2)
  if (action !== 'fetch') throw new Error('usage: wecom-archive-adapter.mjs fetch --seq N --limit N')

  const seq = option(args, '--seq', '0')
  const limit = option(args, '--limit', '1000')
  const { stdout } = await execFileAsync(cli, ['fetch', seq, limit], {
    env: process.env,
    maxBuffer: 20 * 1024 * 1024
  })
  const response = JSON.parse(stdout)
  if (response.errcode !== 0) {
    throw new Error(`GetChatData API failed: ${response.errcode} ${response.errmsg || ''}`.trim())
  }

  const messages = []
  for (const envelope of response.chatdata || []) {
    const key = (await decryptArchiveKey(privateKeyFile, envelope.encrypt_random_key)).toString()
    const decrypted = await execFileAsync(cli, ['decrypt', key, envelope.encrypt_chat_msg], {
      env: process.env,
      maxBuffer: 20 * 1024 * 1024
    })
    const message = JSON.parse(decrypted.stdout)
    if (!message.roomid) continue
    messages.push(normalizeMessage(envelope.seq, message))
  }

  process.stdout.write(JSON.stringify(messages))
}

function decryptArchiveKey(keyFile, encryptedKey) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'openssl',
      ['pkeyutl', '-decrypt', '-inkey', keyFile, '-pkeyopt', 'rsa_padding_mode:pkcs1'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const stdout = []
    const stderr = []
    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(Buffer.concat(stdout))
      else reject(new Error(`RSA key decryption failed: ${Buffer.concat(stderr).toString().trim()}`))
    })
    child.stdin.end(Buffer.from(encryptedKey, 'base64'))
  })
}

export function normalizeMessage(seq, message) {
  const body = message[message.msgtype] || {}
  return {
    msg_id: message.msgid,
    seq: Number(seq),
    group_id: message.roomid,
    sender_id: message.from || '',
    sender_name: message.from || '',
    sent_at: new Date(Number(message.msgtime)).toISOString(),
    msg_type: message.msgtype || 'unknown',
    content: extractContent(message),
    ...(body.sdkfileid ? { media: {
      sdkfileid: body.sdkfileid,
      md5sum: body.md5sum || '',
      filesize: Number(body.filesize || body.voice_size || body.imagesize || body.videosize || 0),
      play_length: Number(body.play_length || 0)
    } } : {})
  }
}

function extractContent(message) {
  if (message.msgtype === 'text') return message.text?.content || ''
  if (message.msgtype === 'markdown') return message.markdown?.content || ''
  if (message.msgtype === 'revoke') return '[撤回消息]'
  if (message.msgtype === 'agree' || message.msgtype === 'disagree') {
    return message[message.msgtype]?.content || `[${message.msgtype}]`
  }
  const body = message[message.msgtype]
  if (body?.filename) return `[${message.msgtype}] ${body.filename}`
  return `[${message.msgtype || 'unknown'}]`
}

function option(args, name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
