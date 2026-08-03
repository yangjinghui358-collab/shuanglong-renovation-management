import assert from 'node:assert/strict'
import test from 'node:test'
import { PushPlusClient } from '../src/pushplus-client.js'

test('PushPlus 使用微信渠道发送简报', async () => {
  let request
  const client = new PushPlusClient({
    token: 'test-token',
    fetchImpl: async (url, init) => {
      request = { url, init }
      return { ok: true, status: 200, json: async () => ({ code: 200, msg: '请求成功', data: 'message-1' }) }
    }
  })
  const result = await client.sendDigest({
    digest_date: '2026-07-26',
    summary: '测试摘要',
    highlights: ['重点一'],
    decisions: [],
    questions: [],
    todos: [{ title: '跟进客户', owner: '张三', due_date: '明天' }],
    todo_count: 1,
    message_count: 1
  })
  const body = JSON.parse(request.init.body)
  assert.equal(body.channel, 'wechat')
  assert.equal(body.token, 'test-token')
  assert.match(body.content, /测试摘要/)
  assert.match(body.content, /重点一/)
  assert.match(body.content, /跟进客户/)
  assert.doesNotMatch(body.content, /企微|确认发送/)
  assert.equal(result.messageId, 'message-1')
})
