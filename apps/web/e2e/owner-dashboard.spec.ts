import { expect, test } from "@playwright/test";
import { ownerDashboardFixture } from "../src/fixtures/ownerDashboardFixture";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/dashboard/owner", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(ownerDashboardFixture),
    }),
  );
});

test("mobile shows the task-first order without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "手机导航" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 经营简报" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "需要关注的工地" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "老板待确认" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const targets = await page.getByRole("navigation", { name: "手机导航" }).getByRole("link").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
  expect(targets.every((height) => height >= 44)).toBe(true);
});

test("desktop keeps the executive layout and explicit evidence expansion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await expect(page.getByText("测试工地甲")).toBeVisible();
  await expect(page.getByText("合成施工事件摘要")).toHaveCount(0);
  await page.getByRole("button", { name: "查看依据" }).last().click();
  await expect(page.getByText("合成施工事件摘要")).toBeVisible();
  await expect(page.getByText("演示数据").first()).toBeVisible();
});
