import { describe, expect, it } from "vitest";

import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("adds PostgreSQL read-only session options", () => {
    const result = loadEnv({
      WECOM_DATABASE_URL: "postgresql://reader@127.0.0.1:15432/wecom_chat",
    });

    const url = new URL(result.WECOM_DATABASE_URL);
    expect(url.searchParams.get("options")).toContain(
      "default_transaction_read_only=on",
    );
  });

  it("rejects an invalid database URL", () => {
    expect(() => loadEnv({ WECOM_DATABASE_URL: "not-a-url" })).toThrow();
  });
});
