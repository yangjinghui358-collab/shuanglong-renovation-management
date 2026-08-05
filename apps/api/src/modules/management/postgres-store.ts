import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  AgentCandidate,
  AuthUser,
  CandidateModule,
  ManagementStore,
} from "./types";

function candidate(row: any): AgentCandidate {
  return {
    id: row.id,
    module: row.target_module,
    kind: row.kind,
    payload: row.payload,
    confidence: Number(row.confidence),
    status: row.status,
    version: row.version,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class PostgresManagementStore implements ManagementStore {
  constructor(private readonly pool: Pool) {}
  async initialize(): Promise<void> {
    await this.pool.query(`
    CREATE TABLE IF NOT EXISTS management_users (id uuid PRIMARY KEY, phone text UNIQUE NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('owner','management','employee')), must_change_password boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS management_sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES management_users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS agent_candidates (id uuid PRIMARY KEY, source_key text UNIQUE NOT NULL, target_module text NOT NULL CHECK(target_module IN ('projects','procurement','crm')), kind text NOT NULL, payload jsonb NOT NULL, confidence numeric(4,3) NOT NULL, status text NOT NULL DEFAULT 'pending_review', version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz);
    CREATE TABLE IF NOT EXISTS module_records (id uuid PRIMARY KEY, candidate_id uuid UNIQUE NOT NULL REFERENCES agent_candidates(id), target_module text NOT NULL, kind text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS review_decisions (id uuid PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES agent_candidates(id), actor_id uuid NOT NULL REFERENCES management_users(id), decision text NOT NULL, reason text, payload jsonb, idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS audit_entries (id uuid PRIMARY KEY, actor_id uuid, action text NOT NULL, object_type text NOT NULL, object_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS agent_run_requests (id uuid PRIMARY KEY, agent_key text NOT NULL CHECK(agent_key IN ('chat_archive','todo_reminder','owner_alert')), requested_by uuid NOT NULL REFERENCES management_users(id), status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed')), result jsonb NOT NULL DEFAULT '{}'::jsonb, error text NOT NULL DEFAULT '', requested_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz);
    CREATE TABLE IF NOT EXISTS sender_aliases (sender_id text PRIMARY KEY,display_name text NOT NULL,updated_by uuid NOT NULL REFERENCES management_users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS module_entity_overrides (target_module text NOT NULL,entity_key text NOT NULL,payload jsonb NOT NULL,updated_by uuid NOT NULL REFERENCES management_users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(target_module,entity_key));
    CREATE TABLE IF NOT EXISTS interface_text_settings (text_key text PRIMARY KEY, text_value text NOT NULL, updated_by uuid NOT NULL REFERENCES management_users(id), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS agent_learning_feedback (id uuid PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES agent_candidates(id), source_key text NOT NULL, action text NOT NULL CHECK(action IN ('corrected','approved','rejected')), before_module text NOT NULL, before_kind text NOT NULL, before_payload jsonb NOT NULL, after_module text, after_kind text, after_payload jsonb, correction_note text NOT NULL DEFAULT '', actor_id uuid NOT NULL REFERENCES management_users(id), created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS idx_agent_candidates_status_created ON agent_candidates(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_run_requests_status_time ON agent_run_requests(status, requested_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_learning_created ON agent_learning_feedback(created_at DESC);
    ALTER TABLE agent_candidates DROP CONSTRAINT IF EXISTS agent_candidates_target_module_check;
    ALTER TABLE agent_candidates ADD CONSTRAINT agent_candidates_target_module_check CHECK(target_module IN ('projects','procurement','crm','finance','inventory','tasks','alerts'));
    ALTER TABLE management_users DROP CONSTRAINT IF EXISTS management_users_role_check;
    ALTER TABLE management_users ADD CONSTRAINT management_users_role_check CHECK(role IN ('owner','management','employee'));
    DELETE FROM management_sessions WHERE expires_at <= now();
  `);
  }
  async bootstrapOwner(phone: string, passwordHash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO management_users(id,phone,password_hash,role) VALUES($1,$2,$3,'owner') ON CONFLICT(phone) DO NOTHING`,
      [randomUUID(), phone, passwordHash],
    );
  }
  async createUser(
    phone: string,
    passwordHash: string,
    role: "management" | "employee",
  ) {
    const r = await this.pool.query(
      `INSERT INTO management_users(id,phone,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,phone,role,must_change_password`,
      [randomUUID(), phone, passwordHash, role],
    );
    const x = r.rows[0];
    return {
      id: x.id,
      phone: x.phone,
      role: x.role,
      mustChangePassword: x.must_change_password,
    };
  }
  async listUsers() {
    const r = await this.pool.query(
      `SELECT id,phone,role,must_change_password FROM management_users ORDER BY created_at`,
    );
    return r.rows.map((x) => ({
      id: x.id,
      phone: x.phone,
      role: x.role,
      mustChangePassword: x.must_change_password,
    }));
  }
  async findUserByPhone(phone: string) {
    const r = await this.pool.query(
      `SELECT id,phone,password_hash,role,must_change_password FROM management_users WHERE phone=$1`,
      [phone],
    );
    const x = r.rows[0];
    return x
      ? {
          id: x.id,
          phone: x.phone,
          passwordHash: x.password_hash,
          role: x.role,
          mustChangePassword: x.must_change_password,
        }
      : null;
  }
  async createSession(userId: string, hash: string, expires: Date) {
    await this.pool.query(
      `INSERT INTO management_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)`,
      [hash, userId, expires],
    );
  }
  async findSession(hash: string): Promise<AuthUser | null> {
    const r = await this.pool.query(
      `SELECT u.id,u.phone,u.role,u.must_change_password FROM management_sessions s JOIN management_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
      [hash],
    );
    const x = r.rows[0];
    return x
      ? {
          id: x.id,
          phone: x.phone,
          role: x.role,
          mustChangePassword: x.must_change_password,
        }
      : null;
  }
  async deleteSession(hash: string) {
    await this.pool.query(
      `DELETE FROM management_sessions WHERE token_hash=$1`,
      [hash],
    );
  }
  async changePassword(userId: string, passwordHash: string) {
    await this.pool.query(
      `UPDATE management_users SET password_hash=$2,must_change_password=false WHERE id=$1`,
      [userId, passwordHash],
    );
  }
  async createCandidate(
    input: Omit<AgentCandidate, "id" | "status" | "version" | "createdAt">,
    sourceKey: string,
  ) {
    const r = await this.pool.query(
      `INSERT INTO agent_candidates(id,source_key,target_module,kind,payload,confidence) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(source_key) DO UPDATE SET source_key=excluded.source_key RETURNING *`,
      [
        randomUUID(),
        sourceKey,
        input.module,
        input.kind,
        input.payload,
        input.confidence,
      ],
    );
    return candidate(r.rows[0]);
  }
  async createReviewCandidates(
    inputs: Array<
      Omit<AgentCandidate, "id" | "status" | "version" | "createdAt">
    >,
    actorId: string,
    source: "manual" | "spreadsheet",
  ) {
    return this.transaction(async (c) => {
      const items: AgentCandidate[] = [];
      for (const input of inputs) {
        const r = await c.query(
          `INSERT INTO agent_candidates(id,source_key,target_module,kind,payload,confidence) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
          [
            randomUUID(),
            `${source}:${actorId}:${randomUUID()}`,
            input.module,
            input.kind,
            input.payload,
            input.confidence,
          ],
        );
        items.push(candidate(r.rows[0]));
      }
      await c.query(
        `INSERT INTO audit_entries(id,actor_id,action,object_type,object_id,details) VALUES($1,$2,'candidate.batch_created','agent_candidate_batch',$3,$4)`,
        [randomUUID(), actorId, randomUUID(), { source, count: items.length }],
      );
      return items;
    });
  }
  async listCandidates() {
    const r = await this.pool.query(
      `SELECT * FROM agent_candidates WHERE status='pending_review' ORDER BY created_at DESC`,
    );
    return r.rows.map(candidate);
  }
  async findCandidate(id: string) {
    const r = await this.pool.query(
      `SELECT * FROM agent_candidates WHERE id=$1`,
      [id],
    );
    return r.rows[0] ? candidate(r.rows[0]) : null;
  }
  async updateCandidate(
    id: string,
    version: number,
    input: Pick<AgentCandidate, "module" | "kind" | "payload">,
    actorId: string,
  ) {
    return this.transaction(async (c) => {
      const r = await c.query(
        `SELECT * FROM agent_candidates WHERE id=$1 FOR UPDATE`,
        [id],
      );
      const x = r.rows[0];
      if (!x || x.status !== "pending_review" || x.version !== version)
        throw new Error("候选状态或版本已变化");
      const u = await c.query(
        `UPDATE agent_candidates SET target_module=$2,kind=$3,payload=$4,version=version+1 WHERE id=$1 RETURNING *`,
        [id, input.module, input.kind, input.payload],
      );
      await c.query(
        `INSERT INTO audit_entries(id,actor_id,action,object_type,object_id,details) VALUES($1,$2,'candidate.updated','agent_candidate',$3,$4)`,
        [
          randomUUID(),
          actorId,
          id,
          {
            fromModule: x.target_module,
            toModule: input.module,
            fromKind: x.kind,
            toKind: input.kind,
          },
        ],
      );
      return candidate(u.rows[0]);
    });
  }
  async correctCandidate(
    id: string,
    version: number,
    input: Pick<AgentCandidate, "module" | "kind" | "payload">,
    actorId: string,
    correctionNote: string,
  ) {
    return this.transaction(async (c) => {
      const r = await c.query(`SELECT * FROM agent_candidates WHERE id=$1 FOR UPDATE`, [id]);
      const x = r.rows[0];
      if (!x || x.status !== "pending_review" || x.version !== version)
        throw new Error("候选状态或版本已变化");
      const u = await c.query(
        `UPDATE agent_candidates SET target_module=$2,kind=$3,payload=$4,version=version+1 WHERE id=$1 RETURNING *`,
        [id, input.module, input.kind, input.payload],
      );
      await c.query(
        `INSERT INTO agent_learning_feedback(id,candidate_id,source_key,action,before_module,before_kind,before_payload,after_module,after_kind,after_payload,correction_note,actor_id) VALUES($1,$2,$3,'corrected',$4,$5,$6,$7,$8,$9,$10,$11)`,
        [randomUUID(), id, x.source_key, x.target_module, x.kind, x.payload, input.module, input.kind, input.payload, correctionNote, actorId],
      );
      await c.query(
        `INSERT INTO audit_entries(id,actor_id,action,object_type,object_id,details) VALUES($1,$2,'candidate.agent_corrected','agent_candidate',$3,$4)`,
        [randomUUID(), actorId, id, { correctionNote, fromModule: x.target_module, toModule: input.module, fromKind: x.kind, toKind: input.kind }],
      );
      return candidate(u.rows[0]);
    });
  }
  async confirmCandidate(
    id: string,
    version: number,
    key: string,
    actorId: string,
    payload?: Record<string, unknown>,
  ) {
    return this.transaction(async (c) => {
      const r = await c.query(
        `SELECT * FROM agent_candidates WHERE id=$1 FOR UPDATE`,
        [id],
      );
      const x = r.rows[0];
      if (!x || x.status !== "pending_review" || x.version !== version)
        throw new Error("候选状态或版本已变化");
      const finalPayload = payload ?? x.payload;
      await c.query(
        `INSERT INTO review_decisions(id,candidate_id,actor_id,decision,payload,idempotency_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(idempotency_key) DO NOTHING`,
        [
          randomUUID(),
          id,
          actorId,
          payload ? "edited_and_confirmed" : "confirmed",
          finalPayload,
          key,
        ],
      );
      await c.query(
        `INSERT INTO module_records(id,candidate_id,target_module,kind,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(candidate_id) DO NOTHING`,
        [randomUUID(), id, x.target_module, x.kind, finalPayload],
      );
      const u = await c.query(
        `UPDATE agent_candidates SET status='projected',version=version+1,reviewed_at=now() WHERE id=$1 RETURNING *`,
        [id],
      );
      await c.query(
        `INSERT INTO audit_entries(id,actor_id,action,object_type,object_id,details) VALUES($1,$2,'candidate.projected','agent_candidate',$3,$4)`,
        [randomUUID(), actorId, id, { module: x.target_module, kind: x.kind }],
      );
      await c.query(
        `INSERT INTO agent_learning_feedback(id,candidate_id,source_key,action,before_module,before_kind,before_payload,after_module,after_kind,after_payload,actor_id) VALUES($1,$2,$3,'approved',$4,$5,$6,$4,$5,$7,$8)`,
        [randomUUID(), id, x.source_key, x.target_module, x.kind, x.payload, finalPayload, actorId],
      );
      return candidate(u.rows[0]);
    });
  }
  async rejectCandidate(
    id: string,
    version: number,
    actorId: string,
    reason: string,
  ) {
    return this.transaction(async (c) => {
      const u = await c.query(
        `UPDATE agent_candidates SET status='rejected',version=version+1,reviewed_at=now() WHERE id=$1 AND version=$2 AND status='pending_review' RETURNING *`,
        [id, version],
      );
      if (!u.rows[0]) throw new Error("候选状态或版本已变化");
      await c.query(
        `INSERT INTO review_decisions(id,candidate_id,actor_id,decision,reason) VALUES($1,$2,$3,'rejected',$4)`,
        [randomUUID(), id, actorId, reason],
      );
      const x = u.rows[0];
      await c.query(
        `INSERT INTO agent_learning_feedback(id,candidate_id,source_key,action,before_module,before_kind,before_payload,correction_note,actor_id) VALUES($1,$2,$3,'rejected',$4,$5,$6,$7,$8)`,
        [randomUUID(), id, x.source_key, x.target_module, x.kind, x.payload, reason, actorId],
      );
      return candidate(u.rows[0]);
    });
  }
  async listAgentLearning(limit: number) {
    const r = await this.pool.query(
      `SELECT id,source_key,action,before_module,before_kind,before_payload,after_module,after_kind,after_payload,correction_note,created_at FROM agent_learning_feedback ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return r.rows;
  }
  async listModuleRecords(module: CandidateModule) {
    const r = await this.pool.query(
      `SELECT id,candidate_id,kind,payload,created_at FROM module_records WHERE target_module=$1 ORDER BY created_at DESC`,
      [module],
    );
    return r.rows;
  }
  async updateModuleRecord(
    id: string,
    module: CandidateModule,
    kind: string,
    payload: Record<string, unknown>,
    actorId: string,
  ) {
    return this.transaction(async (c) => {
      const u = await c.query(
        `UPDATE module_records SET kind=$3,payload=$4 WHERE id=$1 AND target_module=$2 RETURNING id,candidate_id,kind,payload,created_at`,
        [id, module, kind, payload],
      );
      if (!u.rows[0]) throw new Error("正式记录不存在");
      await c.query(
        `INSERT INTO audit_entries(id,actor_id,action,object_type,object_id,details) VALUES($1,$2,'module_record.updated','module_record',$3,$4)`,
        [randomUUID(), actorId, id, { module, kind }],
      );
      return u.rows[0];
    });
  }
  async getModuleEntityOverrides(module: CandidateModule) {
    const r = await this.pool.query(
      `SELECT entity_key,payload FROM module_entity_overrides WHERE target_module=$1`,
      [module],
    );
    return Object.fromEntries(
      r.rows.map((row) => [row.entity_key, row.payload]),
    );
  }
  async upsertModuleEntityOverride(
    module: CandidateModule,
    entityKey: string,
    payload: Record<string, unknown>,
    actorId: string,
  ) {
    return this.transaction(async (c) => {
      const r = await c.query(
        `INSERT INTO module_entity_overrides(target_module,entity_key,payload,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(target_module,entity_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=now() RETURNING entity_key,payload,updated_at`,
        [module, entityKey, payload, actorId],
      );
      await c.query(
        `INSERT INTO audit_entries(id,actor_id,action,object_type,object_id,details) VALUES($1,$2,'module_entity.updated','module_entity',$3,$4)`,
        [randomUUID(), actorId, `${module}:${entityKey}`, { module }],
      );
      return r.rows[0];
    });
  }
  async queueAgentRun(
    agentKey: "chat_archive" | "todo_reminder" | "owner_alert",
    actorId: string,
  ) {
    const r = await this.pool.query(
      `INSERT INTO agent_run_requests(id,agent_key,requested_by) VALUES($1,$2,$3) RETURNING id,agent_key,status,requested_at`,
      [randomUUID(), agentKey, actorId],
    );
    return r.rows[0];
  }
  async listAgentRuns() {
    const r = await this.pool.query(
      `SELECT id,agent_key,status,result,error,requested_at,started_at,finished_at FROM agent_run_requests ORDER BY requested_at DESC LIMIT 30`,
    );
    return r.rows;
  }
  async getSenderAliases(senderIds: string[]) {
    if (!senderIds.length) return {};
    const r = await this.pool.query(
      `SELECT sender_id,display_name FROM sender_aliases WHERE sender_id=ANY($1::text[])`,
      [senderIds],
    );
    return Object.fromEntries(
      r.rows.map((row) => [row.sender_id, row.display_name]),
    );
  }
  async upsertSenderAlias(
    senderId: string,
    displayName: string,
    actorId: string,
  ) {
    await this.pool.query(
      `INSERT INTO sender_aliases(sender_id,display_name,updated_by) VALUES($1,$2,$3) ON CONFLICT(sender_id) DO UPDATE SET display_name=excluded.display_name,updated_by=excluded.updated_by,updated_at=now()`,
      [senderId, displayName, actorId],
    );
    await this.pool.query(
      `INSERT INTO audit_entries(id,actor_id,action,object_type,object_id,details) VALUES($1,$2,'sender_alias.updated','sender_alias',$3,$4)`,
      [randomUUID(), actorId, senderId, { displayName }],
    );
    return { senderId, displayName };
  }
  async listTextSettings() {
    const result = await this.pool.query(
      `SELECT text_key,text_value FROM interface_text_settings ORDER BY text_key`,
    );
    return Object.fromEntries(
      result.rows.map((row) => [row.text_key, row.text_value]),
    );
  }
  async replaceTextSettings(values: Record<string, string>, actorId: string) {
    return this.transaction(async (client) => {
      await client.query(`DELETE FROM interface_text_settings WHERE text_key NOT LIKE 'ui.page.%'`);
      for (const [key, value] of Object.entries(values)) {
        await client.query(
          `INSERT INTO interface_text_settings(text_key,text_value,updated_by) VALUES($1,$2,$3) ON CONFLICT(text_key) DO UPDATE SET text_value=excluded.text_value,updated_by=excluded.updated_by,updated_at=now()`,
          [key, value, actorId],
        );
      }
      await client.query(
        `INSERT INTO audit_entries(id,actor_id,action,object_type,object_id,details) VALUES($1,$2,'interface_text.replaced','interface_text','global',$3)`,
        [randomUUID(), actorId, { count: Object.keys(values).length }],
      );
      return values;
    });
  }
  private async transaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const v = await fn(c);
      await c.query("COMMIT");
      return v;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}
