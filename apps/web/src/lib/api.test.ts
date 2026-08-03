import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ownerDashboardFixture } from "../fixtures/ownerDashboardFixture";
import { server } from "../test/server";
import { fetchOwnerDashboard } from "./api";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fetchOwnerDashboard", () => {
  it("rejects an API failure without substituting synthetic records", async () => {
    server.use(
      http.get("/api/dashboard/owner", () =>
        HttpResponse.json({ message: "not found" }, { status: 404 }),
      ),
    );

    await expect(fetchOwnerDashboard()).rejects.toThrow(
      "经营数据暂时无法加载，请稍后重试",
    );
  });

  it("rejects a malformed successful API payload", async () => {
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
