import { CircleUserRound, ClipboardCheck, HardHat, House, UsersRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const tabs = [
  { label: "首页", path: "/", icon: House },
  { label: "工地", path: "/projects", icon: HardHat },
  { label: "客户", path: "/customers", icon: UsersRound },
  { label: "待办", path: "/ai-review", icon: ClipboardCheck, badge: 6 },
  { label: "我的", path: "/settings", icon: CircleUserRound },
];

export function MobileTabBar() {
  return (
    <nav className="mobile-tab-bar" aria-label="手机导航">
      {tabs.map(({ label, path, icon: Icon, badge }) => (
        <NavLink key={path} to={path} end={path === "/"} className={({ isActive }) => `mobile-tab${isActive ? " is-active" : ""}`}>
          <span className="mobile-tab__icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" />{badge ? <i aria-hidden="true">{badge}</i> : null}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
