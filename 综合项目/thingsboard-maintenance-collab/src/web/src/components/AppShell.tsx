import {
  BellRing,
  ChevronRight,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Network,
  Search,
  ShieldCheck,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navigation = [
  { to: "/", label: "运营总览", icon: LayoutDashboard },
  { to: "/alarms", label: "告警中心", icon: BellRing },
  { to: "/work-orders", label: "检修工单", icon: ClipboardList },
  { to: "/knowledge", label: "知识图谱", icon: Network },
];

const pageNames: Record<string, string> = {
  "/": "运营总览",
  "/alarms": "告警中心",
  "/work-orders": "检修工单",
  "/knowledge": "知识图谱",
};

export function AppShell() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Factory size={20} /></div>
          <div>
            <strong>设备协同台</strong>
            <span>MAINTENANCE OPS</span>
          </div>
        </div>

        <div className="site-context">
          <span>岚桥设备运维站</span>
          <strong>虚拟演示环境</strong>
        </div>

        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} aria-label={label}>
              <Icon size={19} strokeWidth={2.1} />
              <span>{label}</span>
              <ChevronRight size={15} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-note">
          <ShieldCheck size={17} />
          <div>
            <strong>AI 只读边界</strong>
            <span>不控制设备，不替代人工审批</span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <span>ThingsBoard 设备遥测与检修协同</span>
            <ChevronRight size={14} />
            <strong>{pageNames[location.pathname] || "运营总览"}</strong>
          </div>
          <div className="topbar-tools">
            <div className="quick-search"><Search size={15} /><span>搜索设备、告警或工单</span></div>
            <div className="operator">
              <span className="operator-dot" />
              <div><strong>罗启山</strong><small>设备运维经理</small></div>
            </div>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
