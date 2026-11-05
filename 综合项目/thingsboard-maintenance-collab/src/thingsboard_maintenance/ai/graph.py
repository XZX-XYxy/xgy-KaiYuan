from __future__ import annotations

import json
import re
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from openai import OpenAI

from thingsboard_maintenance.ai.rag import search_knowledge
from thingsboard_maintenance.config import settings
from thingsboard_maintenance.core.guardrails import validate_ai_output


class MaintenanceState(TypedDict, total=False):
    question: str
    task: str
    context: dict[str, Any]
    authorized: bool
    asset_id: str
    retrieved_docs: list[dict[str, str]]
    evidence: list[str]
    answer: str
    result: dict[str, Any]
    blocked_actions: list[str]


def access_check(state: MaintenanceState) -> MaintenanceState:
    if not state.get("authorized"):
        return {**state, "blocked_actions": ["ASSET_GROUP_DENIED"]}
    return state


def retrieve(state: MaintenanceState) -> MaintenanceState:
    context = state.get("context", {})
    document_hint = ""
    if state.get("task") == "alarm_review":
        group = context.get("group", {})
        document_hint = " ".join(
            [
                str(group.get("title", "")),
                str(group.get("reason", "")),
                str(group.get("asset_name", "")),
                "告警 归并 工单 恢复 时间 资产映射",
            ]
        )
    docs = search_knowledge(
        f"{state.get('question', '')} {document_hint}",
        limit=min(settings.ai_max_context_docs, 10),
    )
    return {**state, "retrieved_docs": docs}


def _fallback_result(state: MaintenanceState) -> dict[str, Any]:
    docs = state.get("retrieved_docs", [])
    citations = [item["id"] for item in docs[:5]]
    context = state.get("context", {})
    if state.get("task") == "alarm_review":
        group = context.get("group", {})
        events = group.get("events", [])
        missing = any(not event.get("event_id") for event in events)
        backfilled = any(event.get("is_backfilled") for event in events)
        title = group.get("title", "当前候选组")
        checks = [
            "核对设备外号、铭牌号与规范资产号",
            "比较告警发生时间与平台接收时间",
            "查看原始遥测曲线并现场核实",
        ]
        if missing:
            checks.insert(0, "该组缺少事件 ID，必须人工逐条核实，不得自动合并")
        if backfilled:
            checks.insert(0, "存在断联补传记录，补传时间不能替代发生时间")
        return {
            "summary": (
                f"候选组“{title}”包含 {len(events)} 条原始事件。"
                "系统仅建议保留为候选关系，需结合原始遥测和设备现场状态复核。"
            ),
            "riskLevel": group.get("risk_level", "MEDIUM"),
            "duplicateAssessment": (
                "当前证据不足以自动确认真实重复，所有原始事件已保留并可回退。"
            ),
            "newEventCandidates": [
                {
                    "title": "独立测点或时间口径差异",
                    "reason": "需要人工比较测点、事件 ID 和发生时间后确认。",
                }
            ]
            if group.get("is_new_event")
            else [],
            "recommendedChecks": checks,
            "confidence": 0.68,
            "citations": citations,
            "model": "local-fallback",
            "allowedNextStep": "HUMAN_REVIEW",
        }
    return {
        "summary": "已检索授权范围内的公开知识，建议由人员结合设备规程和现场证据核实。",
        "riskLevel": "UNKNOWN",
        "recommendedChecks": ["核对知识来源", "确认设备与资产映射", "由授权人员执行操作"],
        "confidence": 0.55,
        "citations": citations,
        "model": "local-fallback",
        "allowedNextStep": "HUMAN_REVIEW",
    }


