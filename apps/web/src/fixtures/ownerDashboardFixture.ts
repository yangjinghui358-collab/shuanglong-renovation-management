import { OwnerDashboardSchema } from "@shuanglong/contracts";

export const ownerDashboardFixture = {
  generatedAt: "2026-08-03T07:00:00+08:00",
  sourceFreshness: {
    lastMessageAt: "2026-08-02T22:40:00+08:00",
    status: "real",
    statusLabel: "真实数据",
  },
  digest: {
    title: "AI 经营简报",
    summary: "昨日 4 个工地有新进展，今日优先处理防水验收与两项报价审批。",
    status: "ai_inferred",
    statusLabel: "AI 推测",
    evidence: [{
      id: "digest-e1",
      sourceType: "digest",
      excerpt: "系统根据项目事件与待办聚合生成，需老板确认后形成正式事项。",
      occurredAt: "2026-08-03T07:00:00+08:00",
      senderName: "AI 经营助手",
    }],
  },
  metrics: [
    { key: "active_projects", label: "在建工地", value: "68", trend: "较昨日 +1", status: "real", statusLabel: "真实数据" },
    { key: "project_health", label: "工地正常率", value: "91%", trend: "保持稳定", status: "real", statusLabel: "真实数据" },
    { key: "delayed_projects", label: "延期工地", value: "3", trend: "1 个今日到期", status: "real", statusLabel: "真实数据" },
    { key: "materials_due", label: "今日应到材料", value: "6 批", trend: "2 批待确认", status: "demo", statusLabel: "演示数据" },
    { key: "hot_leads", label: "高意向客户", value: "8", trend: "预计 ¥86万", status: "demo", statusLabel: "演示数据" },
    { key: "receivable", label: "本月应收", value: "¥42.6万", trend: "以财务确认为准", status: "demo", statusLabel: "演示数据" },
  ],
  projects: [
    {
      id: "project-1", name: "测试工地甲", stage: "防水施工", progress: 62,
      riskLevel: "high", delayDays: 3, ownerName: "测试经理甲", issue: "合成闭水验收事项",
      status: "real", statusLabel: "真实数据",
      evidence: [{ id: "p1-e1", sourceType: "event", excerpt: "合成施工事件摘要", occurredAt: "2026-08-02T22:20:00+08:00", senderName: "测试经理" }],
    },
    {
      id: "project-2", name: "测试工地乙", stage: "木作施工", progress: 48,
      riskLevel: "medium", delayDays: 1, ownerName: "测试经理乙", issue: "合成板材到货事项",
      status: "ai_inferred", statusLabel: "AI 推测", evidence: [],
    },
    {
      id: "project-3", name: "测试工地丙", stage: "水电验收", progress: 31,
      riskLevel: "low", delayDays: 0, ownerName: "测试经理丙", issue: "合成现场验收事项",
      status: "real", statusLabel: "真实数据", evidence: [],
    },
  ],
  materials: [
    { id: "m1", projectName: "测试工地乙", materialName: "定制柜体板材", state: "物流待确认", expectedAt: "2026-08-03T16:00:00+08:00", status: "demo", statusLabel: "演示数据" },
  ],
  leads: [
    { id: "l1", customerName: "云栖意向客户 A", stage: "谈单", probability: 85, expectedAmount: 320000, nextActionAt: "2026-08-03T10:30:00+08:00", ownerName: "刘顾问", status: "demo", statusLabel: "演示数据" },
    { id: "l2", customerName: "滨河意向客户 B", stage: "报价", probability: 70, expectedAmount: 268000, nextActionAt: "2026-08-03T14:00:00+08:00", ownerName: "赵顾问", status: "demo", statusLabel: "演示数据" },
  ],
  approvals: [
    { id: "a1", type: "报价审批", title: "测试项目整装报价", amount: 318600, requestedAt: "2026-08-03T06:40:00+08:00", status: "pending_confirmation", statusLabel: "待确认" },
    { id: "a2", type: "财务审批", title: "主材供应商阶段款", amount: 42800, requestedAt: "2026-08-02T20:10:00+08:00", status: "demo", statusLabel: "演示数据" },
    { id: "a3", type: "排班冲突", title: "瓦工班组时间冲突", amount: null, requestedAt: "2026-08-02T18:20:00+08:00", status: "demo", statusLabel: "演示数据" },
  ],
} as const;

const demoStatus = {
  status: "demo" as const,
  statusLabel: "演示数据" as const,
};

export const demoOwnerDashboardFixture = OwnerDashboardSchema.parse({
  ...ownerDashboardFixture,
  sourceFreshness: {
    lastMessageAt: null,
    status: "demo",
    statusLabel: "真实数据暂不可用",
  },
  digest: { ...ownerDashboardFixture.digest, ...demoStatus },
  metrics: ownerDashboardFixture.metrics.map((record) => ({
    ...record,
    ...demoStatus,
  })),
  projects: ownerDashboardFixture.projects.map((record) => ({
    ...record,
    ...demoStatus,
  })),
  materials: ownerDashboardFixture.materials.map((record) => ({
    ...record,
    ...demoStatus,
  })),
  leads: ownerDashboardFixture.leads.map((record) => ({
    ...record,
    ...demoStatus,
  })),
  approvals: ownerDashboardFixture.approvals.map((record) => ({
    ...record,
    ...demoStatus,
  })),
});
