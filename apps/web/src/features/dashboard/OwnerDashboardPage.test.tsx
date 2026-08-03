import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  demoOwnerDashboardFixture,
  ownerDashboardFixture,
} from "../../fixtures/ownerDashboardFixture";
import { server } from "../../test/server";
import { OwnerDashboardPage } from "./OwnerDashboardPage";

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><OwnerDashboardPage /></QueryClientProvider>);
}

describe("OwnerDashboardPage", () => {
  it("renders the task-first executive dashboard from the owner API", async () => {
    server.use(http.get("/api/dashboard/owner", () => HttpResponse.json(ownerDashboardFixture)));
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "AI 经营简报" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "需要关注的工地" })).toBeVisible();
    expect(screen.getByText("测试工地甲")).toBeVisible();
    expect(screen.getByRole("heading", { name: "老板待确认" })).toBeVisible();
    expect(screen.getByText("测试项目整装报价")).toBeVisible();
    expect(screen.getByRole("heading", { name: "成交机会" })).toBeVisible();
    expect(screen.getAllByText("演示数据").length).toBeGreaterThan(0);
    expect(screen.getByText(/最后消息/)).toHaveTextContent("08月02日 22:40");
  });

  it("shows a Chinese recovery message when the API payload is invalid", async () => {
    server.use(http.get("/api/dashboard/owner", () => HttpResponse.json({ generatedAt: "bad" })));
    renderDashboard();
    expect(await screen.findByText("经营数据格式异常，请稍后重试")).toBeVisible();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  });

  it("warns that the real source is unavailable instead of claiming synchronization", async () => {
    server.use(http.get("/api/dashboard/owner", () => HttpResponse.json({
      ...ownerDashboardFixture,
      sourceFreshness: {
        lastMessageAt: null,
        status: "demo",
        statusLabel: "真实数据暂不可用",
      },
    })));
    renderDashboard();

    expect(await screen.findByText("真实数据暂不可用")).toBeVisible();
    expect(screen.queryByText("数据已同步")).not.toBeInTheDocument();
  });

  it("does not count demo records as owner actions", async () => {
    server.use(http.get("/api/dashboard/owner", () => HttpResponse.json(demoOwnerDashboardFixture)));
    renderDashboard();

    expect(await screen.findByText("真实数据暂不可用")).toBeVisible();
    expect(screen.getByRole("heading", { name: "经营总览" }).parentElement).toHaveTextContent("0 个高风险工地和 0 项待确认");
    expect(screen.queryByRole("button", { name: /处理/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("仅演示").length).toBeGreaterThan(0);
  });
});
