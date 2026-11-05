import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  Package,
  Search,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { LoadingBlock, PriorityBadge, StatusBadge } from "../components/Ui";
import { formatDuration, formatTime } from "../format";
import type { WorkOrder } from "../types";

const lanes = [
  {
    key: "pending",
    label: "待处理",
    helper: "待分派 / 已分派",
    statuses: ["OPEN", "ASSIGNED"],
    tone: "amber",
  },
  {
    key: "working",
    label: "维修中",
    helper: "现场执行",
    statuses: ["IN_PROGRESS"],
    tone: "blue",
  },
  {
    key: "recovery",
    label: "恢复确认",
    helper: "维修完成 / 待核验",
    statuses: ["REPAIR_COMPLETED", "RECOVERY_PENDING"],
    tone: "teal",
  },
  {
    key: "closed",
    label: "已闭环",
    helper: "已恢复 / 已关闭",
    statuses: ["RECOVERED", "CLOSED"],
    tone: "green",
  },
] as const;

const nextStatus: Record<string, string | null> = {
  DRAFT: "OPEN",
  OPEN: "ASSIGNED",
  ASSIGNED: "IN_PROGRESS",
  IN_PROGRESS: "REPAIR_COMPLETED",
  REPAIR_COMPLETED: "RECOVERY_PENDING",
  RECOVERY_PENDING: "RECOVERED",
  RECOVERED: "CLOSED",
  ESCALATED: "OPEN",
  CLOSED: null,
};

const nextLabel: Record<string, string> = {
  OPEN: "提交待分派",
  ASSIGNED: "确认分派",
  IN_PROGRESS: "开始维修",
  REPAIR_COMPLETED: "完成维修",
  RECOVERY_PENDING: "提交恢复核验",
  RECOVERED: "确认已恢复",
  CLOSED: "关闭工单",
};

