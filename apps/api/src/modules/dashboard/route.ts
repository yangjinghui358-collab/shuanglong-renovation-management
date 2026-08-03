import type { FastifyInstance } from "fastify";

import { composeOwnerDashboard, type DashboardReader } from "@shuanglong/data-access";

export interface DashboardRouteDependencies {
  realReader: DashboardReader;
  demoReader: DashboardReader;
  now: () => Date;
}

export function registerDashboardRoute(
  app: FastifyInstance,
  dependencies: DashboardRouteDependencies,
): void {
  app.get("/api/dashboard/owner", async () =>
    composeOwnerDashboard(
      dependencies.realReader,
      dependencies.demoReader,
      dependencies.now(),
    ),
  );
}
