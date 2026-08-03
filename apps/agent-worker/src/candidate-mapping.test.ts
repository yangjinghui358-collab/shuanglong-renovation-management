import { describe, expect, it } from "vitest";
import { targetModule, toManagementCandidate } from "./candidate-mapping.mjs";

describe("chat draft candidate mapping", () => {
  it.each([
    ["construction_progress", "projects"],
    ["risk", "projects"],
    ["material", "procurement"],
    ["customer_requirement", "crm"],
    ["financial_record", "finance"],
    ["inventory_record", "inventory"],
  ])("maps %s to %s", (kind, module) => expect(targetModule(kind)).toBe(module));

  it("keeps evidence ids without copying message excerpts", () => {
    const result = toManagementCandidate({
      draft_id: 12, dedupe_key: "abc", module_type: "material", title: "确认瓷砖型号",
      project_name: "双龙项目", payload: { status: "待确认" }, confidence: 0.88,
      source_message_ids: ["msg-1"], source_count: 1, ai_reasoning: "聊天中明确提到",
      updated_at: "2026-08-04T00:00:00Z",
    });
    expect(result).toMatchObject({ module: "procurement", kind: "material", sourceKey: "wecom-ai-draft:12:abc" });
    expect(result?.payload).toMatchObject({ title: "确认瓷砖型号", sourceMessageIds: ["msg-1"], sourceCount: 1 });
    expect(JSON.stringify(result)).not.toContain("excerpt");
  });
});
