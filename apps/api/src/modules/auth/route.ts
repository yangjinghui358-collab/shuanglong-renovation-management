import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthUser, ManagementStore } from "../management/types";
import { hashPassword, verifyPassword } from "./password";

declare module "fastify" { interface FastifyRequest { authUser?: AuthUser } }
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const cookieToken = (request: FastifyRequest) => request.headers.cookie?.split(";").map(v => v.trim()).find(v => v.startsWith("sl_session="))?.slice(11) ?? null;

export async function authenticate(request: FastifyRequest, store: ManagementStore): Promise<AuthUser | null> {
  const token = cookieToken(request);
  if (!token) return null;
  return store.findSession(tokenHash(token));
}

export function registerAuthRoutes(app: FastifyInstance, store: ManagementStore): void {
  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as { phone?: string; password?: string };
    const phone = body.phone?.replace(/\s/g, "") ?? "";
    const user = await store.findUserByPhone(phone);
    if (!user || !body.password || !(await verifyPassword(body.password, user.passwordHash))) return reply.code(401).send({ error: "手机号或密码错误" });
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await store.createSession(user.id, tokenHash(token), expiresAt);
    const secure=request.headers["x-forwarded-proto"]==="https"?"; Secure":"";
    reply.header("Set-Cookie", `sl_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`);
    return { user: { id: user.id, phone: user.phone, role: user.role, mustChangePassword: user.mustChangePassword } };
  });
  app.get("/api/auth/me", async (request, reply) => {
    const user = await authenticate(request, store);
    return user ? { user } : reply.code(401).send({ error: "未登录" });
  });
  app.post("/api/auth/logout", async (request, reply) => {
    const token = cookieToken(request); if (token) await store.deleteSession(tokenHash(token));
    reply.header("Set-Cookie", "sl_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"); return { ok: true };
  });
  app.post("/api/auth/change-password", async(request,reply)=>{const user=await authenticate(request,store);if(!user)return reply.code(401).send({error:"未登录"});const body=request.body as{currentPassword?:string;newPassword?:string};const record=await store.findUserByPhone(user.phone);if(!record||!body.currentPassword||!(await verifyPassword(body.currentPassword,record.passwordHash)))return reply.code(401).send({error:"当前密码错误"});if(!body.newPassword||body.newPassword.length<12)return reply.code(400).send({error:"新密码至少 12 位"});await store.changePassword(user.id,await hashPassword(body.newPassword));return{ok:true};});
  app.get("/api/auth/users",async(request,reply)=>{const user=await authenticate(request,store);if(user?.role!=="owner")return reply.code(user?403:401).send({error:user?"权限不足":"未登录"});return{items:await store.listUsers()};});
  app.post("/api/auth/users",async(request,reply)=>{const user=await authenticate(request,store);if(user?.role!=="owner")return reply.code(user?403:401).send({error:user?"权限不足":"未登录"});const body=request.body as{phone?:string;password?:string;role?:"management"|"employee"};if(!body.phone||!/^1[3-9]\d{9}$/.test(body.phone)||!body.password||body.password.length<12||!["management","employee"].includes(body.role??""))return reply.code(400).send({error:"账号信息不符合要求"});return reply.code(201).send({user:await store.createUser(body.phone,await hashPassword(body.password),body.role!)});});
  app.get("/api/settings/texts", async (request, reply) => {
    const user = await authenticate(request, store);
    if (!user) return reply.code(401).send({ error: "未登录" });
    return { values: (await store.listTextSettings?.()) ?? {} };
  });
  app.put("/api/settings/texts", async (request, reply) => {
    const user = await authenticate(request, store);
    if (user?.role !== "owner") return reply.code(user ? 403 : 401).send({ error: user ? "权限不足" : "未登录" });
    const values = (request.body as { values?: unknown })?.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) return reply.code(400).send({ error: "文案格式不正确" });
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (!/^ui\.[a-z0-9_.-]+$/.test(key) || typeof value !== "string" || value.trim().length === 0 || value.length > 500) return reply.code(400).send({ error: "文案格式不正确" });
      cleaned[key] = value.trim();
    }
    return { values: (await store.replaceTextSettings?.(cleaned, user.id)) ?? cleaned };
  });
}
