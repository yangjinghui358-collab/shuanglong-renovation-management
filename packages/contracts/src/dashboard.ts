import { z } from "zod";

export const DataStatusSchema = z.enum([
  "real",
  "demo",
  "ai_inferred",
  "pending_confirmation",
  "confirmed",
  "rejected",
  "archived",
]);
export type DataStatus = z.infer<typeof DataStatusSchema>;

const LabeledDataSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("real"), statusLabel: z.literal("真实数据") }),
  z.object({ status: z.literal("demo"), statusLabel: z.literal("演示数据") }),
  z.object({ status: z.literal("ai_inferred"), statusLabel: z.literal("AI 推测") }),
  z.object({
    status: z.literal("pending_confirmation"),
    statusLabel: z.literal("待确认"),
  }),
  z.object({ status: z.literal("confirmed"), statusLabel: z.literal("已确认") }),
  z.object({ status: z.literal("rejected"), statusLabel: z.literal("已驳回") }),
  z.object({ status: z.literal("archived"), statusLabel: z.literal("已归档") }),
]);

const SourceFreshnessSchema = z.union([
  z.object({ lastMessageAt: z.string().nullable() }).and(LabeledDataSchema),
  z.object({
    lastMessageAt: z.null(),
    status: z.literal("demo"),
    statusLabel: z.literal("真实数据暂不可用"),
  }),
]);

export const DashboardEvidenceSchema = z.object({
  id: z.string(),
  sourceType: z.enum([
    "message",
    "digest",
    "todo",
    "risk",
    "event",
    "demo",
  ]),
  excerpt: z.string(),
  occurredAt: z.string().nullable(),
  senderName: z.string().nullable(),
});
export type DashboardEvidence = z.infer<typeof DashboardEvidenceSchema>;

export const OwnerDashboardSchema = z.object({
  generatedAt: z.string(),
  sourceFreshness: SourceFreshnessSchema,
  digest: z
    .object({
      title: z.string(),
      summary: z.string(),
      evidence: z.array(DashboardEvidenceSchema).default([]),
    })
    .and(LabeledDataSchema),
  metrics: z.array(
    z
      .object({
        key: z.string(),
        label: z.string(),
        value: z.string(),
        trend: z.string().optional(),
      })
      .and(LabeledDataSchema),
  ),
  projects: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        stage: z.string(),
        progress: z.number().min(0).max(100),
        riskLevel: z.enum(["none", "low", "medium", "high"]),
        delayDays: z.number().default(0),
        ownerName: z.string().default("待分配"),
        issue: z.string().default("暂无异常"),
        evidence: z.array(DashboardEvidenceSchema),
      })
      .and(LabeledDataSchema),
  ),
  materials: z.array(
    z
      .object({
        id: z.string(),
        projectName: z.string(),
        materialName: z.string(),
        state: z.string(),
        expectedAt: z.string().nullable(),
      })
      .and(LabeledDataSchema),
  ),
  leads: z.array(
    z
      .object({
        id: z.string(),
        customerName: z.string(),
        stage: z.string(),
        probability: z.number().min(0).max(100),
        expectedAmount: z.number().default(0),
        nextActionAt: z.string().nullable(),
        ownerName: z.string().default("待分配"),
      })
      .and(LabeledDataSchema),
  ),
  approvals: z.array(
    z
      .object({
        id: z.string(),
        type: z.string(),
        title: z.string(),
        amount: z.number().nullable(),
        requestedAt: z.string().default(""),
      })
      .and(LabeledDataSchema),
  ),
});
export type OwnerDashboard = z.infer<typeof OwnerDashboardSchema>;
export type OwnerDashboardInput = z.input<typeof OwnerDashboardSchema>;
