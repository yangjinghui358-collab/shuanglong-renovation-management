import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "../auth/route";
import type { AgentKey, CandidateModule, ManagementStore } from "../management/types";

const candidateModules: CandidateModule[] = ["projects","procurement","crm","finance","inventory","tasks","alerts"];
const agentKeys: AgentKey[] = ["chat_archive","todo_reminder","owner_alert"];
function validPayload(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value)&&JSON.stringify(value).length<=100_000}
function validKind(value:unknown):value is string{return typeof value==="string"&&value.trim().length>0&&value.trim().length<=80}
export interface CandidateEvidenceReader { readMessages(ids:string[]):Promise<Array<{id:string;senderId:string;senderName:string;sentAt:string;messageType:string;content:string}>> }

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
  if (user.role === "employee" && !["projects","tasks"].includes(module)) { reply.code(403).send({ error: "权限不足" }); return null; }
  if (user.role === "management" && ["finance","alerts"].includes(module)) { reply.code(403).send({ error: "权限不足" }); return null; }
  return user;
}
export function registerReviewRoutes(app: FastifyInstance, store: ManagementStore, agentToken: string, evidenceReader?:CandidateEvidenceReader): void {
  app.post("/api/agent/candidates", async (request, reply) => {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    if (!bearer || !safeToken(bearer, agentToken)) return reply.code(401).send({ error: "Agent 凭据无效" });
    const b = request.body as { module?: CandidateModule; kind?: string; payload?: Record<string, unknown>; confidence?: number; sourceKey?: string };
    if (!b.module || !candidateModules.includes(b.module) || !b.kind || !b.payload || !b.sourceKey) return reply.code(400).send({ error: "候选数据不完整" });
    return reply.code(201).send(await store.createCandidate({ module: b.module, kind: b.kind, payload: b.payload, confidence: Math.max(0, Math.min(1, Number(b.confidence ?? 0))) }, b.sourceKey));
  });
  app.get("/api/review/candidates", async (request, reply) => { if (!(await owner(request, reply, store))) return; return { items: await store.listCandidates() }; });
  app.post("/api/review/candidates",async(request,reply)=>{const user=await owner(request,reply,store);if(!user)return;const b=request.body as{source?:"manual"|"spreadsheet";items?:Array<{module?:CandidateModule;kind?:string;payload?:Record<string,unknown>}>};if(!["manual","spreadsheet"].includes(b.source??"")||!Array.isArray(b.items)||b.items.length<1||b.items.length>200)return reply.code(400).send({error:"每次可录入 1 至 200 条待确认事项"});if(b.items.some(item=>!item.module||!candidateModules.includes(item.module)||!validKind(item.kind)||!validPayload(item.payload)))return reply.code(400).send({error:"归类、事件类型或录入内容不完整"});const source=b.source!;const inputs=b.items.map(item=>({module:item.module!,kind:item.kind!.trim(),payload:{...item.payload,entrySource:source==="manual"?"人工录入":"表格导入"},confidence:1}));return reply.code(201).send({items:await store.createReviewCandidates(inputs,user.id,source)});});
  app.patch("/api/review/candidates/:id",async(request,reply)=>{const user=await owner(request,reply,store);if(!user)return;const b=request.body as{version?:number;module?:CandidateModule;kind?:string;payload?:Record<string,unknown>};if(!Number.isInteger(b.version)||!b.module||!candidateModules.includes(b.module)||!validKind(b.kind)||!validPayload(b.payload))return reply.code(400).send({error:"修改内容不完整"});return store.updateCandidate((request.params as{id:string}).id,b.version!,{module:b.module,kind:b.kind.trim(),payload:b.payload},user.id);});
  app.get("/api/review/candidates/:id/evidence",async(request,reply)=>{
    if(!(await owner(request,reply,store)))return;
    if(!evidenceReader)return reply.code(503).send({error:"聊天证据服务暂不可用"});
    const item=await store.findCandidate((request.params as{id:string}).id);if(!item)return reply.code(404).send({error:"候选不存在"});
    const ids=Array.isArray(item.payload.sourceMessageIds)?item.payload.sourceMessageIds.filter((value):value is string=>typeof value==="string").slice(0,30):[];
    const messages=await evidenceReader.readMessages(ids);const aliases=await store.getSenderAliases([...new Set(messages.map(message=>message.senderId))]);
    return{items:messages.map(message=>({...message,senderName:aliases[message.senderId]||(message.senderName!==message.senderId?message.senderName:"")})),total:ids.length};
  });
  app.put("/api/evidence/senders/:id/alias",async(request,reply)=>{const user=await owner(request,reply,store);if(!user)return;const senderId=(request.params as{id:string}).id;const displayName=String((request.body as{displayName?:string})?.displayName??"").trim();if(!senderId||senderId.length>200||!displayName||displayName.length>50)return reply.code(400).send({error:"姓名应为 1 至 50 个字符"});return store.upsertSenderAlias(senderId,displayName,user.id);});
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
    if (!candidateModules.includes(module)) return reply.code(404).send({ error: "模块不存在" });
    if (!(await moduleUser(request, reply, store, module))) return;
    return { items: await store.listModuleRecords(module) };
  });
  app.get("/api/agents", async (request, reply) => {
    if (!(await owner(request, reply, store))) return;
    return { items: await store.listAgentRuns() };
  });
  app.post("/api/agents/:key/runs", async (request, reply) => {
    const user = await owner(request, reply, store); if (!user) return;
    const key = (request.params as {key:AgentKey}).key;
    if (!agentKeys.includes(key)) return reply.code(404).send({ error: "Agent 不存在" });
    return reply.code(202).send(await store.queueAgentRun(key,user.id));
  });
}
