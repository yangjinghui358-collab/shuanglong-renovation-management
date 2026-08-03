import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeMessage } from '../scripts/wecom-archive-adapter.mjs'

test('企微群文本消息标准化', () => {
  assert.deepEqual(
    normalizeMessage(18, {
      msgid: 'msg-18',
      roomid: 'wr-room',
      from: 'zhangsan',
      msgtime: 1721694600000,
      msgtype: 'text',
      text: { content: '请明天下午五点前提交名单' }
    }),
    {
      msg_id: 'msg-18',
      seq: 18,
      group_id: 'wr-room',
      sender_id: 'zhangsan',
      sender_name: 'zhangsan',
      sent_at: '2024-07-23T00:30:00.000Z',
      msg_type: 'text',
      content: '请明天下午五点前提交名单'
    }
  )
})
