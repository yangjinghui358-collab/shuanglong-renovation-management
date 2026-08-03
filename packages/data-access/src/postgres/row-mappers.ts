import type { DashboardSnapshot } from "../ports/dashboard-reader";

export interface SourceFreshnessRow {
  last_message_at: Date | string | null;
}

export interface ProjectRow {
  project_id: string;
  project_name: string;
  stage: string | null;
  progress: number | string | null;
  risk_level: string | null;
  todo_id: string | null;
  risk_id: string | null;
  evidence_id: string | null;
  excerpt: string | null;
  occurred_at: Date | string | null;
  sender_name: string | null;
}

export interface DigestRow {
  digest_id: string;
  title: string | null;
  summary: string | null;
  created_at: Date | string | null;
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function unicodePrefix(value: string, maxCharacters: number): string {
  return Array.from(value).slice(0, maxCharacters).join("");
}

function mapRiskLevel(
  value: string | null,
): DashboardSnapshot["projects"][number]["riskLevel"] {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "none";
}

export function mapSourceFreshness(
  row: SourceFreshnessRow | undefined,
): DashboardSnapshot["sourceFreshness"] {
  return {
    lastMessageAt: toIsoString(row?.last_message_at ?? null),
    status: "real",
    statusLabel: "真实数据",
  };
}

export function mapProjectRows(
  rows: ProjectRow[],
): DashboardSnapshot["projects"] {
  return rows.map((row) => {
    const progress = Number(row.progress ?? 0);
    const evidence = row.excerpt
      ? [
          {
            id: row.evidence_id ?? `${row.project_id}:latest-event`,
            sourceType: "event" as const,
            excerpt: unicodePrefix(row.excerpt, 160),
            occurredAt: toIsoString(row.occurred_at),
            senderName: row.sender_name,
          },
        ]
      : [];

    const hasDerivedFacts = Boolean(
      row.todo_id ?? row.risk_id ?? row.evidence_id,
    );

    return {
      id: String(row.project_id),
      name: row.project_name,
      stage: row.stage ?? "待识别",
      progress: Number.isFinite(progress)
        ? Math.min(100, Math.max(0, progress))
        : 0,
      riskLevel: mapRiskLevel(row.risk_level),
      evidence,
      ...(hasDerivedFacts
        ? {
            status: "pending_confirmation" as const,
            statusLabel: "待确认" as const,
          }
        : { status: "real" as const, statusLabel: "真实数据" as const }),
    };
  });
}

export function mapDigest(
  row: DigestRow | undefined,
): DashboardSnapshot["digest"] {
  if (!row) {
    return null;
  }

  const summary = row.summary ?? "";
  return {
    title: row.title ?? "AI 经营简报",
    summary,
    evidence: summary
      ? [
          {
            id: row.digest_id,
            sourceType: "digest",
            excerpt: unicodePrefix(summary, 160),
            occurredAt: toIsoString(row.created_at),
            senderName: null,
          },
        ]
      : [],
    status: "ai_inferred",
    statusLabel: "AI 推测",
  };
}
