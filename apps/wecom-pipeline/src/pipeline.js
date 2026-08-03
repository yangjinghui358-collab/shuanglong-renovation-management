import { analyzeMessages } from './analyzer.js'
import { formatDigestForGroup } from './wecom-client.js'

export async function collectMessages(db, provider, store, senderNameResolver = null) {
  const lastSeq = Number(await store.getState(db, 'archive_seq', '0'))
  let messages = await provider.fetchAfter(lastSeq)
  validateMessages(messages)
  if (senderNameResolver) messages = await senderNameResolver.enrich(db, messages)
  const inserted = await store.insertMessages(db, messages)
  const maxSeq = messages.reduce((max, item) => Math.max(max, Number(item.seq)), lastSeq)
  if (maxSeq > lastSeq) await store.setState(db, 'archive_seq', maxSeq)
  return { fetched: messages.length, inserted, lastSeq: maxSeq }
}

export async function createDigestGroupSendTask(db, config, digest, store, client) {
  if (!config.wecomGroupSendEnabled) return { skipped: true, reason: 'disabled' }
  const stateKey = `group_send:${digest.group_id}:${digest.digest_date}`
  const existing = await store.getState(db, stateKey, '')
  if (existing) return { skipped: true, reason: 'already_created', delivery: JSON.parse(existing) }
  const result = await client.createGroupMessageTask({
    sender: config.wecomSenderUserId,
    content: formatDigestForGroup(digest)
  })
  const delivery = {
    msgid: result.msgid,
    fail_list: result.failList,
    created_at: new Date().toISOString()
  }
  await store.setState(db, stateKey, JSON.stringify(delivery))
  return { skipped: false, delivery }
}

export async function pushDigestToPersonalWeChat(db, config, digest, store, client) {
  if (!config.pushplusEnabled) return { skipped: true, reason: 'disabled' }
  const stateKey = `pushplus:${digest.group_id}:${digest.digest_date}`
  const existing = await store.getState(db, stateKey, '')
  if (existing) return { skipped: true, reason: 'already_sent', delivery: JSON.parse(existing) }
  const result = await client.sendDigest(digest)
  const delivery = {
    message_id: result.messageId,
    sent_at: new Date().toISOString()
  }
  await store.setState(db, stateKey, JSON.stringify(delivery))
  return { skipped: false, delivery }
}

export async function buildDigest(db, config, digestDate, windowStart, windowEnd, store) {
  const messages = await store.listMessages(db, config.groupId, windowStart, windowEnd)
  const analysis = await analyzeMessages(messages, config)
  const todos = analysis.todos.map(item => ({ ...item, group_id: config.groupId }))
  const insertedTodos = await store.insertTodos(db, todos)
  const digest = {
    group_id: config.groupId,
    digest_date: digestDate,
    window_start: windowStart,
    window_end: windowEnd,
    summary: analysis.summary,
    highlights: analysis.highlights || [],
    decisions: analysis.decisions,
    questions: analysis.questions,
    todos,
    todo_count: todos.length,
    message_count: messages.length
  }
  await store.upsertDigest(db, digest)
  return { digest, insertedTodos }
}

function validateMessages(messages) {
  if (!Array.isArray(messages)) throw new Error('采集结果必须是数组')
  for (const item of messages) {
    for (const field of ['msg_id', 'seq', 'group_id', 'sent_at', 'msg_type']) {
      if (item[field] === undefined || item[field] === '') throw new Error(`消息缺少字段 ${field}`)
    }
    if (Number.isNaN(Date.parse(item.sent_at))) throw new Error(`无效消息时间: ${item.sent_at}`)
  }
}
