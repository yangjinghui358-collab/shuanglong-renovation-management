import { createBrowserRouter } from "react-router-dom";
import { App } from "../App";
import { ModulePreview } from "../components/AppShell";
import { OwnerDashboardPage } from "../features/dashboard/OwnerDashboardPage";
import { AgentReviewPage } from "../features/review/AgentReviewPage";
import { UserManagementPage } from "../features/settings/UserManagementPage";
import { ModuleRecordsPage } from "../features/modules/ModuleRecordsPage";
import { AgentCenterPage } from "../features/agents/AgentCenterPage";
import { ProjectManagementPage } from "../features/projects/ProjectManagementPage";

const previews = [
  ["quotations", "设计报价"],
  ["schedule", "员工排班"],
] as const;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <OwnerDashboardPage /> },
      { path: "ai-review", element: <AgentReviewPage /> },
      { path: "agents", element: <AgentCenterPage /> },
      { path: "settings", element: <UserManagementPage /> },
      { path: "projects", element: <ProjectManagementPage /> },
      { path: "materials", element: <ModuleRecordsPage module="procurement" /> },
      { path: "customers", element: <ModuleRecordsPage module="crm" /> },
      { path: "finance", element: <ModuleRecordsPage module="finance" /> },
      { path: "inventory", element: <ModuleRecordsPage module="inventory" /> },
      { path: "tasks", element: <ModuleRecordsPage module="tasks" /> },
      { path: "alerts", element: <ModuleRecordsPage module="alerts" /> },
      ...previews.map(([path, title]) => ({ path, element: <ModulePreview title={title} /> })),
    ],
  },
]);
