import {
  AlertCircle,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  FileWarning,
  GitBranch,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState, LoadingBlock, StatusBadge } from "../components/Ui";
import { formatTime } from "../format";
import type { AiResult, AlarmGroup } from "../types";

const riskLabel: Record<string, string> = {
  CRITICAL: "紧急",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

export function AlarmCenter() {
  const [groups, setGroups] = useState<AlarmGroup[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<AlarmGroup | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [reason, setReason] = useState("已核对原始时间与设备编号，确认候选关系。");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const loadGroups = () =>
    api.alarmGroups().then(({ items }) => {
      setGroups(items);
      setSelectedId((current) => current || items[0]?.id || "");
    });

  useEffect(() => {
    loadGroups().catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.alarmGroup(selectedId).then(setDetail).catch((reason: Error) => setError(reason.message));
  }, [selectedId]);

  const summary = useMemo(() => {
    const pending = groups.filter((item) => item.status === "PENDING_REVIEW").length;
    const missing = groups.filter((item) => item.missing_event_id).length;
    return { pending, missing, total: groups.length };
  }, [groups]);

  const refreshDetail = async () => {
    if (!selectedId) return;
    setDetail(await api.alarmGroup(selectedId));
    await loadGroups();
  };

  const runAi = async () => {
    if (!selectedId) return;
    setLoadingAi(true);
    setError("");
    try {
      const updated = await api.analyze(selectedId);
      setDetail(updated);
      setToast("AI 证据已生成并通过输出校验");
      await loadGroups();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 分析失败");
    } finally {
      setLoadingAi(false);
    }
  };

  const review = async (status: string) => {
    if (!selectedId) return;
    setError("");
    try {
      const updated = await api.reviewAlarmGroup(selectedId, status, reason);
      setDetail(updated);
      setToast(status === "HUMAN_VERIFIED" ? "候选关系已由人工确认" : "操作已记录并可追溯");
      await loadGroups();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "评审失败");
    }
  };

  const createOrder = async () => {
    if (!selectedId) return;
    setError("");
    try {
      const order = await api.createWorkOrder(selectedId);
      setToast(`已生成工单 ${order.code}`);
      await refreshDetail();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "工单创建失败");
    }
  };

  const aiResult: AiResult | null = detail?.latestAiRun
    ? {
        ...detail.latestAiRun,
        citations:
          detail.latestAiRun.citations ||
          detail.latestAiRun.evidence.map((item) => item.id),
      }
    : null;

  if (error && !groups.length) return <div className="page-error">{error}</div>;
  if (!groups.length) return <LoadingBlock label="正在载入告警候选组" />;

  return (
    <div className="page alarm-page">
      <div className="page-heading compact-heading">
        <div>
          <span className="page-eyebrow">ALARM GOVERNANCE</span>
          <h1>告警候选与证据复核</h1>
          <p>按设备与事件 ID 建立候选组，原始告警始终保留且可回退。</p>
        </div>
        <div className="inline-stats">
          <div><strong>{summary.total}</strong><span>候选组</span></div>
          <div><strong>{summary.pending}</strong><span>待评审</span></div>
          <div><strong>{summary.missing}</strong><span>缺 ID 待核</span></div>
        </div>
      </div>

      {error && <div className="inline-error">{error}</div>}
      {toast && <button className="toast" onClick={() => setToast("")}>{toast}<X size={14} /></button>}

      <div className="alarm-workspace">
        <section className="alarm-index">
          <div className="alarm-index-head">
            <span>候选组列表</span>
            <strong>按风险排序</strong>
          </div>
          <div className="alarm-list">
            {groups.map((group) => (
              <button
                key={group.id}
                className={`alarm-list-item ${selectedId === group.id ? "selected" : ""}`}
                onClick={() => setSelectedId(group.id)}
              >
                <div className="alarm-list-top">
                  <span className={`risk-pill risk-${group.risk_level.toLowerCase()}`}>{riskLabel[group.risk_level]}</span>
                  <StatusBadge value={group.status} />
                </div>
                <strong>{group.title}</strong>
                <span>{group.asset_code} · {group.asset_alias} · {group.event_count} 条事件</span>
                <small>{formatTime(group.last_occurrence)}</small>
                {group.is_new_event ? <em>疑似新事件</em> : null}
                {group.missing_event_id ? <em className="warning">缺事件 ID</em> : null}
                <ChevronRight size={15} className="alarm-list-arrow" />
              </button>
            ))}
          </div>
        </section>

        <section className="alarm-detail">
          {!detail ? <LoadingBlock /> : (
            <>
              <div className="detail-heading">
                <div>
                  <div className="detail-meta">
                    <span className={`risk-text risk-text-${detail.risk_level.toLowerCase()}`}>{riskLabel[detail.risk_level]}风险</span>
                    <span>{detail.id}</span>
                    <span>{detail.model}</span>
                  </div>
                  <h2>{detail.title}</h2>
                  <p>{detail.reason}</p>
                </div>
                <div className="detail-actions">
                  <button className="secondary-button" onClick={createOrder}><Wrench size={15} />转检修工单</button>
                  <button className="primary-button" onClick={runAi} disabled={loadingAi}>
                    {loadingAi ? <span className="spinner" /> : <Sparkles size={15} />}
                    {loadingAi ? "模型分析中" : "生成 AI 证据"}
                  </button>
                </div>
              </div>

              <div className="detail-metrics">
                <div><Clock3 size={16} /><span>首次发生</span><strong>{formatTime(detail.first_occurrence)}</strong></div>
                <div><Clock3 size={16} /><span>末次发生</span><strong>{formatTime(detail.last_occurrence)}</strong></div>
                <div><GitBranch size={16} /><span>事件数</span><strong>{detail.event_count}</strong></div>
                <div><FileWarning size={16} /><span>工单</span><strong>{detail.workOrder?.code || detail.work_order_code || "未创建"}</strong></div>
              </div>

              <div className="detail-subhead">
                <div><span>原始事件时间轴</span><small>发生时间与接收时间分开保存</small></div>
                <span className="retention-chip">原始记录保留 100%</span>
              </div>
              <div className="event-timeline">
                {detail.events?.map((event, index) => (
                  <article key={event.id} className={event.event_id ? "" : "missing-id"}>
                    <div className="timeline-marker">{String(index + 1).padStart(2, "0")}</div>
                    <div className="event-card">
                      <div>
                        <strong>{event.metric} {event.value} {event.unit}</strong>
                        <span>阈值 {event.threshold} {event.unit}</span>
                      </div>
                      <div className="event-tags">
                        <span>{event.event_id || "缺少 EVENT_ID"}</span>
                        {event.is_backfilled ? <span className="tag-warn">断联补传</span> : null}
                        <span>{event.source_cycle}</span>
                      </div>
                      <div className="event-times">
                        <span>发生 {formatTime(event.occurred_at)}</span>
                        <span>接收 {formatTime(event.ingested_at)}</span>
                        <span>{event.raw_event_id}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="review-bar">
                <label>
                  <span>评审意见</span>
                  <input value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <div>
                  <button className="success-button" onClick={() => review("HUMAN_VERIFIED")}><Check size={15} />确认候选</button>
                  <button className="ghost-button" onClick={() => review("REJECTED")}><X size={15} />拒绝归并</button>
                  <button className="ghost-button" onClick={() => review("ROLLED_BACK")}><RotateCcw size={15} />回退</button>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="ai-panel">
          <div className="ai-panel-head">
            <div className="ai-orb"><Bot size={20} /></div>
            <div><strong>AI 证据核</strong><span>READ-ONLY ASSISTANT</span></div>
            <span className="readonly-dot" />
          </div>
          <div className="guardrail-box">
            <ShieldAlert size={16} />
            <div><strong>只读边界生效</strong><span>不关闭告警 · 不修改工单 · 不控制设备</span></div>
          </div>

          {!aiResult ? (
            <EmptyState title="尚未生成证据" text="AI 将基于授权范围内的原始遥测、事件与公开资料生成候选解释。" />
          ) : (
            <div className="ai-result">
              <div className="confidence-row">
                <span>证据置信度</span>
                <strong>{Math.round((aiResult.confidence || 0) * 100)}%</strong>
              </div>
              <div className="confidence-track"><span style={{ width: `${(aiResult.confidence || 0) * 100}%` }} /></div>
              <p className="ai-summary">{aiResult.summary}</p>
              {aiResult.duplicateAssessment ? (
                <div className="ai-assessment">
                  <span>归并判断</span>
                  <p>{aiResult.duplicateAssessment}</p>
                </div>
              ) : null}
              {aiResult.recommendedChecks?.length ? (
                <div className="ai-checks">
                  <span>人工核实清单</span>
                  {aiResult.recommendedChecks.slice(0, 4).map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              ) : null}
              <div className="ai-next"><AlertCircle size={15} /><span>下一动作：人工评审</span></div>
              <div className="evidence-list">
                {aiResult.evidence?.slice(0, 5).map((item) => (
                  <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                    <span>{item.id}</span>
                    <strong>{item.title}</strong>
                    <small>{item.source}</small>
                  </a>
                ))}
              </div>
              <div className="ai-model">MODEL · {aiResult.model || "qwen-plus"}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
