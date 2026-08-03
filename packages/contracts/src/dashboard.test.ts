import { describe, expect, it } from "vitest";

import { OwnerDashboardSchema } from "./dashboard";

describe("OwnerDashboardSchema", () => {
  it("rejects a demo card without an explicit demo label", () => {
    const result = OwnerDashboardSchema.safeParse({
      generatedAt: "2026-08-03T07:00:00+08:00",
      sourceFreshness: { lastMessageAt: null, status: "demo" },
      digest: { title: "今日简报", summary: "演示内容", status: "demo" },
      metrics: [
        { key: "finance", label: "本月收入", value: "¥0", status: "demo" },
      ],
      projects: [],
      materials: [],
      leads: [],
      approvals: [],
    });

    expect(result.success).toBe(false);
  });

  it("normalizes optional presentation fields used by the owner dashboard", () => {
    const result = OwnerDashboardSchema.parse({
      generatedAt: "2026-08-03T07:00:00+08:00",
      sourceFreshness: {
        lastMessageAt: "2026-08-02T22:40:00+08:00",
        status: "real",
        statusLabel: "真实数据",
      },
      digest: {
        title: "AI 经营简报",
        summary: "测试摘要",
        evidence: [],
        status: "real",
        statusLabel: "真实数据",
      },
      metrics: [],
      projects: [{
        id: "project-1",
        name: "测试工地甲",
        stage: "防水",
        progress: 62,
        riskLevel: "medium",
        evidence: [],
        status: "real",
        statusLabel: "真实数据",
      }],
      materials: [],
      leads: [{
        id: "lead-1",
        customerName: "测试客户甲",
        stage: "报价",
        probability: 70,
        nextActionAt: null,
        status: "demo",
        statusLabel: "演示数据",
      }],
      approvals: [{
        id: "approval-1",
        type: "报价审批",
        title: "测试审批",
        amount: null,
        status: "demo",
        statusLabel: "演示数据",
      }],
    });

    expect(result.projects[0]).toMatchObject({
      delayDays: 0,
      ownerName: "待分配",
      issue: "暂无异常",
    });
    expect(result.leads[0]).toMatchObject({
      expectedAmount: 0,
      ownerName: "待分配",
    });
    expect(result.approvals[0]?.requestedAt).toBe("");
  });

  it("rejects a status label that contradicts its data status", () => {
    const result = OwnerDashboardSchema.safeParse({
      generatedAt: "2026-08-03T07:00:00+08:00",
      sourceFreshness: {
        lastMessageAt: null,
        status: "demo",
        statusLabel: "真实数据",
      },
      digest: {
        title: "今日简报",
        summary: "演示内容",
        evidence: [],
        status: "demo",
        statusLabel: "演示数据",
      },
      metrics: [],
      projects: [],
      materials: [],
      leads: [],
      approvals: [],
    });

    expect(result.success).toBe(false);
  });
});
