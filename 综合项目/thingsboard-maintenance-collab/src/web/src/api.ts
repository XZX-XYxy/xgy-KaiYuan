import type {
  AiResult,
  AlarmGroup,
  DashboardSummary,
  KnowledgeDoc,
  KnowledgeGraph,
  WorkOrder,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<DashboardSummary>("/api/dashboard/summary"),
  refreshDemo: () =>
    request<{ refreshed: boolean; telemetryEvents: number; alarmEvents: number; refreshedAt: string }>(
      "/api/demo/refresh",
      { method: "POST" },
    ),
  alarmGroups: () => request<{ items: AlarmGroup[] }>("/api/alarm-groups"),
  alarmGroup: (id: string) => request<AlarmGroup>(`/api/alarm-groups/${id}`),
  reviewAlarmGroup: (id: string, status: string, reason: string) =>
    request<AlarmGroup>(`/api/alarm-groups/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status, reason, actor: "罗启山" }),
    }),
  analyze: (id: string) =>
    request<AlarmGroup>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({ alarm_group_id: id }),
    }),
  createWorkOrder: (groupId: string) =>
    request<WorkOrder>(`/api/alarm-groups/${groupId}/work-order`, {
      method: "POST",
      body: JSON.stringify({ actor: "陶书原" }),
    }),
  workOrders: () => request<{ items: WorkOrder[] }>("/api/work-orders"),
  workOrder: (id: string) => request<WorkOrder>(`/api/work-orders/${id}`),
  transitionWorkOrder: (id: string, status: string, note: string) =>
    request<WorkOrder>(`/api/work-orders/${id}/transition`, {
      method: "POST",
      body: JSON.stringify({ status, note, actor: "段之衡" }),
    }),
  knowledgeSearch: (query: string) =>
    request<{ items: KnowledgeDoc[] }>(
      `/api/knowledge/search?q=${encodeURIComponent(query)}&limit=40`,
    ),
  knowledgeGraph: () => request<KnowledgeGraph>("/api/knowledge/graph"),
  askKnowledge: (question: string) =>
    request<AiResult>("/api/ai/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
};
