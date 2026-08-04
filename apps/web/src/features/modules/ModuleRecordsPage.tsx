import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import "./module-records.css";

type ModuleName =
  | "projects"
  | "procurement"
  | "crm"
  | "finance"
  | "inventory"
  | "tasks"
  | "alerts";
type ModuleRecord = {
  id: string;
  candidate_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const moduleCopy: Record<
  ModuleName,
  { eyebrow: string; title: string; empty: string }
> = {
  projects: {
    eyebrow: "PROJECT RECORDS",
    title: "工地管理",
    empty: "暂无已确认的工地信息",
  },
  procurement: {
    eyebrow: "PROCUREMENT RECORDS",
    title: "主材采购",
    empty: "暂无已确认的采购信息",
  },
  crm: {
    eyebrow: "CUSTOMER RECORDS",
    title: "客户销售",
    empty: "暂无已确认的客户信息",
  },
  finance: {
    eyebrow: "FINANCE RECORDS",
    title: "财务记录",
    empty: "暂无已确认的财务信息",
  },
  inventory: {
    eyebrow: "INVENTORY RECORDS",
    title: "库存管理",
    empty: "暂无已确认的库存信息",
  },
  tasks: {
    eyebrow: "TASK RECORDS",
    title: "最近待办",
    empty: "暂无已确认的待办提醒",
  },
  alerts: {
    eyebrow: "OWNER ALERTS",
    title: "老板要情",
    empty: "暂无已确认的重要事项",
  },
};

export function ModuleRecordsPage({ module }: { module: ModuleName }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ModuleRecord[]>([]);
  const [error, setError] = useState("");
  const copy = moduleCopy[module];
  useEffect(() => {
    fetch(`/api/modules/${module}/records`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((body) => setItems(body.items ?? []))
      .catch(() => setError("正式记录暂时无法加载"));
  }, [module]);

  return (
    <section className="module-records">
      <header>
        <span>{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>仅展示经老板确认后写入的正式信息。</p>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="module-records__list">
        {items.map((item) => (
          <RecordCard
            key={item.id}
            item={item}
            module={module}
            editable={user?.role === "owner"}
            onSaved={(saved) =>
              setItems((current) =>
                current.map((value) => (value.id === saved.id ? saved : value)),
              )
            }
          />
        ))}
        {!items.length && !error ? (
          <div className="module-records__empty">{copy.empty}</div>
        ) : null}
      </div>
    </section>
  );
}

function RecordCard({
  item,
  module,
  editable,
  onSaved,
}: {
  item: ModuleRecord;
  module: ModuleName;
  editable: boolean;
  onSaved: (item: ModuleRecord) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState(item.kind);
  const [fields, setFields] = useState(() =>
    Object.entries(item.payload)
      .filter(
        ([key]) =>
          !["sourceMessageIds", "agentReasoning", "extractedAt"].includes(key),
      )
      .map(([key, value]) => ({ key, value: editableValue(value) })),
  );
  async function save() {
    const payload: Record<string, unknown> = Object.fromEntries(
      Object.entries(item.payload).filter(([key]) => ["sourceMessageIds", "agentReasoning", "extractedAt"].includes(key)),
    );
    for (const field of fields) {
      if (field.key.trim()) payload[field.key.trim()] = field.value;
    }
    setSaving(true);
    setError("");
    const response = await fetch(`/api/modules/${module}/records/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("保存失败，请刷新后重试");
      return;
    }
    onSaved(await response.json());
    setEditing(false);
  }
  return (
    <article>
      {editing ? (
        <div className="module-editor">
          <div className="module-editor__heading">
            <strong>编辑正式记录</strong>
            <button onClick={() => setEditing(false)}>
              <X size={14} />
              取消
            </button>
          </div>
          <label>
            <span>事件类型</span>
            <input
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            />
          </label>
          <div className="module-editor__fields">
            {fields.map((field, index) => (
              <div key={`${field.key}-${index}`}>
                <input
                  aria-label={`字段名 ${index + 1}`}
                  value={field.key}
                  onChange={(event) =>
                    setFields((current) =>
                      current.map((value, i) =>
                        i === index
                          ? { ...value, key: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                <textarea
                  aria-label={`字段值 ${index + 1}`}
                  value={field.value}
                  onChange={(event) =>
                    setFields((current) =>
                      current.map((value, i) =>
                        i === index
                          ? { ...value, value: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                <button
                  aria-label={`删除字段 ${index + 1}`}
                  onClick={() =>
                    setFields((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="module-editor__add"
            onClick={() =>
              setFields((current) => [...current, { key: "", value: "" }])
            }
          >
            <Plus size={14} />
            增加自定义字段
          </button>
          {error ? <p role="alert">{error}</p> : null}
          <button
            className="module-editor__save"
            disabled={saving || !kind.trim()}
            onClick={() => void save()}
          >
            <Check size={15} />
            {saving ? "保存中…" : "保存修改"}
          </button>
        </div>
      ) : (
        <>
          <div>
            <strong>
              {String(item.payload.title || kindLabel(item.kind))}
            </strong>
            <span>已确认</span>
            {editable ? (
              <button
                className="module-record__edit"
                onClick={() => setEditing(true)}
              >
                <Pencil size={13} />
                编辑并保存
              </button>
            ) : null}
          </div>
          {item.payload.projectName ? (
            <p>{String(item.payload.projectName)}</p>
          ) : null}
          <dl>
            {visibleEntries(item.payload).map(([key, value]) => (
              <div key={key}>
                <dt>{fieldLabel(key)}</dt>
                <dd>{displayValue(value)}</dd>
              </div>
            ))}
          </dl>
          <small>
            {new Date(item.created_at).toLocaleString("zh-CN", {
              hour12: false,
            })}
          </small>
        </>
      )}
    </article>
  );
}

function visibleEntries(payload: Record<string, unknown>) {
  return Object.entries(payload).filter(
    ([key, value]) =>
      ![
        "title",
        "projectName",
        "sourceMessageIds",
        "sourceCount",
        "agentReasoning",
        "extractedAt",
      ].includes(key) &&
      value !== "" &&
      value !== null &&
      value !== undefined,
  );
}
function displayValue(value: unknown) {
  return Array.isArray(value)
    ? value.join("、")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
function editableValue(value: unknown) {
  return Array.isArray(value)
    ? value.join("、")
    : value && typeof value === "object"
      ? JSON.stringify(value)
      : String(value ?? "");
}
function kindLabel(kind: string) {
  return (
    (
      {
        construction_progress: "施工进度",
        event: "项目事项",
        todo: "待办",
        risk: "风险",
        acceptance: "验收",
        digest: "项目简报",
        material: "材料事项",
        procurement: "采购事项",
        customer_requirement: "客户需求",
        financial_record: "财务记录",
        inventory_record: "库存记录",
        todo_reminder: "待办提醒",
        owner_alert: "老板要情",
      } as Record<string, string>
    )[kind] || kind
  );
}
function fieldLabel(key: string) {
  return (
    (
      {
        summary: "摘要",
        details: "详情",
        description: "说明",
        owner: "负责人",
        status: "状态",
        event_date: "发生日期",
        due_date: "截止日期",
        dueDate: "截止日期",
        dueAt: "要求时间",
        phase: "施工阶段",
        location: "位置",
        progress: "进度",
        risk_level: "风险等级",
        riskLevel: "风险等级",
        recommendation: "建议",
        priority: "优先级",
        next_action: "下一步",
      } as Record<string, string>
    )[key] || key
  );
}
