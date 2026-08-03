import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function openDatabase(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  migrate(db)
  return db
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      msg_id TEXT PRIMARY KEY,
      seq INTEGER NOT NULL,
      group_id TEXT NOT NULL,
      sender_id TEXT,
      sender_name TEXT,
      sent_at TEXT NOT NULL,
      msg_type TEXT NOT NULL,
      content TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_messages_group_time ON messages(group_id, sent_at);

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      source_msg_id TEXT NOT NULL,
      title TEXT NOT NULL,
      owner TEXT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending_review',
      confidence REAL NOT NULL DEFAULT 0.5,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_msg_id, title)
    );

    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      digest_date TEXT NOT NULL,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      summary TEXT NOT NULL,
      decisions_json TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      todo_count INTEGER NOT NULL,
      message_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, digest_date)
    );

    CREATE TABLE IF NOT EXISTS pipeline_state (
      state_key TEXT PRIMARY KEY,
      state_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export function getState(db, key, fallback = '0') {
  return db.prepare('SELECT state_value FROM pipeline_state WHERE state_key = ?').get(key)?.state_value ?? fallback
}

export function setState(db, key, value) {
  db.prepare(`
    INSERT INTO pipeline_state(state_key, state_value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = CURRENT_TIMESTAMP
  `).run(key, String(value))
}

export function insertMessages(db, messages) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO messages
    (msg_id, seq, group_id, sender_id, sender_name, sent_at, msg_type, content, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  db.exec('BEGIN')
  try {
    for (const item of messages) {
      const result = insert.run(
        item.msg_id, item.seq, item.group_id, item.sender_id || '', item.sender_name || '',
        item.sent_at, item.msg_type, item.content || '', JSON.stringify(item)
      )
      inserted += Number(result.changes)
    }
    db.exec('COMMIT')
    return inserted
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function getSenderNames(db, senderIds) {
  if (!senderIds.length) return {}
  const placeholders = senderIds.map(() => '?').join(',')
  const rows = db.prepare(`SELECT sender_id,max(sender_name) AS sender_name FROM messages
    WHERE sender_id IN (${placeholders}) AND sender_name<>'' AND sender_name<>sender_id GROUP BY sender_id`).all(...senderIds)
  return Object.fromEntries(rows.map(row => [row.sender_id, row.sender_name]))
}

export function updateSenderName(db, senderId, senderName) {
  db.prepare(`UPDATE messages SET sender_name=? WHERE sender_id=? AND (sender_name='' OR sender_name=sender_id)`).run(senderName, senderId)
}

export function listMessages(db, groupId, start, end) {
  return db.prepare(`
    SELECT msg_id, seq, group_id, sender_id, sender_name, sent_at, msg_type, content
    FROM messages
    WHERE group_id = ? AND sent_at >= ? AND sent_at < ?
    ORDER BY sent_at ASC, seq ASC
  `).all(groupId, start, end)
}

export function insertTodos(db, todos) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO todos
    (group_id, source_msg_id, title, owner, due_date, confidence)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  for (const item of todos) {
    inserted += Number(insert.run(
      item.group_id, item.source_msg_id, item.title, item.owner || '',
      item.due_date || '', item.confidence ?? 0.5
    ).changes)
  }
  return inserted
}

export function upsertDigest(db, digest) {
  db.prepare(`
    INSERT INTO digests
    (group_id, digest_date, window_start, window_end, summary, decisions_json, questions_json, todo_count, message_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(group_id, digest_date) DO UPDATE SET
      window_start = excluded.window_start,
      window_end = excluded.window_end,
      summary = excluded.summary,
      decisions_json = excluded.decisions_json,
      questions_json = excluded.questions_json,
      todo_count = excluded.todo_count,
      message_count = excluded.message_count,
      status = 'pending_review',
      created_at = CURRENT_TIMESTAMP
  `).run(
    digest.group_id, digest.digest_date, digest.window_start, digest.window_end,
    digest.summary, JSON.stringify(digest.decisions), JSON.stringify(digest.questions),
    digest.todo_count, digest.message_count
  )
}

export function snapshot(db) {
  return {
    messages: db.prepare('SELECT COUNT(*) AS count FROM messages').get().count,
    todos: db.prepare('SELECT * FROM todos ORDER BY id DESC LIMIT 20').all(),
    digests: db.prepare('SELECT * FROM digests ORDER BY digest_date DESC LIMIT 10').all()
  }
}
