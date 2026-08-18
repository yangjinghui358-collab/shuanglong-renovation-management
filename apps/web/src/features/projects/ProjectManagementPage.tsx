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
import "./project-dashboard.css";

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
const fullFlowDemoProject: Project = {
  id: "demo-full-construction-flow",
  name: "全流程演示工地",
  stage: "木工施工",
  progress: 39,
  riskLevel: "medium",
  delayDays: 0,
  ownerName: "关丙刚（演示）",
  issue: "用于演示装修进度表中的全部施工、验收、收款和结算流程。",
  evidence: [],
  status: "demo",
  statusLabel: "演示数据",
};
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
  { name: "开工准备", days: 7, description: "签单、效果图、交底、首次收款" },
  { name: "水电", days: 7, description: "拆改、水电交底、施工与验收" },
  { name: "防水", days: 6, description: "材料进场、防水施工与验收" },
  { name: "瓦工施工", days: 7, description: "瓦工交底、铺贴、瓷砖验收" },
  { name: "美缝防护", days: 6, description: "二次收款、美缝、地面保护" },
  { name: "木工施工", days: 6, description: "木工交底、量尺、施工与验收" },
  { name: "油工施工", days: 27, description: "腻子、晾干、喷漆、油工验收" },
  { name: "定制安装", days: 10, description: "定制、木门、理石、吊顶安装验收" },
  { name: "收尾", days: 5, description: "电器安装、保洁、验收与尾款" },
] as const;

const scheduleNodes = [
  ["开工准备", "签单、收定金、组建施工群", "店长"], ["开工准备", "签单金额交给会计入账", "店长"], ["开工准备", "效果图（7天）", "设计师"], ["开工准备", "群内发电器清单", "设计师"], ["开工准备", "交钥匙、施工部交底（1天）", "设计师"], ["开工准备", "确认吉日开工时间", "设计师"], ["开工准备", "收第一次装修款", "店长"],
  ["水电", "拆除墙体", "项目经理"], ["水电", "垃圾清理", "项目经理"], ["水电", "瓦工砌筑", "项目经理"], ["水电", "水电交底", "设计师"], ["水电", "水电施工", "项目经理"], ["水电", "水电验收、验收单签字", "项目经理、设计师"], ["水电", "统计利润", "会计"],
  ["防水", "水泥沙子进场", "项目经理"], ["防水", "防水施工", "项目经理"], ["防水", "陪客户选瓷砖、瓷砖排版", "设计师"], ["防水", "瓷砖进场", "项目经理"], ["防水", "防水验收", "项目经理"],
  ["瓦工施工", "瓦工交底", "项目经理、设计师"], ["瓦工施工", "瓦工辅贴", "项目经理"], ["瓦工施工", "地漏、止逆阀送货", "项目经理"], ["瓦工施工", "垃圾清理", "项目经理"], ["瓦工施工", "瓷砖验收、验收单签字", "项目经理、设计师"], ["瓦工施工", "瓷砖返料", "项目经理"], ["瓦工施工", "统计利润", "会计"],
  ["美缝防护", "收第二次装修款", "店长"], ["美缝防护", "美缝施工", "项目经理"], ["美缝防护", "提醒客户电器尺寸", "设计师"], ["美缝防护", "美缝验收", "项目经理"], ["美缝防护", "地面保护", "项目经理"],
  ["木工施工", "木工交底", "项目经理、设计师"], ["木工施工", "木料进场", "项目经理"], ["木工施工", "木工施工", "项目经理"], ["木工施工", "木门量尺", "项目经理"], ["木工施工", "提醒定制量尺", "项目经理"], ["木工施工", "提醒木门量尺", "项目经理"], ["木工施工", "木工验收", "项目经理、设计师"], ["木工施工", "理石量尺", "店长"], ["木工施工", "统计利润", "会计"],
  ["油工施工", "石膏顺平（7天）", "项目经理"], ["油工施工", "定制量尺下单（7天内完成）", "定制设计师"], ["油工施工", "收第三次装修款", "店长"], ["油工施工", "理石安装", "项目经理"], ["油工施工", "群内发定制出厂时间（20天）", "定制设计师"], ["油工施工", "晾干（7天）", "项目经理"], ["油工施工", "二、三遍腻子（2天）", "项目经理"], ["油工施工", "晾干（7天）", "项目经理"], ["油工施工", "打砂纸、喷漆", "项目经理"], ["油工施工", "油工验收、验收单签字", "项目经理"], ["油工施工", "统计利润", "会计"],
  ["定制安装", "定制入场", "定制设计师"], ["定制安装", "定制安装（7天）", "定制设计师"], ["定制安装", "木门安装", "定制设计师"], ["定制安装", "理石量尺", "定制设计师、店长"], ["定制安装", "吊顶量尺", "项目经理"], ["定制安装", "定制补料", "定制设计师"], ["定制安装", "垃圾清理", "项目经理"], ["定制安装", "定制验收、验收单签字", "定制设计师、项目经理"],
  ["收尾", "灯具安装", "项目经理"], ["收尾", "开关插座", "项目经理"], ["收尾", "烟机入场", "项目经理"], ["收尾", "热水器入场", "项目经理"], ["收尾", "撤防护", "项目经理"], ["收尾", "开荒保洁", "项目经理"], ["收尾", "整体验收、自检", "项目经理"], ["收尾", "找零（2天）", "项目经理"], ["收尾", "整体验收、签验收单", "项目经理、设计师"], ["收尾", "交尾款、签质保单", "店长"],
  ["会计结算", "结账收尾款（5天）", "会计"],
] as const;

