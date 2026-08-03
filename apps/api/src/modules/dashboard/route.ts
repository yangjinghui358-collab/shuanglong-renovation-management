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
  app.get("/api/dashboard/owner", async (request) => {
    const dashboard=await composeOwnerDashboard(
      dependencies.realReader,
      dependencies.demoReader,
      dependencies.now(),
    );
    const role=request.authUser?.role??"owner";
    if(role==="owner")return dashboard;
    const projects=dashboard.projects.map(project=>({...project,evidence:[],issue:role==="employee"?"请按项目计划执行":project.issue}));
    if(role==="management")return{...dashboard,projects,approvals:[],metrics:dashboard.metrics.filter(metric=>metric.key!=="pending_approvals"),digest:{...dashboard.digest,evidence:[]}};
    return{...dashboard,projects,materials:[],leads:[],approvals:[],metrics:dashboard.metrics.filter(metric=>["active_projects","at_risk_projects"].includes(metric.key)),digest:{title:"工作概览",summary:"仅显示与你岗位相关的工地工作信息。",evidence:[],status:"confirmed",statusLabel:"已确认"}};
  });
}
