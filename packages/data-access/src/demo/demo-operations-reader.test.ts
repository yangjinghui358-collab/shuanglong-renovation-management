import { expect, it } from "vitest";

import { createDemoOperationsReader } from "./demo-operations-reader";

it("marks every unavailable operations record as demo", async () => {
  const reader = createDemoOperationsReader(
    new Date("2026-08-03T07:00:00+08:00"),
  );
  const snapshot = await reader.read();
  const records = [
    ...snapshot.materials,
    ...snapshot.leads,
    ...snapshot.approvals,
  ];

  expect(records.length).toBeGreaterThan(0);
  expect(
    records.every(
      (item) => item.status === "demo" && item.statusLabel === "演示数据",
    ),
  ).toBe(true);
});
