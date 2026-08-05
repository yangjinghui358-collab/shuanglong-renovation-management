const MODULE_MAP = Object.freeze({
  event: "projects",
  construction_progress: "projects",
  todo: "projects",
  risk: "projects",
  acceptance: "projects",
  digest: "projects",
  material: "procurement",
  customer_requirement: "crm",
  financial_record: "finance",
  inventory_record: "inventory",
  procurement: "procurement",
})

export function targetModule(moduleType) {
  return MODULE_MAP[moduleType] || null
}

export function toManagementCandidate(draft) {
  const module = targetModule(draft.module_type)
  if (!module) return null

  return {
    module,
    kind: String(draft.module_type),
    confidence: Math.max(0, Math.min(1, Number(draft.confidence) || 0)),
    sourceKey: `wecom-ai-draft:${draft.draft_id}:${draft.dedupe_key}`,
    payload: {
      title: String(draft.title || "").trim(),
      projectName: String(draft.project_name || "").trim(),
      ...objectPayload(draft.payload),
      sourceMessageIds: Array.isArray(draft.source_message_ids) ? draft.source_message_ids : [],
      sourceCount: Number(draft.source_count) || 0,
      agentReasoning: String(draft.ai_reasoning || "").trim(),
      extractedAt: dateValue(draft.updated_at),
      sourceDraftId: Number(draft.draft_id),
    },
  }
}

function objectPayload(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function dateValue(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