const demoProjectRecords: ModuleRecord[] = [
  { id: "demo-acceptance-water", candidate_id: "demo", kind: "acceptance", payload: { projectName: fullFlowDemoProject.name, phase: "水电", title: "水电验收", status: "已验收" }, created_at: "2026-08-18T00:00:00.000Z" },
  { id: "demo-acceptance-tile", candidate_id: "demo", kind: "acceptance", payload: { projectName: fullFlowDemoProject.name, phase: "瓦工", title: "瓷砖验收", status: "已验收" }, created_at: "2026-08-18T00:00:00.000Z" },
  { id: "demo-todo-carpentry", candidate_id: "demo", kind: "todo", payload: { projectName: fullFlowDemoProject.name, title: "木工完工后组织阶段验收", owner: "关丙刚、设计师", dueDate: "今天17:00", priority: "紧急", status: "待验收", sourceCount: 3, dataStatus: "demo" }, created_at: "2026-08-18T00:00:00.000Z" },
  { id: "demo-todo-payment", candidate_id: "demo", kind: "todo", payload: { projectName: fullFlowDemoProject.name, title: "收第三次装修款并通知会计", owner: "店长", dueDate: "油工阶段开始前", priority: "重要", status: "未开始", dataStatus: "demo" }, created_at: "2026-08-18T00:00:00.000Z" },
  { id: "demo-risk-material", candidate_id: "demo", kind: "risk", payload: { projectName: fullFlowDemoProject.name, title: "定制量尺时间待确认", riskLevel: "medium", status: "演示提醒", dataStatus: "demo" }, created_at: "2026-08-18T00:00:00.000Z" },
];

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
  const [overviewSelectedId, setOverviewSelectedId] = useState<string | null>(null);
  const [homeView, setHomeView] = useState<"projects" | "todos">("projects");
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
    () => mergeProjectOverrides([fullFlowDemoProject, ...(data?.projects ?? []).filter((project) => project.id !== fullFlowDemoProject.id)], overrides),
    [data?.projects, overrides],
  );
  const displayRecords = useMemo(() => [...demoProjectRecords, ...records], [records]);
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
    ? displayRecords.filter((record) => projectRecordMatches(record, selected))
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
  const todos = displayRecords.filter((record) =>
    ["todo", "todo_reminder"].includes(record.kind),
  );
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
      <section className="project-metrics project-metrics--with-todos">
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
        <Metric
          icon={ListTodo}
          label="全部待办"
          value={todos.length}
          tone="warning"
        />
      </section>
      <nav className="project-home-tabs" aria-label="工地管理视图">
        <button
          className={homeView === "projects" ? "is-active" : ""}
          onClick={() => setHomeView("projects")}
        >
          工地总览
        </button>
        <button
          className={homeView === "todos" ? "is-active" : ""}
          onClick={() => setHomeView("todos")}
        >
          所有工地待办 <strong>{todos.length}</strong>
        </button>
      </nav>
      {homeView === "projects" ? (
        <>
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
      <DashboardProjectOverview
        projects={filtered}
        records={displayRecords}
        selectedId={overviewSelectedId}
        onSelect={setOverviewSelectedId}
        onOpen={(projectId) => {
          setSelectedId(projectId);
          setTab("overview");
        }}
      />
      <p className="project-source-note">
        当前列表来自阿里云会话存档关联的正式项目数据；Agent 推测必须确认后才会改变正式进度。
      </p>
        </>
      ) : (
        <AllProjectTodos
          records={todos}
          projects={projects}
          onOpenProject={(projectId) => {
            setSelectedId(projectId);
            setTab("tasks");
          }}
        />
      )}
    </section>
  );
}

