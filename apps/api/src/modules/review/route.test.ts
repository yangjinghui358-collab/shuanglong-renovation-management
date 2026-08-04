import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../app";
import { hashPassword } from "../auth/password";
import type {
  AgentCandidate,
  AuthUser,
  CandidateModule,
  ManagementStore,
} from "../management/types";

class MemoryStore implements ManagementStore {
  user!: AuthUser & { passwordHash: string };
  sessions = new Map<string, AuthUser>();
  candidates: AgentCandidate[] = [];
  records: any[] = [];
  runs: any[] = [];
  async initialize() {}
  async bootstrapOwner() {}
  async findUserByPhone(p: string) {
    return p === this.user.phone ? this.user : null;
  }
  async createSession(_: string, h: string) {
    this.sessions.set(h, this.user);
  }
  async findSession(h: string) {
    return this.sessions.get(h) ?? null;
  }
  async deleteSession(h: string) {
    this.sessions.delete(h);
  }
  async createUser(
    phone: string,
    passwordHash: string,
    role: "management" | "employee",
  ) {
    return { id: randomUUID(), phone, role, mustChangePassword: true };
  }
  async listUsers() {
    return [this.user];
  }
  async changePassword(_id: string, passwordHash: string) {
    this.user.passwordHash = passwordHash;
    this.user.mustChangePassword = false;
  }
  async createCandidate(input: any) {
    const c = {
      ...input,
      id: randomUUID(),
      status: "pending_review",
      version: 1,
      createdAt: new Date().toISOString(),
    } as AgentCandidate;
    this.candidates.push(c);
    return c;
  }
  async listCandidates() {
    return this.candidates.filter((x) => x.status === "pending_review");
  }
  async createReviewCandidates(inputs: any[]) {
    return Promise.all(inputs.map((input) => this.createCandidate(input)));
  }
  async findCandidate(id: string) {
    return this.candidates.find((x) => x.id === id) ?? null;
  }
  async updateCandidate(id: string, v: number, input: any) {
    const c = this.candidates.find((x) => x.id === id && x.version === v)!;
    Object.assign(c, input);
    c.version++;
    return c;
  }
  async confirmCandidate(
    id: string,
    v: number,
    _k: string,
    _a: string,
    p?: Record<string, unknown>,
  ) {
    const c = this.candidates.find((x) => x.id === id && x.version === v)!;
    c.status = "projected";
    c.version++;
    this.records.push({ candidate_id: id, payload: p ?? c.payload });
    return c;
  }
  async rejectCandidate(id: string) {
    return this.candidates.find((x) => x.id === id)!;
  }
  async listModuleRecords(_m: CandidateModule) {
    return this.records;
  }
  async updateModuleRecord(
    id: string,
    _module: CandidateModule,
    kind: string,
    payload: Record<string, unknown>,
  ) {
    const record = this.records.find((x) => x.id === id);
    Object.assign(record, { kind, payload });
    return record;
  }
  overrides: Record<string, Record<string, unknown>> = {};
  async getModuleEntityOverrides() {
    return this.overrides;
  }
  async upsertModuleEntityOverride(
    _module: CandidateModule,
    key: string,
    payload: Record<string, unknown>,
  ) {
    this.overrides[key] = payload;
    return { entity_key: key, payload };
  }
  async queueAgentRun(
    agent_key: "chat_archive" | "todo_reminder" | "owner_alert",
    _actor: string,
  ) {
    const run = {
      id: randomUUID(),
      agent_key,
      status: "queued",
      requested_at: new Date().toISOString(),
    };
    this.runs.push(run);
    return run;
  }
  async listAgentRuns() {
    return this.runs;
  }
  aliases: Record<string, string> = {};
  async getSenderAliases(ids: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const id of ids) {
      const alias = this.aliases[id];
      if (alias) result[id] = alias;
    }
    return result;
  }
  async upsertSenderAlias(senderId: string, displayName: string) {
    this.aliases[senderId] = displayName;
    return { senderId, displayName };
  }
}
const reader = {
  read: async () => ({
    sourceFreshness: {
      lastMessageAt: null,
      status: "demo" as const,
      statusLabel: "演示数据" as const,
    },
    digest: null,
    metrics: [],
    projects: [],
    materials: [],
    leads: [],
    approvals: [],
  }),
};
describe("authenticated agent projection", () => {
  it("requires owner confirmation before module write", async () => {
    const store = new MemoryStore();
    store.user = {
      id: randomUUID(),
      phone: "18600000000",
      role: "owner",
      mustChangePassword: true,
      passwordHash: await hashPassword("temporary-password-123"),
    };
    const app = buildApp({
      realReader: reader,
      demoReader: reader,
      now: () => new Date(),
      managementStore: store,
      agentIngestToken: "agent-token-at-least-24-characters",
      candidateEvidenceReader: {
        readMessages: async (ids) =>
          ids.map((id) => ({
            id,
            senderId: "external-1",
            senderName: "external-1",
            sentAt: "2026-08-04T00:00:00Z",
            messageType: "text",
            content: "原始施工消息",
          })),
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/agent/candidates",
      headers: { authorization: "Bearer agent-token-at-least-24-characters" },
      payload: {
        module: "projects",
        kind: "progress",
        payload: {
          projectName: "测试工地",
          progress: 60,
          sourceMessageIds: ["message-1"],
        },
        confidence: 0.9,
        sourceKey: "sample-1",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(store.records).toHaveLength(0);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { phone: "18600000000", password: "temporary-password-123" },
    });
    const rawCookie = login.headers["set-cookie"]!;
    const cookie = (Array.isArray(rawCookie) ? rawCookie[0]! : rawCookie).split(
      ";",
    )[0];
    const item = created.json();
    const alias = await app.inject({
      method: "PUT",
      url: "/api/evidence/senders/external-1/alias",
      headers: { cookie },
      payload: { displayName: "项目经理" },
    });
    expect(alias.statusCode).toBe(200);
    const evidence = await app.inject({
      method: "GET",
      url: `/api/review/candidates/${item.id}/evidence`,
      headers: { cookie },
    });
    expect(evidence.statusCode).toBe(200);
    expect(evidence.json().items[0]).toMatchObject({
      id: "message-1",
      senderName: "项目经理",
      content: "原始施工消息",
    });
    const confirmed = await app.inject({
      method: "POST",
      url: `/api/review/candidates/${item.id}/confirm`,
      headers: { cookie },
      payload: { version: 1, idempotencyKey: randomUUID() },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(store.records).toHaveLength(1);
  });
});
describe("review workbench", () => {
  it("keeps manual and imported data pending and allows owner edits", async () => {
    const store = new MemoryStore();
    store.user = {
      id: randomUUID(),
      phone: "18600000000",
      role: "owner",
      mustChangePassword: false,
      passwordHash: await hashPassword("temporary-password-123"),
    };
    const app = buildApp({
      realReader: reader,
      demoReader: reader,
      now: () => new Date(),
      managementStore: store,
      agentIngestToken: "agent-token-at-least-24-characters",
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { phone: store.user.phone, password: "temporary-password-123" },
    });
    const raw = login.headers["set-cookie"]!;
    const cookie = (Array.isArray(raw) ? raw[0]! : raw).split(";")[0];
    const created = await app.inject({
      method: "POST",
      url: "/api/review/candidates",
      headers: { cookie },
      payload: {
        source: "spreadsheet",
        items: [
          {
            module: "projects",
            kind: "event",
            payload: { title: "材料到场", summary: "瓷砖已到场" },
          },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    expect(store.records).toHaveLength(0);
    const item = created.json().items[0];
    expect(item.payload.entrySource).toBe("表格导入");
    const edited = await app.inject({
      method: "PATCH",
      url: `/api/review/candidates/${item.id}`,
      headers: { cookie },
      payload: {
        version: 1,
        module: "procurement",
        kind: "material",
        payload: { ...item.payload, title: "瓷砖到场" },
      },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({
      module: "procurement",
      kind: "material",
      version: 2,
      payload: { title: "瓷砖到场" },
    });
    expect(store.records).toHaveLength(0);
  });
});
describe("formal module editing", () => {
  it("allows only the owner to save project overrides", async () => {
    const store = new MemoryStore();
    store.user = {
      id: randomUUID(),
      phone: "18600000000",
      role: "owner",
      mustChangePassword: false,
      passwordHash: await hashPassword("temporary-password-123"),
    };
    const app = buildApp({
      realReader: reader,
      demoReader: reader,
      now: () => new Date(),
      managementStore: store,
      agentIngestToken: "agent-token-at-least-24-characters",
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { phone: store.user.phone, password: "temporary-password-123" },
    });
    const raw = login.headers["set-cookie"]!;
    const cookie = (Array.isArray(raw) ? raw[0]! : raw).split(";")[0];
    const saved = await app.inject({
      method: "PUT",
      url: "/api/modules/projects/entities/project-1",
      headers: { cookie },
      payload: {
        name: "景辉房子",
        stage: "自定义收尾",
        progress: 73,
        issue: "等待灯具",
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(store.overrides["project-1"]).toMatchObject({
      stage: "自定义收尾",
      progress: 73,
    });
    const listed = await app.inject({
      method: "GET",
      url: "/api/modules/projects/records",
      headers: { cookie },
    });
    expect(listed.json().overrides["project-1"].progress).toBe(73);
  });
});
