import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeMessage } from '../scripts/wecom-archive-adapter.mjs'

test('企微语音消息保留媒体下载信息', () => {
  const result = normalizeMessage(12, {
    msgid: 'voice-1', roomid: 'group-1', msgtime: 1000, from: 'user-1', msgtype: 'voice',
    voice: { sdkfileid: 'file-1', md5sum: 'abc', voice_size: 2048, play_length: 3 }
  })
  assert.deepEqual(result.media, {
    sdkfileid: 'file-1', md5sum: 'abc', filesize: 2048, play_length: 3
  })
})
