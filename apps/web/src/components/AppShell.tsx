import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Boxes,
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  DraftingCompass,
  HardHat,
  LayoutDashboard,
  PackageSearch,
  Settings,
  Sparkles,
  Bot,
  BellRing,
  UsersRound,
  Save,
  PencilLine,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { MobileTabBar } from "./MobileTabBar";
import "../styles/page-edit.css";
import { useInterfaceTexts } from "../features/settings/InterfaceTextProvider";

const navItems: Array<{ label: string; path: string; icon: LucideIcon; badge?: string }> = [
  { label: "老板首页", path: "/", icon: LayoutDashboard },
  { label: "工地管理", path: "/projects", icon: HardHat },
  { label: "主材采购", path: "/materials", icon: PackageSearch },
  { label: "客户销售", path: "/customers", icon: UsersRound },
  { label: "设计报价", path: "/quotations", icon: DraftingCompass },
  { label: "财务中心", path: "/finance", icon: CircleDollarSign },
  { label: "库存管理", path: "/inventory", icon: Boxes },
  { label: "员工排班", path: "/schedule", icon: CalendarClock },
  { label: "Agent 中心", path: "/agents", icon: Bot },
  { label: "AI 待确认", path: "/ai-review", icon: ClipboardCheck },
  { label: "最近待办", path: "/tasks", icon: CalendarClock },
  { label: "老板要情", path: "/alerts", icon: BellRing },
  { label: "系统设置", path: "/settings", icon: Settings },
];
const rolePaths={owner:null,management:new Set(["/","/projects","/materials","/customers","/inventory","/schedule","/tasks"]),employee:new Set(["/","/projects","/schedule","/tasks"])} as const;
const roleLabels={owner:"老板账号",management:"管理层账号",employee:"员工账号"} as const;

export function AppShell({ children,role="owner" }: { children: ReactNode;role?:keyof typeof rolePaths }) {
  const {editing,saving,startPageEdit,cancelPageEdit,savePageEdit}=useInterfaceTexts();
  const[editError,setEditError]=useState("");
  const[pendingCount,setPendingCount]=useState(0);
  useEffect(()=>{if(role!=="owner")return;const load=()=>fetch("/api/review/candidates").then(r=>r.ok?r.json():null).then(body=>{if(body)setPendingCount(body.items?.length??0)}).catch(()=>undefined);void load();const listener=(event:Event)=>setPendingCount(Number((event as CustomEvent).detail)||0);window.addEventListener("review-count-changed",listener);const timer=setInterval(()=>void load(),30000);return()=>{window.removeEventListener("review-count-changed",listener);clearInterval(timer)}},[role]);
  const visibleItems=rolePaths[role]?navItems.filter(item=>rolePaths[role]!.has(item.path)):navItems;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">SL</div>
          <div>
            <strong>双龙装饰</strong>
            <span>AI 经营管理中心</span>
          </div>
        </div>
        <nav aria-label="主导航" className="main-nav">
          {visibleItems.map(({ label, path, icon: Icon, ...item }) => (
            <NavLink key={path} to={path} end={path === "/"} className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {path==="/ai-review"&&pendingCount>0 ? <span className="nav-badge">{pendingCount}</span> : null}
              <ChevronRight className="nav-chevron" size={15} aria-hidden="true" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Sparkles size={18} aria-hidden="true" />
          <div><strong>AI 助手在线</strong><span>仅生成候选建议</span></div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand" aria-label="双龙装饰 · AI 经营管理中心">
            <span className="brand-mark brand-mark--small">SL</span>
            <strong>双龙装饰 · AI 经营管理中心</strong>
          </div>
          <div className="topbar-spacer" />
          {role==="owner"?<div className="page-edit-actions" data-no-page-edit>{editing?<><button type="button" onClick={cancelPageEdit}><X size={15}/>取消</button><button type="button" className="is-primary" disabled={saving} onClick={()=>{setEditError("");void savePageEdit().catch(error=>setEditError(error instanceof Error?error.message:"保存失败"))}}><Save size={15}/>{saving?"保存中…":"保存页面"}</button></>:<button type="button" onClick={startPageEdit}><PencilLine size={15}/>编辑页面</button>}{editError?<span role="alert">{editError}</span>:null}</div>:null}
          <span className="secure-state"><BadgeCheck size={16} aria-hidden="true" />权限保护</span>
          <button className="owner-profile" type="button" aria-label="打开老板账户菜单">
            <span className="owner-avatar">龙</span>
            <span><strong>{roleLabels[role]}</strong><small>{role==="owner"?"经营总览":"岗位视图"}</small></span>
          </button>
        </header>
        <main className="main-content">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}

export function ModulePreview({ title }: { title: string }) {
  return (
    <section className="module-preview">
      <div className="module-preview__icon"><BriefcaseBusiness size={28} /></div>
      <span className="eyebrow">正式功能模块</span>
      <h1>{title}</h1>
      <p>该模块正在独立开发中；开发和发布不会影响当前已上线功能。</p>
      <span className="preview-chip">建设中</span>
    </section>
  );
}
