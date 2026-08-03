import type { DashboardReader, DashboardSnapshot } from "../ports/dashboard-reader";

const DEMO_STATUS = {
  status: "demo" as const,
  statusLabel: "演示数据" as const,
};

function after(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1_000).toISOString();
}

export function createDemoOperationsReader(now: Date): DashboardReader {
  const generatedAt = new Date(now);

  return {
    async read(): Promise<DashboardSnapshot> {
      return {
        sourceFreshness: {
          lastMessageAt: null,
          ...DEMO_STATUS,
        },
        digest: {
          title: "AI 经营简报",
          summary: "暂无真实简报连接，以下为功能演示。",
          evidence: [],
          ...DEMO_STATUS,
        },
        metrics: [
          {
            key: "material_arrivals",
            label: "今日应到材料",
            value: "1 批",
            ...DEMO_STATUS,
          },
          {
            key: "high_intent_leads",
            label: "高意向客户",
            value: "1 位",
            ...DEMO_STATUS,
          },
          {
            key: "pending_approvals",
            label: "老板待确认",
            value: "4 项",
            ...DEMO_STATUS,
          },
        ],
        projects: [],
        materials: [
          {
            id: "demo-material-arrival-1",
            projectName: "演示工地 A",
            materialName: "瓷砖到货批次",
            state: "待验收",
            expectedAt: after(generatedAt, 3),
            ...DEMO_STATUS,
          },
          {
            id: "demo-inventory-1",
            projectName: "公司演示仓库",
            materialName: "防水涂料库存预警",
            state: "库存偏低",
            expectedAt: null,
            ...DEMO_STATUS,
          },
        ],
        leads: [
          {
            id: "demo-lead-1",
            customerName: "演示客户 A",
            stage: "报价",
            probability: 70,
            nextActionAt: after(generatedAt, 5),
            ...DEMO_STATUS,
          },
        ],
        approvals: [
          {
            id: "demo-approval-quotation-1",
            type: "报价",
            title: "演示报价草稿待审核",
            amount: 128_000,
            ...DEMO_STATUS,
          },
          {
            id: "demo-approval-finance-1",
            type: "财务",
            title: "演示供应商付款待确认",
            amount: 18_600,
            ...DEMO_STATUS,
          },
          {
            id: "demo-approval-inventory-1",
            type: "库存",
            title: "演示库存盘点差异",
            amount: null,
            ...DEMO_STATUS,
          },
          {
            id: "demo-approval-scheduling-1",
            type: "排班",
            title: "演示班组排期冲突",
            amount: null,
            ...DEMO_STATUS,
          },
        ],
      };
    },
  };
}
