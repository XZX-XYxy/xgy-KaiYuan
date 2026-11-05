export type Asset = {
  id: string;
  code: string;
  name: string;
  alias: string;
  model: string;
  location: string;
  group_name: string;
  status: string;
  criticality: string;
  last_seen: string;
  active_alarm_count: number;
  open_order_count: number;
};

export type WorkOrder = {
  id: string;
  code: string;
  asset_id: string;
  alarm_group_id: string | null;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  description: string;
  manual_version: string;
  spare_parts: string;
  downtime_window: string;
  created_at: string;
  updated_at: string;
  repair_completed_at: string | null;
  recovered_at: string | null;
  asset_code: string;
  asset_name: string;
  asset_alias: string;
  location?: string;
  group_name?: string;
  timeline?: TimelineEvent[];
};

export type TimelineEvent = {
  id: number;
  work_order_id: string;
  status: string;
  actor: string;
  note: string;
  created_at: string;
};

export type AlarmEvent = {
  id: number;
  group_id: string;
  raw_event_id: string;
  event_id: string | null;
  device_id: string;
  asset_id: string;
  metric: string;
  value: number;
  unit: string;
  threshold: number;
  occurred_at: string;
  ingested_at: string;
  source_cycle: string | null;
  is_backfilled: number;
  source: string;
};

export type AiEvidence = {
  id: string;
  title: string;
  source: string;
  url: string;
  content: string;
};

export type AiResult = {
  summary: string;
  riskLevel?: string;
  duplicateAssessment?: string;
  newEventCandidates?: { title: string; reason: string }[];
  recommendedChecks?: string[];
  confidence?: number;
  citations?: string[];
  evidence?: AiEvidence[];
  model?: string;
  allowedNextStep?: string;
  guardrailViolations?: string[];
};

export type AiRun = {
  id: number;
  alarm_group_id: string;
  model: string;
  summary: string;
  evidence: AiEvidence[];
  confidence: number;
  status: string;
  created_at: string;
  riskLevel?: string;
  duplicateAssessment?: string;
  newEventCandidates?: { title: string; reason: string }[];
  recommendedChecks?: string[];
  citations?: string[];
  allowedNextStep?: string;
  guardrailViolations?: string[];
};

export type AlarmGroup = {
  id: string;
  asset_id: string;
  title: string;
  risk_level: string;
  status: string;
  reason: string;
  first_occurrence: string;
  last_occurrence: string;
  first_ingest: string;
  last_ingest: string;
  event_count: number;
  missing_event_id: number;
  is_new_event: number;
  ai_status: string;
  asset_code: string;
  asset_name: string;
  asset_alias: string;
  group_name?: string;
  location?: string;
  model?: string;
  work_order_code?: string | null;
  work_order_status?: string | null;
  events?: AlarmEvent[];
  workOrder?: WorkOrder | null;
  latestAiRun?: AiRun | null;
};

export type DashboardSummary = {
  kpis: {
    assets: number;
    activeAlarms: number;
    openOrders: number;
    duplicateCandidates: number;
    restoredToday: number;
    rawEvents: number;
  };
  assets: Asset[];
  workOrders: WorkOrder[];
  activities: AuditLog[];
  trend: { time: string; alarms: number; telemetry: number }[];
};

export type AuditLog = {
  id: number;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  source: string;
  url: string;
  content: string;
  tags: string[];
  score?: number;
};

export type GraphNode = {
  id: string;
  label: string;
  type: "core" | "category" | "domain" | "document";
  group: string;
  url?: string;
};

export type GraphEdge = {
  source: string;
  target: string;
  relation: string;
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  knowledgeCount: number;
};
