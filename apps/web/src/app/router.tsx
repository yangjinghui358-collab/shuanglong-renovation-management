import { createBrowserRouter } from "react-router-dom";
import { App } from "../App";
import { ModulePreview } from "../components/AppShell";
import { OwnerDashboardPage } from "../features/dashboard/OwnerDashboardPage";
import { AgentReviewPage } from "../features/review/AgentReviewPage";
import { UserManagementPage } from "../features/settings/UserManagementPage";

const previews = [
  ["projects", "工地管理"], ["materials", "主材采购"], ["customers", "客户销售"],
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
      ...previews.map(([path, title]) => ({ path, element: <ModulePreview title={title} /> })),
    ],
  },
]);
