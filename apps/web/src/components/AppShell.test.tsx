import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";
import { DataStatusTag } from "./DataStatusTag";

describe("AppShell", () => {
  it("keeps the brand and primary route discoverable in the executive shell", () => {
    render(
      <MemoryRouter>
        <AppShell><div>页面内容</div></AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("双龙装饰 · AI 经营管理中心")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeVisible();
    expect(screen.getByText("老板首页")).toBeVisible();
    expect(screen.getByText("页面内容")).toBeVisible();
  });

  it.each([
    ["real", "真实数据"],
    ["demo", "演示数据"],
    ["ai_inferred", "AI 推测"],
    ["pending_confirmation", "待确认"],
    ["confirmed", "已确认"],
    ["rejected", "已驳回"],
    ["archived", "已归档"],
  ] as const)("renders %s with an explicit text label", (status, label) => {
    render(<DataStatusTag status={status} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
