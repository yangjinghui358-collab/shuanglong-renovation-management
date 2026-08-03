import pg from 'pg'

const { Pool } = pg

export async function openPostgresDatabase(config) {
  if (!config.postgresUrl) throw new Error('DATABASE_DRIVER=postgres 时必须配置 POSTGRES_URL')
  const pool = new Pool({ connectionString: config.postgresUrl, max: 5 })
  await pool.query('SELECT 1')
  await migrate(pool)
  return pool
}

async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      msg_id TEXT PRIMARY KEY,
      seq BIGINT NOT NULL,
      group_id TEXT NOT NULL,
      sender_id TEXT NOT NULL DEFAULT '',
      sender_name TEXT NOT NULL DEFAULT '',
      sent_at TIMESTAMPTZ NOT NULL,
      msg_type TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_group_time ON messages(group_id, sent_at);
    CREATE INDEX IF NOT EXISTS idx_messages_seq ON messages(seq);

    CREATE TABLE IF NOT EXISTS todos (
      id BIGSERIAL PRIMARY KEY,
      group_id TEXT NOT NULL,
      source_msg_id TEXT NOT NULL,
      title TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_review',
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(source_msg_id, title)
    );
    CREATE INDEX IF NOT EXISTS idx_todos_group_status ON todos(group_id, status, created_at DESC);

    CREATE TABLE IF NOT EXISTS digests (
      id BIGSERIAL PRIMARY KEY,
      group_id TEXT NOT NULL,
      digest_date TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      window_end TIMESTAMPTZ NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
      decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
      questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      todos JSONB NOT NULL DEFAULT '[]'::jsonb,
      todo_count INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_review',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(group_id, digest_date)
    );

    CREATE TABLE IF NOT EXISTS pipeline_state (
      state_key TEXT PRIMARY KEY,
      state_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS media (
      media_id BIGSERIAL PRIMARY KEY,
      msg_id TEXT NOT NULL REFERENCES messages(msg_id) ON DELETE CASCADE,
      group_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      local_path TEXT NOT NULL DEFAULT '',
      sha256 TEXT NOT NULL DEFAULT '',
      size_bytes BIGINT NOT NULL DEFAULT 0,
      transcript TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_download',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(msg_id, media_type)
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id BIGSERIAL PRIMARY KEY,
      group_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      owner TEXT NOT NULL DEFAULT '',
      event_date TEXT NOT NULL DEFAULT '',
      source_msg_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_events_group_status ON events(group_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS event_progress (
      progress_id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      source_msg_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS analysis_jobs (
      job_id BIGSERIAL PRIMARY KEY,
      group_id TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      window_end TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      locked_at TIMESTAMPTZ,
      error TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(group_id, window_start, window_end)
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      run_id BIGSERIAL PRIMARY KEY,
      job_id BIGINT REFERENCES analysis_jobs(job_id) ON DELETE SET NULL,
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      input_message_count INTEGER NOT NULL DEFAULT 0,
      error TEXT NOT NULL DEFAULT '',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS risks (
      risk_id BIGSERIAL PRIMARY KEY,
      group_id TEXT NOT NULL,
      project_name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      risk_type TEXT NOT NULL DEFAULT '其他',
      description TEXT NOT NULL DEFAULT '',
      risk_level TEXT NOT NULL DEFAULT '中',
      owner TEXT NOT NULL DEFAULT '',
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      recommendation TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '待处理',
      due_at TIMESTAMPTZ,
      source_msg_id TEXT NOT NULL DEFAULT '',
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(source_msg_id, title)
    );
    CREATE INDEX IF NOT EXISTS idx_risks_group_status ON risks(group_id,status,updated_at DESC);

    ALTER TABLE todos ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT '';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT '高';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS reasoning TEXT NOT NULL DEFAULT '';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS construction_location TEXT NOT NULL DEFAULT '';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT '';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS planned_start TIMESTAMPTZ;
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS planned_end TIMESTAMPTZ;
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ;
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ;
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS predecessor TEXT NOT NULL DEFAULT '';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS acceptance_node TEXT NOT NULL DEFAULT '';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS crew TEXT NOT NULL DEFAULT '';
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS delay_reason TEXT NOT NULL DEFAULT '';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT '客户需求';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS conclusion TEXT NOT NULL DEFAULT '';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT '中';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS follow_up TEXT NOT NULL DEFAULT '是';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_chat TEXT NOT NULL DEFAULT '';
    ALTER TABLE digests ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE media ADD COLUMN IF NOT EXISTS sdkfileid TEXT NOT NULL DEFAULT '';
    ALTER TABLE media ADD COLUMN IF NOT EXISTS source_format TEXT NOT NULL DEFAULT '';
    ALTER TABLE media ADD COLUMN IF NOT EXISTS error TEXT NOT NULL DEFAULT '';
    ALTER TABLE media ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS group_projects (
      group_id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      default_location TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_profiles (
      agent_id BIGSERIAL PRIMARY KEY,
      agent_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS industry_terms (
      term_id BIGSERIAL PRIMARY KEY,
      term TEXT NOT NULL UNIQUE,
      aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
      definition TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '通用',
      examples JSONB NOT NULL DEFAULT '[]'::jsonb,
      source TEXT NOT NULL DEFAULT 'human',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_industry_terms_category ON industry_terms(category,enabled);

    CREATE TABLE IF NOT EXISTS prompt_versions (
      prompt_id BIGSERIAL PRIMARY KEY,
      agent_key TEXT NOT NULL,
      version INTEGER NOT NULL,
      system_prompt TEXT NOT NULL,
      output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft',
      change_note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(agent_key,version)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_one_active
      ON prompt_versions(agent_key) WHERE status='active';

    CREATE TABLE IF NOT EXISTS ai_drafts (
      draft_id BIGSERIAL PRIMARY KEY,
      dedupe_key TEXT NOT NULL UNIQUE,
      agent_key TEXT NOT NULL DEFAULT 'project_manager',
      project_name TEXT NOT NULL DEFAULT '',
      group_id TEXT NOT NULL DEFAULT '',
      module_type TEXT NOT NULL,
      title TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK(confidence>=0 AND confidence<=1),
      ai_reasoning TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK(status IN ('pending_review','approved','rejected','superseded')),
      prompt_id BIGINT REFERENCES prompt_versions(prompt_id) ON DELETE SET NULL,
      model TEXT NOT NULL DEFAULT '',
      reviewer_id TEXT NOT NULL DEFAULT '',
      reviewed_at TIMESTAMPTZ,
      approved_record_type TEXT NOT NULL DEFAULT '',
      approved_record_id TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_drafts_review ON ai_drafts(status,module_type,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_drafts_project ON ai_drafts(project_name,created_at DESC);

    CREATE TABLE IF NOT EXISTS ai_draft_sources (
      draft_id BIGINT NOT NULL REFERENCES ai_drafts(draft_id) ON DELETE CASCADE,
      msg_id TEXT NOT NULL REFERENCES messages(msg_id) ON DELETE RESTRICT,
      excerpt TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(draft_id,msg_id)
    );

    CREATE TABLE IF NOT EXISTS agent_feedback (
      feedback_id BIGSERIAL PRIMARY KEY,
      draft_id BIGINT REFERENCES ai_drafts(draft_id) ON DELETE SET NULL,
      action TEXT NOT NULL CHECK(action IN ('approved','edited','rejected','term_added')),
      before_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      correction_note TEXT NOT NULL DEFAULT '',
      reviewer_id TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_agent_feedback_draft ON agent_feedback(draft_id,created_at DESC);

    CREATE TABLE IF NOT EXISTS ai_api_calls (
      call_id BIGSERIAL PRIMARY KEY,
      agent_key TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      input_message_count INTEGER NOT NULL DEFAULT 0,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      latency_ms INTEGER,
      error_code TEXT NOT NULL DEFAULT '',
      error_message TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_api_calls_created ON ai_api_calls(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_media_status_created ON media(status,created_at);

    INSERT INTO agent_profiles(agent_key,name,description,settings)
    VALUES('project_manager','双龙装饰项目管理 Agent','从企微聊天中提取待审核的项目、任务、进度、风险、材料、验收和客户需求',
      '{"write_policy":"draft_only","human_approval_required":true}'::jsonb)
    ON CONFLICT(agent_key) DO NOTHING;

    INSERT INTO prompt_versions(agent_key,version,system_prompt,output_schema,status,change_note,created_by)
    VALUES('project_manager',1,
      '你是装修施工项目管理助手。只根据聊天证据生成待审核候选，不得直接修改正式业务数据；不确定的信息必须留空并降低置信度。',
      '{"type":"object","required":["drafts"],"properties":{"drafts":{"type":"array"}}}'::jsonb,
      'active','初始受控审核版本','system')
    ON CONFLICT(agent_key,version) DO NOTHING;
  `)
}

export async function getState(db, key, fallback = '0') {
  const result = await db.query('SELECT state_value FROM pipeline_state WHERE state_key=$1', [key])
  return result.rows[0]?.state_value ?? fallback
}

export async function setState(db, key, value) {
  await db.query(`INSERT INTO pipeline_state(state_key,state_value,updated_at) VALUES($1,$2,NOW())
    ON CONFLICT(state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW()`, [key, String(value)])
}

export async function insertMessages(db, messages) {
  let inserted = 0
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const item of messages) {
      const result = await client.query(`INSERT INTO messages
        (msg_id,seq,group_id,sender_id,sender_name,sent_at,msg_type,content,raw_json)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(msg_id) DO NOTHING`, [
        item.msg_id, Number(item.seq), item.group_id, item.sender_id || '', item.sender_name || '',
        new Date(item.sent_at), item.msg_type, item.content || '', item
      ])
      inserted += result.rowCount
    }
    await client.query('COMMIT')
    return inserted
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listMessages(db, groupId, start, end) {
  const result = await db.query(`SELECT msg_id,seq,group_id,sender_id,sender_name,sent_at,msg_type,content
    FROM messages WHERE group_id=$1 AND sent_at >= $2 AND sent_at < $3 ORDER BY sent_at,seq`, [groupId, new Date(start), new Date(end)])
  return result.rows.map(item => ({ ...item, seq: Number(item.seq), sent_at: item.sent_at.toISOString() }))
}

export async function insertTodos(db, todos) {
  let inserted = 0
  for (const item of todos) {
    const result = await db.query(`INSERT INTO todos(group_id,source_msg_id,title,owner,due_date,status,confidence)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source_msg_id,title) DO NOTHING`, [
      item.group_id, item.source_msg_id, item.title, item.owner || '', item.due_date || '',
      item.status || 'pending_review', item.confidence ?? 0.5
    ])
    inserted += result.rowCount
  }
  return inserted
}

export async function upsertDigest(db, digest) {
  await db.query(`INSERT INTO digests(group_id,digest_date,window_start,window_end,summary,highlights,decisions,questions,todos,todo_count,message_count,status,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
    ON CONFLICT(group_id,digest_date) DO UPDATE SET window_start=EXCLUDED.window_start,window_end=EXCLUDED.window_end,
    summary=EXCLUDED.summary,highlights=EXCLUDED.highlights,decisions=EXCLUDED.decisions,questions=EXCLUDED.questions,
    todos=EXCLUDED.todos,todo_count=EXCLUDED.todo_count,message_count=EXCLUDED.message_count,status=EXCLUDED.status,updated_at=NOW()`, [
    digest.group_id, digest.digest_date, new Date(digest.window_start), new Date(digest.window_end), digest.summary || '',
    JSON.stringify(digest.highlights || []), JSON.stringify(digest.decisions || []), JSON.stringify(digest.questions || []),
    JSON.stringify(digest.todos || []), digest.todo_count || 0, digest.message_count || 0, digest.status || 'pending_review'
  ])
}

export async function snapshot(db) {
  const [messages, todos, digests] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM messages'),
    db.query('SELECT * FROM todos ORDER BY created_at DESC LIMIT 20'),
    db.query('SELECT * FROM digests ORDER BY digest_date DESC LIMIT 10')
  ])
  return { messages: messages.rows[0].count, todos: todos.rows, digests: digests.rows }
}