const acceptanceByStage = [
  "阶段启动", "水电验收", "防水验收", "瓷砖验收", "美缝验收",
  "木工验收", "油工验收", "定制验收", "整体验收",
] as const;

function DashboardProjectOverview({ projects, records, selectedId, onSelect, onOpen }: {
  projects: Project[];
  records: ModuleRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const project = projects.find((item) => item.id === selectedId) ?? projects[0];
  if (!project) return <div className="project-empty">没有符合当前筛选条件的工地</div>;
  const current = constructionStageIndex(project.stage);
  const projectRecords = records.filter((record) => projectRecordMatches(record, project));
  const todos = projectRecords.filter((record) => ["todo", "todo_reminder"].includes(record.kind));
  const risks = projectRecords.filter((record) => ["risk", "owner_alert"].includes(record.kind));
  const focusNodes = scheduleNodes.filter(([stage]) => stage === constructionStages[current]?.name).slice(0, 3);
  return <>
    <div className="dashboard-project-grid">
      <section className="dashboard-project-list">
        <header><h2>工地列表</h2><small>{projects.length} 个工地</small></header>
        {projects.map((item) => <button key={item.id} className={item.id === project.id ? "is-selected" : ""} onClick={() => onSelect(item.id)}>
          <strong>{item.name}{item.status === "demo" ? <em>演示数据</em> : null}</strong><small>{item.ownerName} · {item.stage || "待识别"} · {item.progress}%</small>
          <i><b style={{ width: `${item.progress}%` }} /></i>
        </button>)}
      </section>
      <section className="dashboard-project-flow">
        <header><div><h2>{project.name}{project.status === "demo" ? <em className="demo-project-tag">演示数据</em> : null}</h2><p>项目经理：{project.ownerName}　总工期：83天　当前进度：{project.progress}%</p></div><button onClick={() => onOpen(project.id)}>查看完整档案</button><strong className={project.delayDays > 0 ? "text-warning" : "text-success"}>● {project.delayDays > 0 ? `延期 ${project.delayDays} 天` : "正常施工"}</strong></header>
        <div className="dashboard-stage-grid">
          {constructionStages.map((stage, index) => {
            const state = index < current ? "done" : index === current ? "current" : "pending";
            const acceptance = projectRecords.find((record) => record.kind === "acceptance" && String(record.payload.phase || record.payload.title || "").includes(stage.name.replace("施工", "")));
            const acceptanceState = acceptance ? "已验收" : state === "done" ? "待负责人汇报" : state === "current" ? "施工中" : "未开始";
            return <div className={`dashboard-stage dashboard-stage--${state}`} key={stage.name}><div className="dashboard-stage-dot">{state === "done" ? "✓" : index + 1}</div><strong>{stage.name.replace("施工", "").replace("防护", "")}</strong><small>{stage.days}天</small><div className={`dashboard-acceptance ${acceptance ? "is-accepted" : state === "done" ? "is-waiting" : ""}`}><b>{acceptanceByStage[index]}</b><span>{acceptanceState}</span></div></div>;
          })}
        </div>
      </section>
    </div>
    <div className="dashboard-project-foot">
      <section><h2>近期节点</h2>{todos.slice(0, 3).map((record) => <div key={record.id}><b>{String(record.payload.title || record.payload.description || "待办事项")}</b><span>{String(record.payload.owner || "待分配")} · {String(record.payload.status || "待执行")}</span></div>)}{!todos.length ? <p>暂无已确认待办</p> : null}</section>
      <section><h2>今日重点</h2>{focusNodes.map(([stage, title, owner], index) => <div key={`${stage}-${title}-${index}`}><b>{title}</b><span>{owner}</span></div>)}</section>
      <section><h2>风险与提醒</h2><div><b className={risks.length ? "text-danger" : "text-success"}>{risks.length} 项风险</b><span>{risks.length ? "立即处理" : "暂无异常"}</span></div><div><b className="text-warning">{todos.filter((record) => !record.payload.owner).length} 项待分配</b><span>交待负责人</span></div></section>
    </div>
  </>;
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
          <p>与《装修进度表-统一工期6天》一致：总工期 83 天，按阶段查看施工、验收和收款节点。</p>
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
                <small>{stage.days}天 · {stage.description}</small>
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
          当前：<strong>{constructionStages[current]?.name || "开工准备"}</strong>
        </span>
        <ChevronRight size={14} />
        <span>
          下一阶段：
          <strong>
            {constructionStages[current + 1]?.name || "项目已进入结算归档"}
          </strong>
        </span>
      </footer>
      <ScheduleNodeTable project={project} />
    </section>
  );
}

