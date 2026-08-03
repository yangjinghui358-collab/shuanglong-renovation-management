import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MobileTabBar } from "./MobileTabBar";

describe("MobileTabBar", () => {
  it("offers the five task-first destinations with the current page identified", () => {
    render(<MemoryRouter initialEntries={["/"]}><MobileTabBar /></MemoryRouter>);
    const navigation = screen.getByRole("navigation", { name: "手机导航" });
    expect(navigation).toBeVisible();
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "工地" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("link", { name: "客户" })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: "待办" })).toHaveAttribute("href", "/ai-review");
    expect(screen.getByRole("link", { name: "我的" })).toHaveAttribute("href", "/settings");
  });
});
