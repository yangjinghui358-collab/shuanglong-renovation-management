import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "../auth/route";
import type { CandidateModule, ManagementStore } from "../management/types";

function safeToken(actual: string, expected: string): boolean {
  const a = Buffer.from(actual), e = Buffer.from(expected); return a.length === e.length && timingSafeEqual(a, e);
}
async function owner(request: FastifyRequest, reply: FastifyReply, store: ManagementStore) {
  const user = await authenticate(request, store);
  if (!user) { reply.code(401).send({ error: "未登录" }); return null; }
  if (user.role !== "owner") { reply.code(403).send({ error: "权限不足" }); return null; }
  return user;
}
async function moduleUser(request: FastifyRequest, reply: FastifyReply, store: ManagementStore, module: CandidateModule) {
  const user = await authenticate(request, store);
  if (!user) { reply.code(401).send({ error: "未登录" }); return null; }
  if (user.role === "employee" && module !== "projects") { reply.code(403).send({ error: "权限不足" }); return null; }
  return user;
}
export function registerReviewRoutes(app: FastifyInstance, store: ManagementStore, agentToken: string): void {
  app.post("/api/agent/candidates", async (request, reply) => {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    if (!bearer || !safeToken(bearer, agentToken)) return reply.code(401).send({ error: "Agent 凭据无效" });
    const b = request.body as { module?: CandidateModule; kind?: string; payload?: Record<string, unknown>; confidence?: number; sourceKey?: string };
    if (!b.module || !["projects","procurement","crm"].includes(b.module) || !b.kind || !b.payload || !b.sourceKey) return reply.code(400).send({ error: "候选数据不完整" });
    return reply.code(201).send(await store.createCandidate({ module: b.module, kind: b.kind, payload: b.payload, confidence: Math.max(0, Math.min(1, Number(b.confidence ?? 0))) }, b.sourceKey));
  });
  app.get("/api/review/candidates", async (request, reply) => { if (!(await owner(request, reply, store))) return; return { items: await store.listCandidates() }; });
  app.post("/api/review/candidates/:id/confirm", async (request, reply) => {
    const user = await owner(request, reply, store); if (!user) return;
    const b = request.body as { version?: number; idempotencyKey?: string; payload?: Record<string, unknown> };
    if (!Number.isInteger(b.version) || !b.idempotencyKey) return reply.code(400).send({ error: "缺少版本或幂等键" });
    return store.confirmCandidate((request.params as {id:string}).id, b.version!, b.idempotencyKey, user.id, b.payload);
  });
  app.post("/api/review/candidates/:id/reject", async (request, reply) => {
    const user = await owner(request, reply, store); if (!user) return;
    const b = request.body as { version?: number; reason?: string };
    if (!Number.isInteger(b.version) || !b.reason?.trim()) return reply.code(400).send({ error: "必须填写驳回原因" });
    return store.rejectCandidate((request.params as {id:string}).id, b.version!, user.id, b.reason.trim());
  });
  app.get("/api/modules/:module/records", async (request, reply) => {
    const module = (request.params as {module:CandidateModule}).module;
    if (!["projects","procurement","crm"].includes(module)) return reply.code(404).send({ error: "模块不存在" });
    if (!(await moduleUser(request, reply, store, module))) return;
    return { items: await store.listModuleRecords(module) };
  });
}
