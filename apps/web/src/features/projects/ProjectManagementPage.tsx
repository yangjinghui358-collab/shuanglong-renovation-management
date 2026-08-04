import type { OwnerDashboard } from "@shuanglong/contracts";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  HardHat,
  Image,
  ListTodo,
  MessageSquareText,
  PackageSearch,
  Pencil,
  Search,
  ShieldAlert,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useOwnerDashboard } from "../dashboard/useOwnerDashboard";
import "./project-management.css";

type Project = OwnerDashboard["projects"][number];
type ModuleRecord = {
  id: string;
  candidate_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
};
type Tab =
  | "overview"
  | "progress"
  | "tasks"
  | "risks"
  | "materials"
  | "acceptance"
  | "activity"
  | "evidence";
const tabs: Array<{ key: Tab; label: string; icon: typeof HardHat }> = [
  { key: "overview", label: "项目概况", icon: HardHat },
  { key: "progress", label: "施工进度", icon: Clock3 },
  { key: "tasks", label: "待办事项", icon: ListTodo },
  { key: "risks", label: "问题风险", icon: ShieldAlert },
  { key: "materials", label: "主材到货", icon: PackageSearch },
  { key: "acceptance", label: "验收记录", icon: ClipboardCheck },
  { key: "activity", label: "今日动态", icon: MessageSquareText },
  { key: "evidence", label: "证据档案", icon: Image },
];
const riskLabel = {
  none: "正常",
  low: "低风险",
  medium: "需关注",
  high: "高风险",
};
const constructionStages = [
  { name: "开工准备", description: "交底、保护、人员进场" },
  { name: "拆除改造", description: "拆除、清运、结构改造" },
  { name: "水电施工", description: "定位、布管、打压测试" },
  { name: "防水施工", description: "找坡、刷胶、闭水试验" },
  { name: "瓦工施工", description: "砌筑、找平、墙地砖" },
  { name: "木工施工", description: "吊顶、造型、基层制作" },
  { name: "油工施工", description: "基层、腻子、涂料施工" },
  { name: "主材安装", description: "门柜、洁具、灯具安装" },
  { name: "竣工验收", description: "联检、整改、客户验收" },
  { name: "交付售后", description: "交付、归档、质保维护" },
] as const;

