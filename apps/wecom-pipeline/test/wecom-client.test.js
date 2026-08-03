import assert from 'node:assert/strict'
import test from 'node:test'
import { WeComClient, formatDigestForGroup } from '../src/wecom-client.js'

test('获取 token 后创建客户群群发任务', async () => {
  const calls = []
  const responses = [
    { access_token: 'token-for-test', expires_in: 7200, errcode: 0 },
    { errcode: 0, errmsg: 'ok', msgid: 'msg-1', fail_list: ['user-x'] }
  ]
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init })
    return { ok: true, status: 200, json: async () => responses.shift() }
  }
  const client = new WeComClient({ corpId: 'corp', secret: 'secret', fetchImpl })
  const result = await client.createGroupMessageTask({ sender: 'owner', content: '简报' })
  assert.deepEqual(result, { msgid: 'msg-1', failList: ['user-x'] })
  assert.match(calls[0].url, /gettoken/)
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    chat_type: 'group',
    sender: 'owner',
    text: { content: '简报' }
  })
})

test('简报文本包含确认提示和核心统计', () => {
  const text = formatDigestForGroup({
    digest_date: '2026-07-26',
    summary: '今日摘要',
    decisions: ['事项一'],
    questions: [],
    todo_count: 2,
    message_count: 8
  })
  assert.match(text, /今日摘要/)
  assert.match(text, /待办：2 项/)
  assert.match(text, /群主.*确认发送/)
})
