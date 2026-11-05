import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Layers3,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { LoadingBlock, Panel, PriorityBadge, StatusBadge } from "../components/Ui";
import { formatTime } from "../format";
import type { DashboardSummary } from "../types";

const metricMeta = [
  { key: "assets", label: "在册设备", icon: Cpu, hint: "6 个业务资产组" },
  { key: "activeAlarms", label: "活跃告警", icon: BellRing, hint: "含待人工评审候选" },
  { key: "openOrders", label: "未结工单", icon: ClipboardList, hint: "覆盖 5 个检修状态" },
  { key: "duplicateCandidates", label: "重复候选", icon: Layers3, hint: "全部可回退到原始事件" },
] as const;

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const refreshedRef = useRef(false);
  const overviewTime = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  useEffect(() => {
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    api
      .refreshDemo()
      .catch(() => null)
      .then(() => api.dashboard())
      .then(setSummary)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) {
    return <div className="page-error">无法加载运营总览：{error}</div>;
  }
  if (!summary) {
    return <LoadingBlock label="正在汇总遥测、告警与工单数据" />;
  }

  return (
    <div className="page dashboard-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">SITE OVERVIEW · {overviewTime}</span>
          <h1>设备运行与检修态势</h1>
          <p>遥测、告警和检修工单统一到一个可追溯的运行视图。</p>
        </div>
        <div className="live-chip"><span />数据更新于刚刚</div>
      </div>

      <section className="metric-grid">
        {metricMeta.map(({ key, label, icon: Icon, hint }, index) => (
          <article className="metric-card" key={key}>
            <div className={`metric-icon metric-icon-${index}`}>
              <Icon size={23} strokeWidth={2.25} />
            </div>
            <span>{label}</span>
            <strong>{summary.kpis[key]}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <Panel
          title="告警与遥测趋势"
          eyebrow="LAST 12 HOURS"
          className="trend-panel"
          action={<span className="chart-legend"><i />告警 <i />遥测</span>}
        >
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.trend} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="telemetryFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8ee" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#77879a", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#77879a", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ border: "1px solid #d6dfe7", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#334e68" }}
                />
                <Area type="monotone" dataKey="telemetry" stroke="#0f766e" strokeWidth={2} fill="url(#telemetryFill)" />
                <Area type="monotone" dataKey="alarms" stroke="#e58e26" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnotes">
            <div><strong>{summary.kpis.rawEvents}</strong><span>原始遥测事件</span></div>
            <div><strong>{summary.kpis.restoredToday}</strong><span>今日恢复确认</span></div>
            <div><strong>100%</strong><span>原始记录保留</span></div>
          </div>
        </Panel>

        <Panel
          title="设备状态"
          eyebrow="ASSET PULSE"
          className="asset-panel"
          action={<button className="text-button">全部设备 <ArrowUpRight size={14} /></button>}
        >
          <div className="asset-list">
            {summary.assets.map((asset) => (
              <article key={asset.id} className="asset-row">
                <div className={`asset-dot asset-${asset.status.toLowerCase()}`} />
                <div className="asset-main">
                  <div><strong>{asset.code}</strong><span>{asset.alias}</span></div>
                  <small>{asset.name} · {asset.location}</small>
                </div>
                <div className="asset-counts">
                  <span className={asset.active_alarm_count ? "has-alert" : ""}>
                    {asset.active_alarm_count} 告警
                  </span>
                  <span>{asset.open_order_count} 工单</span>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel
          title="优先处理工单"
          eyebrow="MAINTENANCE QUEUE"
          className="orders-panel"
          action={<button className="text-button">查看全部</button>}
        >
          <div className="order-table">
            <div className="order-table-head">
              <span>工单</span><span>设备</span><span>状态</span><span>负责人</span><span>更新时间</span>
            </div>
            {summary.workOrders.map((order) => (
              <div className="order-table-row" key={order.id}>
                <div><PriorityBadge value={order.priority} /><strong>{order.code}</strong></div>
                <span>{order.asset_code} · {order.asset_alias}</span>
                <StatusBadge value={order.status} />
                <span>{order.assignee}</span>
                <span>{formatTime(order.updated_at)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="最近活动" eyebrow="AUDIT TRAIL" className="activity-panel">
          <div className="activity-list">
            {summary.activities.map((item, index) => (
              <article key={item.id}>
                <div className={`activity-icon ${index === 0 ? "active" : ""}`}>
                  {index === 0 ? <Activity size={15} /> : index === 1 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                </div>
                <div>
                  <strong>{item.reason}</strong>
                  <span>{item.actor} · {item.target_type} / {item.target_id}</span>
                </div>
                <time>{formatTime(item.created_at)}</time>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
