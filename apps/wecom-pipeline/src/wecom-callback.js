import crypto from 'node:crypto'
import http from 'node:http'

export function startWeComCallback(config) {
  if (!config.wecomCallbackEnabled) return null
  if (!config.wecomCallbackToken || !config.wecomCallbackAesKey) {
    throw new Error('启用企微回调需要 WECOM_CALLBACK_TOKEN 和 WECOM_CALLBACK_AES_KEY')
  }
  const aesKey = decodeAesKey(config.wecomCallbackAesKey)
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname !== config.wecomCallbackPath) {
      response.writeHead(404).end('not found')
      return
    }
    if (request.method === 'GET') {
      verifyUrl(url, config.wecomCallbackToken, aesKey, response)
      return
    }
    if (request.method === 'POST') {
      // 此端点只用于满足自建应用回调验证；不存储回调消息，也不做被动回复。
      response.writeHead(204).end()
      return
    }
    response.writeHead(405).end('method not allowed')
  })
  server.listen(config.wecomCallbackPort, '0.0.0.0', () => {
    console.log(`[callback] 企微验证端点已监听 0.0.0.0:${config.wecomCallbackPort}${config.wecomCallbackPath}`)
  })
  return server
}

function verifyUrl(url, token, aesKey, response) {
  try {
    const signature = url.searchParams.get('msg_signature') || ''
    const timestamp = url.searchParams.get('timestamp') || ''
    const nonce = url.searchParams.get('nonce') || ''
    const echo = url.searchParams.get('echostr') || ''
    const expected = crypto.createHash('sha1')
      .update([token, timestamp, nonce, echo].sort().join(''))
      .digest('hex')
    const valid = signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    if (!valid) {
      response.writeHead(403).end('invalid signature')
      return
    }
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(decryptEcho(echo, aesKey))
  } catch {
    response.writeHead(400).end('invalid request')
  }
}

function decodeAesKey(value) {
  const key = Buffer.from(`${value}=`, 'base64')
  if (key.length !== 32) throw new Error('WECOM_CALLBACK_AES_KEY 必须是 43 位 EncodingAESKey')
  return key
}

function decryptEcho(value, key) {
  const encrypted = Buffer.from(value, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, key.subarray(0, 16))
  decipher.setAutoPadding(false)
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()])
  const messageLength = plain.readUInt32BE(16)
  return plain.subarray(20, 20 + messageLength).toString('utf8')
}