export function ProjectManagementPage() {
  const { user } = useAuth();
  const { data, error, isPending, refetch } = useOwnerDashboard();
  const [records, setRecords] = useState<ModuleRecord[]>([]);
  const [overrides, setOverrides] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [recordError, setRecordError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    fetch("/api/modules/projects/records")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((body) => {
        setRecords(body.items ?? []);
        setOverrides(body.overrides ?? {});
      })
      .catch(() => setRecordError("已确认工地记录暂时无法加载"));
  }, []);
  const projects = useMemo(
    () => mergeProjectOverrides(data?.projects ?? [], overrides),
    [data?.projects, overrides],
  );
  const filtered = useMemo(
    () =>
      projects.filter((project) => {
        const text =
          `${project.name} ${project.ownerName} ${project.stage}`.toLowerCase();
        const matches = text.includes(keyword.trim().toLowerCase());
        const state =
          project.riskLevel === "high"
            ? "high"
            : project.delayDays > 0
              ? "delayed"
              : "normal";
        return matches && (filter === "all" || filter === state);
      }),
    [projects, keyword, filter],
  );
  const selected =
    projects.find((project) => project.id === selectedId) ?? null;
  const projectRecords = selected
    ? records.filter((record) => projectRecordMatches(record, selected))
    : [];
  if (isPending)
    return (
      <div className="projects-loading">
        <span />
        <span />
        <span />
      </div>
    );
  if (error || !data)
    return (
      <section className="projects-error">
        <AlertTriangle />
        <h1>工地数据暂时无法加载</h1>
        <button onClick={() => void refetch()}>重新加载</button>
      </section>
    );
  if (selected)
    return (
      <ProjectDetail
        project={selected}
        records={projectRecords}
        tab={tab}
        setTab={setTab}
        onBack={() => setSelectedId(null)}
        isOwner={user?.role === "owner"}
        onSaved={(payload) =>
          setOverrides((current) => ({ ...current, [selected.id]: payload }))
        }
      />
    );

  const delayed = projects.filter((project) => project.delayDays > 0).length;
  const highRisk = projects.filter(
    (project) => project.riskLevel === "high",
  ).length;
  const normal = projects.filter(
    (project) => project.delayDays <= 0 && project.riskLevel !== "high",
  ).length;
  return (
    <section className="projects-page">
      <header className="projects-heading">
        <div>
          <span>PROJECT OPERATIONS</span>
          <h1>工地管理</h1>
          <p>统一查看施工进度、延期风险、任务、材料和现场记录。</p>
        </div>
        {user?.role === "owner" ? (
          <Link to="/agents" className="project-agent-link">
            <Bot size={17} />
            <span>安排数字员工整理工地</span>
            <ChevronRight size={15} />
          </Link>
        ) : null}
      </header>
      <section className="project-metrics">
        <Metric icon={HardHat} label="在建工地" value={projects.length} />
        <Metric
          icon={CheckCircle2}
          label="正常施工"
          value={normal}
          tone="success"
        />
        <Metric icon={Clock3} label="延期工地" value={delayed} tone="warning" />
        <Metric
          icon={ShieldAlert}
          label="高风险工地"
          value={highRisk}
          tone="danger"
        />
      </section>
      <div className="project-toolbar">
        <label>
          <Search size={16} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索工地、负责人或施工阶段"
          />
        </label>
        <div>
          {[
            ["all", "全部"],
            ["normal", "正常"],
            ["delayed", "延期"],
            ["high", "高风险"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "is-active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {recordError ? (
        <p className="project-inline-error">{recordError}</p>
      ) : null}
      <div className="project-table" role="table" aria-label="工地列表">
        <div className="project-table__head" role="row">
          <span>工地</span>
          <span>施工阶段</span>
          <span>总进度</span>
          <span>负责人</span>
          <span>工期状态</span>
          <span>风险</span>
          <span>最近更新</span>
          <span />
        </div>
        {filtered.map((project) => (
          <button
            type="button"
            role="row"
            className="project-row"
            key={project.id}
            onClick={() => {
              setSelectedId(project.id);
              setTab("overview");
            }}
          >
            <span className="project-name">
              <strong>{project.name}</strong>
              <small>企业微信项目群已关联</small>
            </span>
            <span>{project.stage || "待识别"}</span>
            <span className="progress-cell">
              <i>
                <b style={{ width: `${project.progress}%` }} />
              </i>
              <small>{project.progress}%</small>
            </span>
            <span>{project.ownerName}</span>
            <span
              className={
                project.delayDays > 0 ? "text-warning" : "text-success"
              }
            >
              {project.delayDays > 0 ? `延期 ${project.delayDays} 天` : "正常"}
            </span>
            <span>
              <RiskBadge risk={project.riskLevel} />
            </span>
            <span>
              {data.sourceFreshness.lastMessageAt
                ? formatDate(data.sourceFreshness.lastMessageAt)
                : "暂无"}
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
        {!filtered.length ? (
          <div className="project-empty">没有符合当前筛选条件的工地</div>
        ) : null}
      </div>
      <p className="project-source-note">
        当前列表使用已关联的正式项目数据；Agent 推测必须确认后才会改变正式进度。
      </p>
    </section>
  );
}

function ProjectDetail({
  project,
  records,
  tab,
  setTab,
  onBack,
  isOwner,
  onSaved,
}: {
  project: Project;
  records: ModuleRecord[];
  tab: Tab;
  setTab: (tab: Tab) => void;
  onBack: () => void;
  isOwner: boolean;
  onSaved: (payload: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const relevant = records.filter((record) => recordForTab(record, tab));
  return (
    <section className="project-detail">
      <div className="project-detail-actions">
        <button className="project-back" onClick={onBack}>
          <ArrowLeft size={16} />
          返回工地列表
        </button>
        {isOwner ? (
          <button
            className="project-edit-button"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? <X size={15} /> : <Pencil size={15} />}{" "}
            {editing ? "取消编辑" : "编辑工地档案"}
          </button>
        ) : null}
      </div>
      <header>
        <div>
          <span>PROJECT PROFILE</span>
          <h1>{project.name}</h1>
          <p>正式工地档案 · 企业微信项目群已关联</p>
        </div>
        <div className="project-health">
          <RiskBadge risk={project.riskLevel} />
          <strong>{project.progress}%</strong>
          <small>整体进度</small>
        </div>
      </header>
      {editing ? (
        <ProjectEditor
          project={project}
          onSaved={(payload) => {
            onSaved(payload);
            setEditing(false);
          }}
        />
      ) : null}
      <section className="project-facts">
        <Fact
          icon={Clock3}
          label="当前阶段"
          value={project.stage || "待识别"}
        />
        <Fact icon={UsersRound} label="项目负责人" value={project.ownerName} />
        <Fact
          icon={CalendarDays}
          label="工期状态"
          value={
            project.delayDays > 0 ? `延期 ${project.delayDays} 天` : "正常"
          }
        />
        <Fact
          icon={AlertTriangle}
          label="当前问题"
          value={project.issue || "暂无异常"}
        />
      </section>
      <nav className="project-tabs" aria-label="工地详情栏目">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={tab === item.key ? "is-active" : ""}
              onClick={() => setTab(item.key)}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="project-tab-content">
        {tab === "overview" ? (
          <Overview project={project} records={records} />
        ) : tab === "progress" ? (
          <Progress project={project} records={relevant} />
        ) : (
          <RecordSection tab={tab} records={relevant} isOwner={isOwner} />
        )}
      </div>
    </section>
  );
}

function ProjectEditor({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    stage: project.stage || "",
    progress: String(project.progress),
    ownerName: project.ownerName,
    delayDays: String(project.delayDays),
    riskLevel: project.riskLevel,
    issue: project.issue || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function save() {
    const progress = Math.max(0, Math.min(100, Number(form.progress) || 0));
    const delayDays = Math.max(0, Number(form.delayDays) || 0);
    const payload = { ...form, progress, delayDays };
    setSaving(true);
    setError("");
    const response = await fetch(
      `/api/modules/projects/entities/${encodeURIComponent(project.id)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!response.ok) {
      setError("工地档案保存失败");
      return;
    }
    onSaved(payload);
  }
  return (
    <section className="project-profile-editor">
      <header>
        <div>
          <strong>自定义工地状态和文字</strong>
          <small>保存后立即用于工地列表、详情和施工流程显示。</small>
        </div>
      </header>
      <div>
        <label>
          工地名称
          <input
            value={form.name}
            onChange={(event) => field("name", event.target.value)}
          />
        </label>
        <label>
          当前阶段
          <input
            value={form.stage}
            onChange={(event) => field("stage", event.target.value)}
            placeholder="可输入任意自定义阶段"
          />
        </label>
        <label>
          总进度（0-100）
          <input
            type="number"
            min="0"
            max="100"
            value={form.progress}
            onChange={(event) => field("progress", event.target.value)}
          />
        </label>
        <label>
          负责人
          <input
            value={form.ownerName}
            onChange={(event) => field("ownerName", event.target.value)}
          />
        </label>
        <label>
          延期天数
          <input
            type="number"
            min="0"
            value={form.delayDays}
            onChange={(event) => field("delayDays", event.target.value)}
          />
        </label>
        <label>
          风险状态
          <select
            value={form.riskLevel}
            onChange={(event) =>
              field("riskLevel", event.target.value as typeof form.riskLevel)
            }
          >
            <option value="none">正常</option>
            <option value="low">低风险</option>
            <option value="medium">需关注</option>
            <option value="high">高风险</option>
          </select>
        </label>
        <label className="wide">
          当前问题 / 状态说明
          <textarea
            value={form.issue}
            onChange={(event) => field("issue", event.target.value)}
            placeholder="页面显示的状态文字，可完全自定义"
          />
        </label>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <button
        disabled={saving || !form.name.trim() || !form.stage.trim()}
        onClick={() => void save()}
      >
        <Check size={16} />
        {saving ? "保存中…" : "保存工地档案"}
      </button>
    </section>
  );
}

function Overview({
  project,
  records,
}: {
  project: Project;
  records: ModuleRecord[];
}) {
  return (
    <div className="project-overview">
      <article>
        <span>当前施工</span>
        <h2>{project.stage || "施工阶段待确认"}</h2>
        <p>{project.issue || "目前没有已确认异常。"}</p>
        <div className="overview-progress">
          <i>
            <b style={{ width: `${project.progress}%` }} />
          </i>
          <strong>{project.progress}%</strong>
        </div>
      </article>
      <article>
        <span>已确认动态</span>
        <h2>{records.length} 条</h2>
        <p>
          {records.length
            ? "所有记录均经过老板确认，可进入工地正式视图。"
            : "目前没有更多已确认的工地动态。"}
        </p>
      </article>
      <article>
        <span>下一阶段</span>
        <h2>{nextAction(records) || nextConstructionStage(project.stage)}</h2>
        <p>聊天提炼结果不会自动成为施工指令。</p>
      </article>
      <ConstructionFlow project={project} />
    </div>
  );
}
function Progress({
  project,
  records,
}: {
  project: Project;
  records: ModuleRecord[];
}) {
  return (
    <section className="stage-panel">
      <header>
        <div>
          <span>施工时间轴</span>
          <h2>{project.stage || "当前阶段待识别"}</h2>
        </div>
        <strong>{project.progress}%</strong>
      </header>
      <div className="stage-track">
        <i>
          <b style={{ width: `${project.progress}%` }} />
        </i>
      </div>
      <ConstructionFlow project={project} />
      {records.length ? (
        <RecordCards records={records} />
      ) : (
        <EmptyState
          icon={Clock3}
          title="暂无更多已确认进度"
          description="数字员工提炼或项目经理提交的进度，经确认后会显示在这里。"
        />
      )}
    </section>
  );
}
function ConstructionFlow({ project }: { project: Project }) {
  const current = constructionStageIndex(project.stage);
  return (
    <section className="construction-flow" aria-label="整体施工流程">
      <header>
        <div>
          <span>FULL CONSTRUCTION FLOW</span>
          <h2>整体施工流程</h2>
          <p>从开工准备到交付售后，按阶段查看已完成、正在施工和下一步。</p>
        </div>
        <div>
          <strong>
            {Math.max(0, current)}/{constructionStages.length}
          </strong>
          <small>阶段已完成</small>
        </div>
      </header>
      <ol>
        {constructionStages.map((stage, index) => {
          const state =
            index < current
              ? "done"
              : index === current
                ? "current"
                : "pending";
          return (
            <li key={stage.name} className={`flow-stage flow-stage--${state}`}>
              <div className="flow-marker">
                {state === "done" ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div>
                <strong>{stage.name}</strong>
                <small>{stage.description}</small>
                {state === "current" ? (
                  <em>当前施工</em>
                ) : state === "done" ? (
                  <em>已完成</em>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <footer>
        <span>
          当前：<strong>{constructionStages[current].name}</strong>
        </span>
        <ChevronRight size={14} />
        <span>
          下一阶段：
          <strong>
            {constructionStages[current + 1]?.name || "项目已进入交付售后"}
          </strong>
        </span>
      </footer>
    </section>
  );
}
function RecordSection({
  tab,
  records,
  isOwner,
}: {
  tab: Tab;
  records: ModuleRecord[];
  isOwner: boolean;
}) {
  const copy: Record<
    Tab,
    { title: string; description: string; icon: typeof HardHat }
  > = {
    overview: { title: "项目概况", description: "", icon: HardHat },
    progress: { title: "施工进度", description: "", icon: Clock3 },
    tasks: {
      title: "暂无已确认待办",
      description: "工地任务确认后会显示负责人、期限和状态。",
      icon: ListTodo,
    },
    risks: {
      title: "暂无已确认问题风险",
      description: "高风险事项会同步进入老板要情。",
      icon: ShieldAlert,
    },
    materials: {
      title: "暂无已关联主材记录",
      description: "采购、到货和验收信息将在这里关联展示。",
      icon: PackageSearch,
    },
    acceptance: {
      title: "暂无验收记录",
      description: "阶段验收和整改复验会长期保存在项目档案中。",
      icon: ClipboardCheck,
    },
    activity: {
      title: "暂无更多正式动态",
      description: "员工提交和聊天提炼经确认后按时间展示。",
      icon: MessageSquareText,
    },
    evidence: {
      title: "暂无可展示证据",
      description: isOwner
        ? "已授权的聊天、图片和文件证据会显示在这里。"
        : "完整证据仅老板账号可查看。",
      icon: Image,
    },
  };
  return records.length ? (
    <RecordCards records={records} hideEvidence={!isOwner} />
  ) : (
    <EmptyState
      icon={copy[tab].icon}
      title={copy[tab].title}
      description={copy[tab].description}
    />
  );
}
function RecordCards({
  records,
  hideEvidence = false,
}: {
  records: ModuleRecord[];
  hideEvidence?: boolean;
}) {
  return (
    <div className="project-records">
      {records.map((record) => (
        <article key={record.id}>
          <header>
            <strong>
              {String(record.payload.title || kindLabel(record.kind))}
            </strong>
            <span>已确认</span>
          </header>
          <dl>
            {Object.entries(record.payload)
              .filter(
                ([key, value]) =>
                  value !== "" &&
                  value != null &&
                  !(
                    [
                      "sourceMessageIds",
                      "agentReasoning",
                      "extractedAt",
                    ].includes(key) ||
                    (hideEvidence && key.toLowerCase().includes("source"))
                  ),
              )
              .slice(0, 8)
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{fieldLabel(key)}</dt>
                  <dd>{displayValue(value)}</dd>
                </div>
              ))}
          </dl>
          <small>{formatDate(record.created_at)}</small>
        </article>
      ))}
    </div>
  );
}
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof HardHat;
  title: string;
  description: string;
}) {
  return (
    <div className="project-tab-empty">
      <Icon size={28} />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  tone = "",
}: {
  icon: typeof HardHat;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className={tone ? `metric-${tone}` : ""}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HardHat;
  label: string;
  value: string;
}) {
  return (
    <div>
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function RiskBadge({ risk }: { risk: Project["riskLevel"] }) {
  return (
    <span className={`risk-badge risk-badge--${risk}`}>{riskLabel[risk]}</span>
  );
}
function projectRecordMatches(record: ModuleRecord, project: Project) {
  const name = String(record.payload.projectName || "").trim();
  return (
    !name ||
    name === project.name ||
    String(record.payload.groupId || "") === project.id
  );
}
function mergeProjectOverrides(
  projects: Project[],
  overrides: Record<string, Record<string, unknown>>,
): Project[] {
  return projects.map((project) => {
    const value = overrides[project.id];
    if (!value) return project;
    return {
      ...project,
      name: typeof value.name === "string" ? value.name : project.name,
      stage: typeof value.stage === "string" ? value.stage : project.stage,
      progress: Number.isFinite(Number(value.progress))
        ? Math.max(0, Math.min(100, Number(value.progress)))
        : project.progress,
      ownerName:
        typeof value.ownerName === "string"
          ? value.ownerName
          : project.ownerName,
      delayDays: Number.isFinite(Number(value.delayDays))
        ? Math.max(0, Number(value.delayDays))
        : project.delayDays,
      riskLevel: ["none", "low", "medium", "high"].includes(
        String(value.riskLevel),
      )
        ? (value.riskLevel as Project["riskLevel"])
        : project.riskLevel,
      issue: typeof value.issue === "string" ? value.issue : project.issue,
    };
  });
}
function recordForTab(record: ModuleRecord, tab: Tab) {
  const kinds: Partial<Record<Tab, string[]>> = {
    progress: ["construction_progress", "event", "digest"],
    tasks: ["todo", "todo_reminder"],
    risks: ["risk", "owner_alert"],
    materials: ["material", "procurement"],
    acceptance: ["acceptance"],
    activity: ["event", "construction_progress", "digest"],
    evidence: ["event", "construction_progress", "risk", "acceptance"],
  };
  return kinds[tab]?.includes(record.kind) ?? false;
}
function nextAction(records: ModuleRecord[]) {
  const value = records
    .map((record) => record.payload.next_action || record.payload.nextAction)
    .find(Boolean);
  return value ? String(value) : "";
}
function constructionStageIndex(stage: string) {
  const value = String(stage || "").toLowerCase();
  const matches = [
    /准备|开工|交底/,
    /拆除|拆改/,
    /水电/,
    /防水/,
    /瓦工|泥工|贴砖/,
    /木工/,
    /油工|乳胶漆|涂料/,
    /安装|主材|吊顶|橱柜|洁具/,
    /竣工|验收/,
    /交付|售后|保修/,
  ];
  const index = matches.findIndex((pattern) => pattern.test(value));
  return index < 0 ? 0 : index;
}
function nextConstructionStage(stage: string) {
  return (
    constructionStages[constructionStageIndex(stage) + 1]?.name || "交付售后"
  );
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
      } as Record<string, string>
    )[kind] || kind
  );
}
function fieldLabel(key: string) {
  return (
    (
      {
        projectName: "工地",
        summary: "摘要",
        details: "详情",
        description: "说明",
        owner: "负责人",
        status: "状态",
        event_date: "发生日期",
        due_date: "截止日期",
        dueDate: "截止日期",
        phase: "施工阶段",
        location: "位置",
        progress: "进度",
        risk_level: "风险等级",
        riskLevel: "风险等级",
        recommendation: "建议",
        priority: "优先级",
        next_action: "下一步",
        nextAction: "下一步",
        sourceCount: "证据数量",
      } as Record<string, string>
    )[key] || key
  );
}
function displayValue(value: unknown) {
  return Array.isArray(value)
    ? value.join("、")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
