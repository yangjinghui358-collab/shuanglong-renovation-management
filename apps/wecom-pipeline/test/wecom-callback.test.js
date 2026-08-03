import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { startWeComCallback } from '../src/wecom-callback.js'

test('企微回调拒绝无效签名', async () => {
  const aesKey = crypto.randomBytes(32).toString('base64').slice(0, 43)
  const server = startWeComCallback({
    wecomCallbackEnabled: true,
    wecomCallbackPort: 0,
    wecomCallbackPath: '/wecom/callback',
    wecomCallbackToken: 'test-token',
    wecomCallbackAesKey: aesKey
  })
  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/wecom/callback?msg_signature=bad`)
  assert.equal(response.status, 403)
  await new Promise(resolve => server.close(resolve))
})
