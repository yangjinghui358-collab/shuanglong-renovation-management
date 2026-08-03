import { describe, expect, it } from "vitest";

import { loadEnv } from "./env";

describe("loadEnv", () => {
  const base = {
    MANAGEMENT_DATABASE_URL: "postgresql://writer@127.0.0.1:15432/wecom_chat",
    ADMIN_PHONE: "18600000000",
    ADMIN_INITIAL_PASSWORD: "temporary-password-123",
    AGENT_INGEST_TOKEN: "agent-token-at-least-24-characters",
  };
  it("adds PostgreSQL read-only session options", () => {
    const result = loadEnv({
      WECOM_DATABASE_URL: "postgresql://reader@127.0.0.1:15432/wecom_chat",
      ...base,
    });

    const url = new URL(result.WECOM_DATABASE_URL);
    expect(url.searchParams.get("options")).toContain(
      "default_transaction_read_only=on",
    );
  });

  it("rejects an invalid database URL", () => {
    expect(() => loadEnv({ WECOM_DATABASE_URL: "not-a-url", ...base })).toThrow();
  });
});