def _parse_json_response(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def reason(state: MaintenanceState) -> MaintenanceState:
    if state.get("blocked_actions"):
        return {**state, "result": _fallback_result(state)}
    docs = state.get("retrieved_docs", [])
    evidence = [
        {
            "id": item["id"],
            "title": item["title"],
            "source": item["source"],
            "url": item["url"],
            "content": item["content"],
        }
        for item in docs
    ]
    fallback = _fallback_result(state)
    if not settings.dashscope_api_key:
        return {**state, "result": fallback, "evidence": evidence}

    context = state.get("context", {})
    prompt = {
        "task": state.get("task"),
        "question": state.get("question"),
        "context": context,
        "retrieved_knowledge": evidence,
        "rules": [
            "只输出 JSON",
            "结论必须引用 K-xxx",
            "不得建议自动停机、自动复产、自动关闭告警或自动修改工单",
            "只能提出人工核实建议",
            "不得把传感器漂移直接认定为设备故障",
        ],
    }
    try:
        client = OpenAI(
            api_key=settings.dashscope_api_key,
            base_url=settings.dashscope_base_url,
        )
        response = client.chat.completions.create(
            model=settings.dashscope_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是工业设备检修协同系统的只读证据助手。"
                        "输出中文 JSON，字段为 summary、riskLevel、duplicateAssessment、"
                        "newEventCandidates、recommendedChecks、confidence、citations。"
                        "你没有任何设备控制或业务写权限。"
                    ),
                },
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        parsed = _parse_json_response(response.choices[0].message.content or "{}")
        parsed["model"] = settings.dashscope_model
        parsed["allowedNextStep"] = "HUMAN_REVIEW"
        parsed.setdefault("citations", fallback["citations"])
        parsed.setdefault("recommendedChecks", fallback["recommendedChecks"])
        parsed.setdefault("newEventCandidates", [])
        parsed.setdefault("duplicateAssessment", "")
        parsed.setdefault("riskLevel", fallback["riskLevel"])
        parsed.setdefault("confidence", fallback["confidence"])
        return {**state, "result": parsed, "evidence": evidence}
    except Exception as error:
        fallback["model"] = "local-fallback-after-model-error"
        fallback["modelError"] = type(error).__name__
        return {**state, "result": fallback, "evidence": evidence}


def validate(state: MaintenanceState) -> MaintenanceState:
    result = dict(state.get("result", {}))
    evidence = state.get("evidence", [])
    summary = str(result.get("summary", ""))
    violations = validate_ai_output(summary)
    if violations:
        result["summary"] = (
            "模型输出包含越界动作，系统已阻断。请由授权人员基于原始证据进行核实。"
        )
    valid_ids = {item["id"] for item in evidence}
    citations = [item for item in result.get("citations", []) if item in valid_ids]
    result["summary"] = summary if not violations else result["summary"]
    result["citations"] = citations or sorted(valid_ids)[:5]
    result["evidence"] = evidence
    result["guardrailViolations"] = violations
    result["allowedNextStep"] = "HUMAN_REVIEW"
    return {**state, "result": result}


COMPILED_GRAPH = None


def build_maintenance_graph():
    global COMPILED_GRAPH
    if COMPILED_GRAPH is not None:
        return COMPILED_GRAPH
    workflow = StateGraph(MaintenanceState)
    workflow.add_node("access_check", access_check)
    workflow.add_node("retrieve", retrieve)
    workflow.add_node("reason", reason)
    workflow.add_node("validate", validate)
    workflow.add_edge(START, "access_check")
    workflow.add_edge("access_check", "retrieve")
    workflow.add_edge("retrieve", "reason")
    workflow.add_edge("reason", "validate")
    workflow.add_edge("validate", END)
    COMPILED_GRAPH = workflow.compile()
    return COMPILED_GRAPH


def run_maintenance_graph(
    question: str,
    context: dict[str, Any],
    authorized: bool,
    task: str,
) -> dict[str, Any]:
    graph = build_maintenance_graph()
    final_state = graph.invoke(
        {
            "question": question,
            "context": context,
            "authorized": authorized,
            "task": task,
        }
    )
    result = final_state.get("result", _fallback_result(final_state))
    if not result.get("evidence"):
        result["evidence"] = final_state.get("evidence", [])
    return result