function ScheduleNodeTable({ project }: { project: Project }) {
  const current = constructionStageIndex(project.stage);
  const stageSequences = new Map<string, number>();
  return (
    <section className="schedule-nodes" aria-label="施工进度全部环节">
      <header>
        <div>
          <span>CONSTRUCTION ITEMS</span>
          <h3>施工进度全部环节</h3>
        </div>
        <strong>{scheduleNodes.length} 项</strong>
      </header>
      <div className="schedule-node-table">
        <div className="schedule-node-head">
          <span>阶段</span><span>序号</span><span>项目名称</span><span>负责人</span><span>项目状态</span>
        </div>
        {scheduleNodes.map(([stage, title, owner], index) => {
          const stageIndex = constructionStages.findIndex((item) => item.name === stage);
          const sequence = (stageSequences.get(stage) ?? 0) + 1;
          stageSequences.set(stage, sequence);
          const state = stageIndex >= 0 && stageIndex < current
            ? "已完成"
            : stageIndex === current
              ? "进行中"
              : "未开始";
          return (
            <div key={`${stage}-${title}-${index}`}>
              <span>{stage}</span><span>{sequence}</span><strong>{title}</strong><span>{owner}</span>
              <em data-state={state}>{state}</em>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AllProjectTodos({
  records,
  projects,
  onOpenProject,
}: {
  records: ModuleRecord[];
  projects: Project[];
  onOpenProject: (projectId: string) => void;
}) {
  const rows = records.map((record) => {
    const projectName = String(record.payload.projectName || "待关联工地");
    const project = projects.find(
      (item) =>
        item.name === projectName ||
        item.id === String(record.payload.groupId || ""),
    );
    return {
      record,
      project,
      projectName,
      title: String(record.payload.title || record.payload.description || "待办事项"),
      owner: String(record.payload.owner || record.payload.ownerName || "待分配"),
      due: String(record.payload.due_date || record.payload.dueDate || "待确定"),
      priority: String(record.payload.priority || "普通"),
      status: String(record.payload.status || "待执行"),
      evidence: Number(record.payload.sourceCount || record.payload.evidenceCount || 0),
    };
  });
  const unassigned = rows.filter((row) => row.owner === "待分配").length;
  return (
    <section className="all-project-todos">
      <header>
        <div><span>CROSS-PROJECT TASKS</span><h2>所有工地待办</h2><p>由阿里云会话存档提炼并经确认的跨工地任务，统一查看负责人、期限和聊天证据。</p></div>
        <div><strong>{rows.length}</strong><small>全部</small><strong>{unassigned}</strong><small>待分配</small></div>
      </header>
      {rows.length ? (
        <div className="todo-table">
          <div className="todo-table-head"><span>优先级</span><span>工地 / 事项</span><span>负责人</span><span>截止时间</span><span>状态</span><span>操作</span></div>
          {rows.map(({ record, project, projectName, title, owner, due, priority, status, evidence }) => (
            <div key={record.id}>
              <span className={priority.includes("紧急") ? "text-danger" : ""}>{priority}</span>
              <span><strong>{projectName}</strong><small>{title}{evidence ? ` · 群聊 ${evidence} 条证据` : ""}</small></span>
              <span className={owner === "待分配" ? "text-warning" : ""}>{owner}</span>
              <span>{due}</span><span>{status}</span>
              <button disabled={!project} onClick={() => project && onOpenProject(project.id)}>{project ? "查看并交待" : "待关联"}</button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={ListTodo} title="暂无已确认的跨工地待办" description="会话存档中的任务需经老板确认后才会进入这里；不会把 AI 推测直接当成施工指令。" />
      )}
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
    /拆除|拆改|水电/,
    /防水/,
    /瓦工|泥工|贴砖/,
    /美缝|防护/,
    /木工/,
    /油工|乳胶漆|涂料/,
    /定制|安装|主材|吊顶|橱柜|洁具/,
    /收尾|竣工|交付|售后|保修/,
  ];
  const index = matches.findIndex((pattern) => pattern.test(value));
  return index < 0 ? 0 : index;
}
function nextConstructionStage(stage: string) {
  return (
    constructionStages[constructionStageIndex(stage) + 1]?.name || "结算归档"
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
