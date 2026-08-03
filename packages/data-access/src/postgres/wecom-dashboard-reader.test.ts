import { describe, expect, it, vi } from "vitest";

import { createWecomDashboardReader } from "./wecom-dashboard-reader";

function sqlOf(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object" && "text" in input) {
    return String(input.text);
  }
  return "";
}

describe("createWecomDashboardReader", () => {
  it("keeps source freshness real while marking derived project facts as pending", async () => {
    const query = vi.fn(async (input: unknown) => {
      const sql = sqlOf(input).replaceAll(/\s+/g, " ").trim().toUpperCase();
      if (sql.startsWith("SELECT MAX(SENT_AT)")) {
        return { rows: [{ last_message_at: "2026-08-02T22:40:00+08:00" }] };
      }
      if (sql.includes("FROM GROUP_PROJECTS")) {
        return {
          rows: [
            {
              project_id: "p1",
              project_name: "测试工地甲",
              stage: "防水",
              progress: 62,
              risk_level: "medium",
              evidence_id: "event-1",
              excerpt: "合成施工事件摘要",
              occurred_at: "2026-08-02T22:20:00+08:00",
              sender_name: null,
            },
          ],
        };
      }
      if (sql.includes("FROM DIGESTS")) {
        return {
          rows: [
            {
              digest_id: "digest-1",
              title: "AI 经营简报",
              summary: "合成简报摘要",
              created_at: "2026-08-02T22:30:00+08:00",
            },
          ],
        };
      }
      return { rows: [] };
    });

    const snapshot = await createWecomDashboardReader({ query } as never).read();

    expect(snapshot.projects[0]).toMatchObject({
      name: "测试工地甲",
      status: "pending_confirmation",
      statusLabel: "待确认",
    });
    expect(snapshot.digest).toMatchObject({
      status: "ai_inferred",
      statusLabel: "AI 推测",
    });
    expect(snapshot.sourceFreshness.lastMessageAt).toContain("2026-08-02");
    expect(snapshot.materials).toEqual([]);
    expect(snapshot.leads).toEqual([]);
  });

  it("uses a read-only transaction and only approved SQL statements", async () => {
    const captured: string[] = [];
    const query = vi.fn(async (input: unknown) => {
      captured.push(sqlOf(input));
      return { rows: [] };
    });

    await createWecomDashboardReader({ query } as never).read();

    const allowed = /^(BEGIN|SET TRANSACTION READ ONLY|SELECT|COMMIT|ROLLBACK)\b/i;
    expect(captured.length).toBeGreaterThan(4);
    expect(captured.every((sql) => allowed.test(sql.trim()))).toBe(true);
    expect(captured[0]?.trim().toUpperCase()).toBe("BEGIN");
    expect(captured[1]?.trim().toUpperCase()).toBe("SET TRANSACTION READ ONLY");
    expect(captured.at(-1)?.trim().toUpperCase()).toBe("COMMIT");
  });

  it("caps evidence excerpts at 160 Unicode characters", async () => {
    const longExcerpt = "施".repeat(159) + "🧱🧱";
    const query = vi.fn(async (input: unknown) => {
      const sql = sqlOf(input).replaceAll(/\s+/g, " ").trim().toUpperCase();
      if (sql.includes("FROM GROUP_PROJECTS")) {
        return {
          rows: [
            {
              project_id: "p2",
              project_name: "测试工地乙",
              stage: null,
              progress: 0,
              risk_level: null,
              evidence_id: "event-2",
              excerpt: longExcerpt,
              occurred_at: null,
              sender_name: null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const snapshot = await createWecomDashboardReader({ query } as never).read();

    expect(Array.from(snapshot.projects[0]?.evidence[0]?.excerpt ?? "")).toHaveLength(
      160,
    );
  });

  it("rolls back when a read query fails", async () => {
    const captured: string[] = [];
    const query = vi.fn(async (input: unknown) => {
      const sql = sqlOf(input);
      captured.push(sql);
      if (sql.trimStart().toUpperCase().startsWith("SELECT")) {
        throw new Error("database unavailable");
      }
      return { rows: [] };
    });

    await expect(
      createWecomDashboardReader({ query } as never).read(),
    ).rejects.toThrow("database unavailable");
    expect(captured.at(-1)?.trim().toUpperCase()).toBe("ROLLBACK");
  });
});
