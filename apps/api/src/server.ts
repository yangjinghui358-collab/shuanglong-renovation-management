import { Pool } from "pg";

import {
  createWecomDashboardReader,
  type DashboardReader,
} from "@shuanglong/data-access";

import { buildApp } from "./app";
import { loadEnv } from "./config/env";
import { hashPassword } from "./modules/auth/password";
import { PostgresManagementStore } from "./modules/management/postgres-store";

async function start(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.WECOM_DATABASE_URL });
  const managementPool = new Pool({ connectionString: env.MANAGEMENT_DATABASE_URL });
  const managementStore = new PostgresManagementStore(managementPool);
  await managementStore.initialize();
  await managementStore.bootstrapOwner(env.ADMIN_PHONE, await hashPassword(env.ADMIN_INITIAL_PASSWORD));
  const emptyFormalReader: DashboardReader = { async read() { return {
    sourceFreshness:{lastMessageAt:null,status:"confirmed",statusLabel:"已确认"},
    digest:{title:"经营简报",summary:"当前暂无正式简报。",evidence:[],status:"confirmed",statusLabel:"已确认"},
    metrics:[],projects:[],materials:[],leads:[],approvals:[],
  }; } };
  const app = buildApp({
    realReader: createWecomDashboardReader(pool),
    demoReader: emptyFormalReader,
    now: () => new Date(),
    managementStore,
    agentIngestToken: env.AGENT_INGEST_TOKEN,
    candidateEvidenceReader:{async readMessages(ids){if(!ids.length)return[];const r=await pool.query(`SELECT msg_id AS id,sender_id,coalesce(nullif(sender_name,''),sender_id,'') AS sender_name,sent_at,msg_type,left(content,4000) AS content FROM messages WHERE msg_id=ANY($1::text[]) ORDER BY sent_at,seq`,[ids]);return r.rows.map(row=>({id:row.id,senderId:row.sender_id,senderName:row.sender_name,sentAt:new Date(row.sent_at).toISOString(),messageType:row.msg_type,content:row.content}))}},
  });

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "127.0.0.1";

  const shutdown = async (): Promise<void> => {
    await app.close();
    await pool.end();
    await managementPool.end();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  await app.listen({ port, host });
}

void start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
