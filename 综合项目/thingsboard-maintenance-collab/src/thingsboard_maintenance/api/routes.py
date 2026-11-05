from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from thingsboard_maintenance import repository
from thingsboard_maintenance.ai.graph import run_maintenance_graph
from thingsboard_maintenance.ai.rag import build_knowledge_graph, search_knowledge
from thingsboard_maintenance.core.thingsboard import probe_thingsboard
from thingsboard_maintenance.schemas import (
    AIAnalyzeRequest,
    AIAskRequest,
    CreateWorkOrderRequest,
    ReviewRequest,
    ThingsBoardAlarmIngest,
    WorkOrderTransitionRequest,
)


router = APIRouter(prefix="/api")


def get_db(request: Request):
    connection = sqlite3.connect(Path(request.app.state.db_path), check_same_thread=False)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


DB = Annotated[sqlite3.Connection, Depends(get_db)]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "thingsboard-maintenance"}


@router.get("/dashboard/summary")
def dashboard(connection: DB) -> dict:
    return repository.dashboard_summary(connection)


@router.post("/demo/refresh")
def refresh_demo(connection: DB) -> dict:
    try:
        return repository.refresh_demo_data(connection)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/assets")
def assets(connection: DB) -> dict:
    rows = connection.execute("SELECT * FROM assets ORDER BY code").fetchall()
    return {"items": [dict(row) for row in rows]}


@router.get("/integrations/thingsboard/status")
def thingsboard_status() -> dict:
    status = probe_thingsboard()
    return {
        "configured": status.configured,
        "reachable": status.reachable,
        "baseUrl": status.base_url,
        "detail": status.detail,
    }


@router.post("/integrations/thingsboard/alarm")
def thingsboard_alarm(payload: ThingsBoardAlarmIngest, connection: DB) -> dict:
    try:
        return repository.ingest_thingsboard_alarm(
            connection,
            device_id=payload.device_id,
            asset_id=payload.asset_id,
            event_id=payload.event_id,
            metric=payload.metric,
            value=payload.value,
            unit=payload.unit,
            threshold=payload.threshold,
            occurred_at=payload.occurred_at,
            ingested_at=payload.ingested_at,
            source_cycle=payload.source_cycle,
            source=payload.source,
        )
    except ValueError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.get("/alarm-groups")
def alarm_groups(connection: DB) -> dict:
    return {"items": repository.list_alarm_groups(connection)}


@router.get("/alarm-groups/{group_id}")
def alarm_group(group_id: str, connection: DB) -> dict:
    item = repository.get_alarm_group(connection, group_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Alarm group not found")
    return item


@router.post("/alarm-groups/{group_id}/review")
def review_group(group_id: str, payload: ReviewRequest, connection: DB) -> dict:
    try:
        item = repository.review_alarm_group(
            connection,
            group_id,
            payload.status,
            payload.actor,
            payload.reason,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if item is None:
        raise HTTPException(status_code=404, detail="Alarm group not found")
    return item


@router.get("/work-orders")
def work_orders(connection: DB) -> dict:
    return {"items": repository.list_work_orders(connection)}


@router.get("/work-orders/{work_order_id}")
def work_order(work_order_id: str, connection: DB) -> dict:
    item = repository.get_work_order(connection, work_order_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    return item


@router.post("/work-orders/{work_order_id}/transition")
def transition(
    work_order_id: str,
    payload: WorkOrderTransitionRequest,
    connection: DB,
) -> dict:
    try:
        item = repository.transition_work_order(
            connection,
            work_order_id,
            payload.status,
            payload.actor,
            payload.note,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if item is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    return item


@router.post("/alarm-groups/{group_id}/work-order")
def create_work_order(group_id: str, payload: CreateWorkOrderRequest, connection: DB) -> dict:
    try:
        return repository.create_work_order_from_group(connection, group_id, payload.actor)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/ai/analyze")
def ai_analyze(payload: AIAnalyzeRequest, connection: DB) -> dict:
    group = repository.get_alarm_group(connection, payload.alarm_group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Alarm group not found")
    related = [
        item
        for item in repository.list_alarm_groups(connection)
        if item["asset_id"] == group["asset_id"] and item["id"] != group["id"]
    ][:4]
    context = {
        "group": group,
        "related_groups": related,
        "allowed_asset_group": group["group_name"],
    }
    result = run_maintenance_graph(
        question=f"分析告警候选组：{group['title']}",
        context=context,
        authorized=True,
        task="alarm_review",
    )
    return repository.save_ai_run(connection, payload.alarm_group_id, result)


@router.post("/ai/ask")
def ai_ask(payload: AIAskRequest) -> dict:
    return run_maintenance_graph(
        question=payload.question,
        context={"asset_id": payload.asset_id},
        authorized=True,
        task="knowledge_qa",
    )


@router.get("/knowledge/search")
def knowledge_search(
    q: str = Query(default="告警归并 遥测 工单"),
    limit: int = Query(default=12, ge=1, le=40),
) -> dict:
    return {"items": search_knowledge(q, limit)}


@router.get("/knowledge/graph")
def knowledge_graph() -> dict:
    return build_knowledge_graph()


@router.get("/audit")
def audit(connection: DB, limit: int = Query(default=50, ge=1, le=200)) -> dict:
    return {"items": repository.recent_audit(connection, limit)}
