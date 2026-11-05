import type { ReactNode } from "react";

export function StatusBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    PENDING_REVIEW: "待评审",
    HUMAN_VERIFIED: "人工已确认",
    REJECTED: "已拒绝",
    ROLLED_BACK: "已回退",
    CLOSED: "已关闭",
    OPEN: "待分派",
    ASSIGNED: "已分派",
    IN_PROGRESS: "维修中",
    REPAIR_COMPLETED: "维修完成",
    RECOVERY_PENDING: "待恢复确认",
    RECOVERED: "已恢复",
    ESCALATED: "已升级",
    DRAFT: "草稿",
  };
  return <span className={`status-badge status-${value.toLowerCase()}`}>{map[value] || value}</span>;
}

export function PriorityBadge({ value }: { value: string }) {
  return <span className={`priority-badge priority-${value.toLowerCase()}`}>{value}</span>;
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          {eyebrow && <span className="panel-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function LoadingBlock({ label = "正在加载数据" }: { label?: string }) {
  return <div className="loading-block"><span className="loading-bar" />{label}</div>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{text}</span></div>;
}
