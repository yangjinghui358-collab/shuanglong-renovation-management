import Fastify, { type FastifyInstance } from "fastify";

import {
  registerDashboardRoute,
  type DashboardRouteDependencies,
} from "./modules/dashboard/route";
import { registerHealthRoute } from "./modules/health/route";
import { registerAuthRoutes } from "./modules/auth/route";
import { registerReviewRoutes } from "./modules/review/route";
import type { ManagementStore } from "./modules/management/types";
import { authenticate } from "./modules/auth/route";

export type AppDependencies = DashboardRouteDependencies & { managementStore?: ManagementStore; agentIngestToken?: string };

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  if (dependencies.managementStore) app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/dashboard")) {
      const user=await authenticate(request,dependencies.managementStore!);
      if(!user)return reply.code(401).send({error:"未登录"});
      request.authUser=user;
    }
  });
  registerDashboardRoute(app, dependencies);
  registerHealthRoute(app, dependencies.realReader);
  if (dependencies.managementStore && dependencies.agentIngestToken) {
    registerAuthRoutes(app, dependencies.managementStore);
    registerReviewRoutes(app, dependencies.managementStore, dependencies.agentIngestToken);
  }
  return app;
}