export function WorkOrders() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("现场状态已核实，按流程推进。");
  const [query, setQuery] = useState("");
  const [highOnly, setHighOnly] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const response = await api.workOrders();
    setOrders(response.items);
    setLoading(false);
  };

  useEffect(() => {
    load().catch((reason: Error) => {
      setError(reason.message);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (highOnly && order.priority !== "HIGH") return false;
      if (!keyword) return true;
      return [order.code, order.title, order.asset_code, order.asset_name, order.assignee]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [orders, query, highOnly]);

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        lanes.map(({ key, statuses }) => [
          key,
          filtered.filter((order) => statuses.includes(order.status as never)),
        ]),
      ),
    [filtered],
  );

  const openOrder = async (id: string) => {
    setSelected(await api.workOrder(id));
  };

  const advance = async () => {
    if (!selected) return;
    const target = nextStatus[selected.status];
    if (!target) return;
    setError("");
    try {
      const updated = await api.transitionWorkOrder(selected.id, target, note);
      setSelected(updated);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "状态更新失败");
    }
  };

  if (loading) return <LoadingBlock label="正在载入检修工单" />;

  return (
    <div className="page work-order-page">
      <div className="page-heading compact-heading">
        <div>
          <span className="page-eyebrow">MAINTENANCE WORKFLOW</span>
          <h1>检修工单工作台</h1>
          <p>按处理阶段查看工单，维修完成与恢复产出保持独立责任链。</p>
        </div>
        <div className="work-order-kpis">
          <div><strong>{orders.length}</strong><span>全部工单</span></div>
          <div><strong>{orders.filter((item) => item.priority === "HIGH").length}</strong><span>高优先级</span></div>
          <div><strong>{orders.filter((item) => item.status === "RECOVERY_PENDING").length}</strong><span>待恢复</span></div>
        </div>
      </div>

      <div className="work-order-toolbar">
        <div className="work-order-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索工单号、设备或负责人"
          />
        </div>
        <button
          className={`filter-button ${highOnly ? "active" : ""}`}
          onClick={() => setHighOnly((value) => !value)}
        >
          <Filter size={15} />
          只看高优先级
        </button>
        <span className="work-order-result">当前显示 {filtered.length} 张工单</span>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <div className="kanban clean-kanban">
        {lanes.map(({ key, label, helper, tone }) => {
          const items = grouped[key] || [];
          return (
            <section className={`kanban-column lane-${tone}`} key={key}>
              <header>
                <div>
                  <span className={`kanban-dot lane-dot-${tone}`} />
                  <strong>{label}</strong>
                  <small>{helper}</small>
                </div>
                <em>{items.length}</em>
              </header>
              <div className="kanban-stack">
                {items.map((order) => (
                  <button
                    key={order.id}
                    className="kanban-card"
                    onClick={() => openOrder(order.id)}
                  >
                    <div className="kanban-card-top">
                      <span>{order.code}</span>
                      <PriorityBadge value={order.priority} />
                    </div>
                    <strong className="kanban-card-title">{order.title}</strong>
                    <p className="kanban-asset">
                      <span>{order.asset_code}</span>
                      {order.asset_name}
                    </p>
                    <div className="kanban-card-status">
                      <StatusBadge value={order.status} />
                    </div>
                    <div className="kanban-card-foot">
                      <span><UserRound size={13} />{order.assignee}</span>
                      <span><Clock3 size={13} />{formatTime(order.updated_at)}</span>
                    </div>
                  </button>
                ))}
                {!items.length && (
                  <div className="kanban-empty">
                    <CheckCircle2 size={18} />
                    <span>暂无工单</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside className="order-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span className="drawer-code">{selected.code}</span>
                <h2>{selected.title}</h2>
                <p>{selected.asset_code} · {selected.asset_name} · {selected.location}</p>
              </div>
              <button className="icon-button" onClick={() => setSelected(null)} aria-label="关闭详情">
                <X size={18} />
              </button>
            </div>

            <div className="drawer-status">
              <StatusBadge value={selected.status} />
              <PriorityBadge value={selected.priority} />
              <span>负责人 · {selected.assignee}</span>
            </div>

            <div className="order-stage-strip">
              {[
                ["OPEN", "待分派"],
                ["ASSIGNED", "已分派"],
                ["IN_PROGRESS", "维修中"],
                ["REPAIR_COMPLETED", "维修完成"],
                ["RECOVERY_PENDING", "待恢复"],
                ["CLOSED", "关闭"],
              ].map(([status, label], index) => {
                const order = [
                  "OPEN",
                  "ASSIGNED",
                  "IN_PROGRESS",
                  "REPAIR_COMPLETED",
                  "RECOVERY_PENDING",
                  "RECOVERED",
                  "CLOSED",
                ].indexOf(selected.status);
                const reached = index <= Math.max(order, 0);
                return (
                  <div key={status} className={reached ? "reached" : ""}>
                    <i />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>

            <div className="order-detail-grid">
              <div><UserRound size={16} /><span>负责人</span><strong>{selected.assignee}</strong></div>
              <div><CalendarClock size={16} /><span>停机窗口</span><strong>{selected.downtime_window}</strong></div>
              <div><FileText size={16} /><span>手册版本</span><strong>{selected.manual_version}</strong></div>
              <div><Package size={16} /><span>备件</span><strong>{selected.spare_parts}</strong></div>
            </div>

            <section className="drawer-section">
              <h3>工单说明</h3>
              <p className="drawer-description">{selected.description}</p>
            </section>

            <section className="drawer-section">
              <h3>维修完成与恢复产出</h3>
              <div className="recovery-grid">
                <div>
                  <span>维修完成</span>
                  <strong>{formatTime(selected.repair_completed_at)}</strong>
                  <small>只表示现场维修动作结束</small>
                </div>
                <div>
                  <span>恢复产出</span>
                  <strong>{formatTime(selected.recovered_at)}</strong>
                  <small>必须由授权人员独立确认</small>
                </div>
                <div>
                  <span>累计处理时长</span>
                  <strong>{formatDuration(selected.created_at, selected.recovered_at)}</strong>
                </div>
              </div>
            </section>

            <section className="drawer-section">
              <h3>状态时间线</h3>
              <div className="work-timeline">
                {selected.timeline?.map((event) => (
                  <article key={event.id}>
                    <span className="timeline-node"><CheckCircle2 size={15} /></span>
                    <div>
                      <div className="timeline-title">
                        <StatusBadge value={event.status} />
                        <small>{formatTime(event.created_at)}</small>
                      </div>
                      <p>{event.note}</p>
                      <small>{event.actor}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {nextStatus[selected.status] && (
              <div className="drawer-action">
                <label>
                  <span>操作说明</span>
                  <input value={note} onChange={(event) => setNote(event.target.value)} />
                </label>
                <button className="primary-button" onClick={advance}>
                  <Wrench size={16} />
                  {nextLabel[nextStatus[selected.status] || ""] || "推进状态"}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
