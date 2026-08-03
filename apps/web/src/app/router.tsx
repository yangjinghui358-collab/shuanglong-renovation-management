import { createBrowserRouter } from "react-router-dom";
import { App } from "../App";
import { ModulePreview } from "../components/AppShell";
import { OwnerDashboardPage } from "../features/dashboard/OwnerDashboardPage";
import { AgentReviewPage } from "../features/review/AgentReviewPage";
import { UserManagementPage } from "../features/settings/UserManagementPage";
import { ModuleRecordsPage } from "../features/modules/ModuleRecordsPage";

const previews = [
  ["quotations", "设计报价"], ["finance", "财务中心"], ["inventory", "库存管理"],
  ["schedule", "员工排班"],
] as const;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <OwnerDashboardPage /> },
      { path: "ai-review", element: <AgentReviewPage /> },
      { path: "settings", element: <UserManagementPage /> },
      { path: "projects", element: <ModuleRecordsPage module="projects" /> },
      { path: "materials", element: <ModuleRecordsPage module="procurement" /> },
      { path: "customers", element: <ModuleRecordsPage module="crm" /> },
      ...previews.map(([path, title]) => ({ path, element: <ModulePreview title={title} /> })),
    ],
  },
]);
