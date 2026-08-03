import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ownerDashboardFixture } from "../fixtures/ownerDashboardFixture";
import { server } from "../test/server";
import { fetchOwnerDashboard } from "./api";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fetchOwnerDashboard", () => {
  it("returns an explicitly demo-only dashboard when enabled and the API request fails", async () => {
    vi.stubEnv("VITE_ENABLE_DEMO_FALLBACK", "true");
    server.use(
      http.get("/api/dashboard/owner", () =>
        HttpResponse.json({ message: "not found" }, { status: 404 }),
      ),
    );

    const result = await fetchOwnerDashboard();
    const records = [
      result.digest,
      ...result.metrics,
      ...result.projects,
      ...result.materials,
      ...result.leads,
      ...result.approvals,
    ];

    expect(result.sourceFreshness).toEqual({
      lastMessageAt: null,
      status: "demo",
      statusLabel: "真实数据暂不可用",
    });
    expect(records.length).toBeGreaterThan(0);
    expect(
      records.every(
        (record) =>
          record.status === "demo" && record.statusLabel === "演示数据",
      ),
    ).toBe(true);
  });

  it("still rejects an API failure when demo fallback is disabled", async () => {
    vi.stubEnv("VITE_ENABLE_DEMO_FALLBACK", "false");
    server.use(
      http.get("/api/dashboard/owner", () =>
        HttpResponse.json({ message: "not found" }, { status: 404 }),
      ),
    );

    await expect(fetchOwnerDashboard()).rejects.toThrow(
      "经营数据暂时无法加载，请稍后重试",
    );
  });

  it("does not hide a malformed successful API payload behind demo fallback", async () => {
    vi.stubEnv("VITE_ENABLE_DEMO_FALLBACK", "true");
    server.use(
      http.get("/api/dashboard/owner", () =>
        HttpResponse.json({ generatedAt: "bad" }),
      ),
    );

    await expect(fetchOwnerDashboard()).rejects.toThrow(
      "经营数据格式异常，请稍后重试",
    );
  });

  it("uses a configured API base URL while defaulting to same-origin /api", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/management-api/");
    server.use(
      http.get(
        "https://api.example.test/management-api/dashboard/owner",
        () => HttpResponse.json(ownerDashboardFixture),
      ),
    );

    const result = await fetchOwnerDashboard();

    expect(result.generatedAt).toBe("2026-08-03T07:00:00+08:00");
  });
});
