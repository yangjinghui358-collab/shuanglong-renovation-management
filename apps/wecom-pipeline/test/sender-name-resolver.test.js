import assert from 'node:assert/strict'
import test from 'node:test'
import { SenderNameResolver } from '../src/sender-name-resolver.js'

test('resolves missing names and backfills history', async () => {
  const updates = []
  const store = {
    async getSenderNames() { return { known: '已知师傅' } },
    async updateSenderName(_db, id, name) { updates.push([id, name]) }
  }
  const client = { async getSenderName(id) { return id === 'external' ? '客户李姐' : '' } }
  const resolver = new SenderNameResolver({ client, store })
  const result = await resolver.enrich({}, [
    { sender_id: 'known', sender_name: 'known' },
    { sender_id: 'external', sender_name: '' },
    { sender_id: 'invisible', sender_name: '' }
  ])
  assert.deepEqual(result.map(item => item.sender_name), ['已知师傅', '客户李姐', ''])
  assert.deepEqual(updates, [['external', '客户李姐']])
})

test('contact permission failure never blocks message collection', async () => {
  const resolver = new SenderNameResolver({
    client: { async getSenderName() { throw new Error('forbidden') } },
    store: { async getSenderNames() { return {} }, async updateSenderName() {} }
  })
  const input = [{ sender_id: 'outside-scope', sender_name: '' }]
  assert.deepEqual(await resolver.enrich({}, input), input)
})
