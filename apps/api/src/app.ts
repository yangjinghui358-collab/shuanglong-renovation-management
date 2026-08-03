import Fastify, { type FastifyInstance } from "fastify";

import {
  registerDashboardRoute,
  type DashboardRouteDependencies,
} from "./modules/dashboard/route";
import { registerHealthRoute } from "./modules/health/route";

export type AppDependencies = DashboardRouteDependencies;

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  registerDashboardRoute(app, dependencies);
  registerHealthRoute(app, dependencies.realReader);
  return app;
}
