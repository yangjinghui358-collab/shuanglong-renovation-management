import type { FastifyInstance } from "fastify";

import type { DashboardReader } from "@shuanglong/data-access";

export function registerHealthRoute(
  app: FastifyInstance,
  realReader: DashboardReader,
): void {
  app.get("/api/health", async () => {
    try {
      const snapshot = await realReader.read();
      return {
        status: "ok" as const,
        database: "connected" as const,
        lastMessageAt: snapshot.sourceFreshness.lastMessageAt,
      };
    } catch {
      return {
        status: "degraded" as const,
        database: "unavailable" as const,
        lastMessageAt: null,
      };
    }
  });
}
