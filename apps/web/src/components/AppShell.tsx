import type { ReactNode } from "react";
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
  UsersRound,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { MobileTabBar } from "./MobileTabBar";

const navItems: Array<{ label: string; path: string; icon: LucideIcon; badge?: string }> = [
  { label: "老板首页", path: "/", icon: LayoutDashboard },
  { label: "工地管理", path: "/projects", icon: HardHat },
  { label: "主材采购", path: "/materials", icon: PackageSearch },
  { label: "客户销售", path: "/customers", icon: UsersRound },
  { label: "设计报价", path: "/quotations", icon: DraftingCompass },
  { label: "财务中心", path: "/finance", icon: CircleDollarSign },
  { label: "库存管理", path: "/inventory", icon: Boxes },
  { label: "员工排班", path: "/schedule", icon: CalendarClock },
  { label: "AI 待确认", path: "/ai-review", icon: ClipboardCheck, badge: "6" },
  { label: "系统设置", path: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
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
          {navItems.map(({ label, path, icon: Icon, ...item }) => (
            <NavLink key={path} to={path} end={path === "/"} className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
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
          <span className="secure-state"><BadgeCheck size={16} aria-hidden="true" />只读预览</span>
          <button className="owner-profile" type="button" aria-label="打开老板账户菜单">
            <span className="owner-avatar">龙</span>
            <span><strong>老板账号</strong><small>经营总览</small></span>
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
      <span className="eyebrow">PHASE 1A · 功能预览</span>
      <h1>{title}</h1>
      <p>该模块已纳入统一经营平台规划，当前阶段先展示老板工作台与只读经营数据。</p>
      <span className="preview-chip">即将开放</span>
    </section>
  );
}
