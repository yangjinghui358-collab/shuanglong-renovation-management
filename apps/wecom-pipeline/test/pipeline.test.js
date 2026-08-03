import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createArchiveProvider } from '../src/archive-provider.js'
import * as store from '../src/database.js'
import { openDatabase } from '../src/database.js'
import { buildDigest, collectMessages } from '../src/pipeline.js'

test('采集、去重、待办提取和简报生成链路', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wecom-pipeline-'))
  const fixture = path.resolve('fixtures/messages.json')
  const config = {
    archiveProvider: 'mock',
    mockArchiveFile: fixture,
    groupId: 'demo-group-01',
    aiBaseUrl: '',
    aiApiKey: '',
    aiModel: ''
  }
  const db = openDatabase(path.join(root, 'test.db'))
  const provider = createArchiveProvider(config)

  const first = await collectMessages(db, provider, store)
  const second = await collectMessages(db, provider, store)
  assert.equal(first.inserted, 3)
  assert.equal(second.inserted, 0)

  const result = await buildDigest(
    db,
    config,
    '2026-07-23',
    '2026-07-23T00:00:00+08:00',
    '2026-07-23T23:59:59+08:00',
    store
  )
  assert.equal(result.digest.message_count, 3)
  assert.ok(result.digest.todo_count >= 2)

  const data = await store.snapshot(db)
  assert.equal(data.messages, 3)
  assert.equal(data.digests.length, 1)
  assert.ok(data.todos.length >= 2)
  db.close()
})
