import { OwnerDashboardSchema } from "@shuanglong/contracts";
import { createDemoOperationsReader, type DashboardReader } from "@shuanglong/data-access";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../app";

const fixedNow = new Date("2026-08-03T07:00:00+08:00");
const apps: Array<ReturnType<typeof buildApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("owner dashboard API", () => {
  it("returns a schema-valid owner snapshot", async () => {
    const demo = createDemoOperationsReader(fixedNow);
    const app = buildApp({ realReader: demo, demoReader: demo, now: () => fixedNow });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/owner",
    });

    expect(response.statusCode).toBe(200);
    expect(OwnerDashboardSchema.parse(response.json())).toBeTruthy();
  });

  it("reports the real source freshness when the database is connected", async () => {
    const demo = createDemoOperationsReader(fixedNow);
    const connected: DashboardReader = {
      async read() {
        const snapshot = await demo.read();
        return {
          ...snapshot,
          sourceFreshness: {
            lastMessageAt: "2026-08-02T22:40:00+08:00",
            status: "real" as const,
            statusLabel: "真实数据",
          },
        };
      },
    };
    const app = buildApp({ realReader: connected, demoReader: demo, now: () => fixedNow });
    apps.push(app);

    const health = await app.inject({ method: "GET", url: "/api/health" });

    expect(health.json()).toEqual({
      status: "ok",
      database: "connected",
      lastMessageAt: "2026-08-02T22:40:00+08:00",
    });
  });

  it("labels dashboard fallback and reports degraded health when the database fails", async () => {
    const unavailable: DashboardReader = {
      async read() { throw new Error("database unavailable"); },
    };
    const app = buildApp({
      realReader: unavailable,
      demoReader: createDemoOperationsReader(fixedNow),
      now: () => fixedNow,
    });
    apps.push(app);

    const [dashboard, health] = await Promise.all([
      app.inject({ method: "GET", url: "/api/dashboard/owner" }),
      app.inject({ method: "GET", url: "/api/health" }),
    ]);

    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json().sourceFreshness.statusLabel).toBe("真实数据暂不可用");
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({
      status: "degraded",
      database: "unavailable",
      lastMessageAt: null,
    });
  });
});
