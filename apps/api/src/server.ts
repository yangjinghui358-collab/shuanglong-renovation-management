import { Pool } from "pg";

import {
  createDemoOperationsReader,
  createWecomDashboardReader,
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
  const startedAt = new Date();
  const app = buildApp({
    realReader: createWecomDashboardReader(pool),
    demoReader: createDemoOperationsReader(startedAt),
    now: () => new Date(),
    managementStore,
    agentIngestToken: env.AGENT_INGEST_TOKEN,
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
