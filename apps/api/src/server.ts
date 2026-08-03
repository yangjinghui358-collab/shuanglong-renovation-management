import { Pool } from "pg";

import {
  createDemoOperationsReader,
  createWecomDashboardReader,
} from "@shuanglong/data-access";

import { buildApp } from "./app";
import { loadEnv } from "./config/env";

async function start(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.WECOM_DATABASE_URL });
  const startedAt = new Date();
  const app = buildApp({
    realReader: createWecomDashboardReader(pool),
    demoReader: createDemoOperationsReader(startedAt),
    now: () => new Date(),
  });

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "127.0.0.1";

  const shutdown = async (): Promise<void> => {
    await app.close();
    await pool.end();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  await app.listen({ port, host });
}

void start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
