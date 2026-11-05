from __future__ import annotations

import json
import random
import sqlite3
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from thingsboard_maintenance.core.work_order_service import (
    WorkOrderStatus,
    assert_transition_allowed,
)


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def dashboard_summary(connection: sqlite3.Connection) -> dict:
    asset_count = connection.execute("SELECT COUNT(*) FROM assets").fetchone()[0]
    active_alarms = connection.execute(
        "SELECT COUNT(*) FROM alarm_groups WHERE status IN ('PENDING_REVIEW','HUMAN_VERIFIED')"
    ).fetchone()[0]
    open_orders = connection.execute(
        "SELECT COUNT(*) FROM work_orders WHERE status NOT IN ('CLOSED')"
    ).fetchone()[0]
    duplicate_candidates = connection.execute(
        "SELECT COALESCE(SUM(MAX(event_count - 1, 0)), 0) FROM alarm_groups"
    ).fetchone()[0]
    restored_today = connection.execute(
        "SELECT COUNT(*) FROM work_orders WHERE recovered_at IS NOT NULL"
    ).fetchone()[0]

    asset_rows = connection.execute(
        """
        SELECT a.*,
          (SELECT COUNT(*) FROM alarm_groups g
           WHERE g.asset_id=a.id AND g.status IN ('PENDING_REVIEW','HUMAN_VERIFIED')) AS active_alarm_count,
          (SELECT COUNT(*) FROM work_orders w
           WHERE w.asset_id=a.id AND w.status != 'CLOSED') AS open_order_count
        FROM assets a ORDER BY a.code
        """
    ).fetchall()
    orders = connection.execute(
        """
        SELECT w.*, a.name AS asset_name, a.code AS asset_code
        FROM work_orders w JOIN assets a ON a.id=w.asset_id
        ORDER BY CASE w.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                 w.updated_at DESC LIMIT 6
        """
    ).fetchall()
    activities = connection.execute(
        "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 8"
    ).fetchall()

    start = (datetime.now(UTC) - timedelta(hours=11)).replace(minute=0, second=0, microsecond=0)
    labels: list[str] = []
    alarm_series: list[int] = []
    telemetry_series: list[int] = []
    for hour_index in range(12):
        bucket_start = start + timedelta(hours=hour_index)
        bucket_end = bucket_start + timedelta(hours=1)
        labels.append(bucket_start.astimezone().strftime("%H:%M"))
        alarm_count = connection.execute(
            "SELECT COUNT(*) FROM alarm_events WHERE occurred_at >= ? AND occurred_at < ?",
            (bucket_start.isoformat(), bucket_end.isoformat()),
        ).fetchone()[0]
        telemetry_count = connection.execute(
            "SELECT COUNT(*) FROM telemetry_events WHERE occurred_at >= ? AND occurred_at < ?",
            (bucket_start.isoformat(), bucket_end.isoformat()),
        ).fetchone()[0]
        alarm_series.append(alarm_count)
        telemetry_series.append(telemetry_count)

    return {
        "kpis": {
            "assets": asset_count,
            "activeAlarms": active_alarms,
            "openOrders": open_orders,
            "duplicateCandidates": duplicate_candidates,
            "restoredToday": restored_today,
            "rawEvents": connection.execute("SELECT COUNT(*) FROM telemetry_events").fetchone()[0],
        },
        "assets": [dict(row) for row in asset_rows],
        "workOrders": [dict(row) for row in orders],
        "activities": [dict(row) for row in activities],
        "trend": [
            {"time": label, "alarms": alarms, "telemetry": telemetry}
            for label, alarms, telemetry in zip(labels, alarm_series, telemetry_series, strict=True)
        ],
    }


def refresh_demo_data(connection: sqlite3.Connection) -> dict:
    """Regenerate a recent demo window while preserving business records."""
    now = datetime.now(UTC).replace(microsecond=0)
    rng = random.Random(int(now.timestamp() * 1000))
    asset_rows = connection.execute("SELECT id, code, status FROM assets").fetchall()
    if not asset_rows:
        raise ValueError("Demo assets are not initialized")

    connection.execute("DELETE FROM telemetry_events")
    metrics = ["temperature", "vibration", "current"]
    baselines = {"temperature": 62.0, "vibration": 3.4, "current": 22.0}
    telemetry_rows: list[tuple[object, ...]] = []
    for index in range(120):
        asset = asset_rows[index % len(asset_rows)]
        metric = metrics[index % len(metrics)]
        occurred = now - timedelta(minutes=rng.randint(0, 719), seconds=rng.randint(0, 59))
        ingested = occurred + timedelta(seconds=rng.randint(2, 55))
        if ingested > now:
            ingested = now
        value = round(
            baselines[metric] + rng.uniform(-2.5, 13.0) + (5.0 if index % 19 == 0 else 0),
            2,
        )
        telemetry_rows.append(
            (
                "DEV-" + str(asset["id"]).removeprefix("AST-"),
                asset["id"],
                metric,
                value,
                occurred.isoformat(),
                ingested.isoformat(),
                1 if index % 37 == 0 else 0,
            )
        )
    connection.executemany(
        "INSERT INTO telemetry_events "
        "(device_id, asset_id, metric, value, occurred_at, ingested_at, is_backfilled) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        telemetry_rows,
    )

    alarm_rows = connection.execute(
        "SELECT id, occurred_at, ingested_at, value FROM alarm_events"
    ).fetchall()
    if alarm_rows:
        latest = max(
            datetime.fromisoformat(row["occurred_at"])
            for row in alarm_rows
        )
        target_latest = now - timedelta(minutes=3)
        shift = target_latest - latest
        for row in alarm_rows:
            occurred = datetime.fromisoformat(row["occurred_at"]) + shift
            ingested = datetime.fromisoformat(row["ingested_at"]) + shift
            jittered_value = round(float(row["value"]) + rng.uniform(-0.18, 0.18), 2)
            connection.execute(
                "UPDATE alarm_events SET occurred_at=?, ingested_at=?, value=? WHERE id=?",
                (occurred.isoformat(), ingested.isoformat(), jittered_value, row["id"]),
            )
        group_ids = connection.execute("SELECT id FROM alarm_groups").fetchall()
        for group in group_ids:
            values = connection.execute(
                "SELECT MIN(occurred_at) first_occurred, MAX(occurred_at) last_occurred, "
                "MIN(ingested_at) first_ingested, MAX(ingested_at) last_ingested "
                "FROM alarm_events WHERE group_id=?",
                (group["id"],),
            ).fetchone()
            connection.execute(
                "UPDATE alarm_groups SET first_occurrence=?, last_occurrence=?, "
                "first_ingest=?, last_ingest=? WHERE id=?",
                (
                    values["first_occurred"],
                    values["last_occurred"],
                    values["first_ingested"],
                    values["last_ingested"],
                    group["id"],
                ),
            )

    for asset in asset_rows:
        last_seen = now - timedelta(seconds=rng.randint(3, 45))
        connection.execute(
            "UPDATE assets SET last_seen=? WHERE id=?",
            (last_seen.isoformat(), asset["id"]),
        )
    connection.execute(
        "INSERT INTO audit_logs (actor, action, target_type, target_id, reason, created_at) "
        "VALUES ('Demo Simulator', 'DEMO_DATA_REFRESHED', 'system', 'dashboard', "
        "'重新生成最近 12 小时演示遥测', ?)",
        (now.isoformat(),),
    )
    connection.commit()
    return {
        "refreshed": True,
        "telemetryEvents": len(telemetry_rows),
        "alarmEvents": len(alarm_rows),
        "refreshedAt": now.isoformat(),
    }


def list_alarm_groups(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT g.*, a.code AS asset_code, a.name AS asset_name, a.alias AS asset_alias,
               w.code AS work_order_code, w.status AS work_order_status
        FROM alarm_groups g
        JOIN assets a ON a.id=g.asset_id
        LEFT JOIN work_orders w ON w.alarm_group_id=g.id
        ORDER BY CASE g.risk_level WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1
                 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                 g.id
        """
    ).fetchall()
    return [dict(row) for row in rows]


def get_alarm_group(connection: sqlite3.Connection, group_id: str) -> dict | None:
    row = connection.execute(
        """
        SELECT g.*, a.code AS asset_code, a.name AS asset_name, a.alias AS asset_alias,
               a.group_name, a.location, a.model
        FROM alarm_groups g JOIN assets a ON a.id=g.asset_id
        WHERE g.id=?
        """,
        (group_id,),
    ).fetchone()
    if row is None:
        return None
    events = connection.execute(
        "SELECT * FROM alarm_events WHERE group_id=? ORDER BY occurred_at",
        (group_id,),
    ).fetchall()
    work_order = connection.execute(
        "SELECT * FROM work_orders WHERE alarm_group_id=? ORDER BY created_at DESC LIMIT 1",
        (group_id,),
    ).fetchone()
    ai_run = connection.execute(
        "SELECT * FROM ai_runs WHERE alarm_group_id=? ORDER BY created_at DESC LIMIT 1",
        (group_id,),
    ).fetchone()
    data = dict(row)
    data["events"] = [dict(event) for event in events]
    data["workOrder"] = dict(work_order) if work_order else None
    if ai_run:
        ai_data = dict(ai_run)
        ai_data["evidence"] = json.loads(ai_data.pop("evidence_json"))
        result_payload = json.loads(ai_data.pop("result_json"))
        ai_data.update(result_payload)
        ai_data["evidence"] = result_payload.get("evidence", ai_data["evidence"])
        data["latestAiRun"] = ai_data
    else:
        data["latestAiRun"] = None
    return data


def review_alarm_group(
    connection: sqlite3.Connection,
    group_id: str,
    status: str,
    actor: str,
    reason: str,
) -> dict | None:
    allowed = {"HUMAN_VERIFIED", "REJECTED", "ROLLED_BACK"}
    if status not in allowed:
        raise ValueError("Unsupported review status")
    result = connection.execute(
        "UPDATE alarm_groups SET status=? WHERE id=?",
        (status, group_id),
    )
    if result.rowcount == 0:
        return None
    connection.execute(
        "INSERT INTO audit_logs (actor, action, target_type, target_id, reason, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (actor, f"ALARM_GROUP_{status}", "alarm_group", group_id, reason, now_iso()),
    )
    connection.commit()
    return get_alarm_group(connection, group_id)


def list_work_orders(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT w.*, a.code AS asset_code, a.name AS asset_name, a.alias AS asset_alias
        FROM work_orders w JOIN assets a ON a.id=w.asset_id
        ORDER BY w.updated_at DESC
        """
    ).fetchall()
    return [dict(row) for row in rows]


def get_work_order(connection: sqlite3.Connection, work_order_id: str) -> dict | None:
    row = connection.execute(
        """
        SELECT w.*, a.code AS asset_code, a.name AS asset_name, a.alias AS asset_alias,
               a.location, a.group_name
        FROM work_orders w JOIN assets a ON a.id=w.asset_id WHERE w.id=?
        """,
        (work_order_id,),
    ).fetchone()
    if row is None:
        return None
    events = connection.execute(
        "SELECT * FROM work_order_events WHERE work_order_id=? ORDER BY created_at",
        (work_order_id,),
    ).fetchall()
    data = dict(row)
    data["timeline"] = [dict(event) for event in events]
    return data


def transition_work_order(
    connection: sqlite3.Connection,
    work_order_id: str,
    target: str,
    actor: str,
    note: str,
) -> dict | None:
    current = connection.execute(
        "SELECT status, assignee FROM work_orders WHERE id=?",
        (work_order_id,),
    ).fetchone()
    if current is None:
        return None
    current_status = WorkOrderStatus(current["status"])
    target_status = WorkOrderStatus(target)
    assert_transition_allowed(current_status, target_status)
    stamp = now_iso()
    assignee = current["assignee"]
    if target_status == WorkOrderStatus.ASSIGNED and assignee in {"", "待分派"}:
        assignee = "段之衡"
    connection.execute(
        "UPDATE work_orders SET assignee=? WHERE id=?",
        (assignee, work_order_id),
    )
    timestamp_column = ""
    if target_status == WorkOrderStatus.REPAIR_COMPLETED:
        timestamp_column = ", repair_completed_at=?"
    elif target_status == WorkOrderStatus.RECOVERED:
        timestamp_column = ", recovered_at=?"
    if timestamp_column:
        connection.execute(
            f"UPDATE work_orders SET status=?, updated_at=?{timestamp_column} WHERE id=?",
            (target, stamp, stamp, work_order_id),
        )
    else:
        connection.execute(
            "UPDATE work_orders SET status=?, updated_at=? WHERE id=?",
            (target, stamp, work_order_id),
        )
    connection.execute(
        "INSERT INTO work_order_events "
        "(work_order_id, status, actor, note, created_at) VALUES (?, ?, ?, ?, ?)",
        (work_order_id, target, actor, note, stamp),
    )
    connection.execute(
        "INSERT INTO audit_logs (actor, action, target_type, target_id, reason, created_at) "
        "VALUES (?, 'WORK_ORDER_TRANSITION', 'work_order', ?, ?, ?)",
        (actor, work_order_id, note, stamp),
    )
    connection.commit()
    return get_work_order(connection, work_order_id)


def create_work_order_from_group(
    connection: sqlite3.Connection,
    group_id: str,
    actor: str,
) -> dict:
    group = get_alarm_group(connection, group_id)
    if group is None:
        raise ValueError("Alarm group not found")
    existing = connection.execute(
        "SELECT * FROM work_orders WHERE alarm_group_id=? AND status != 'CLOSED' LIMIT 1",
        (group_id,),
    ).fetchone()
    if existing:
        return get_work_order(connection, existing["id"]) or {}
    count = connection.execute("SELECT COUNT(*) FROM work_orders").fetchone()[0] + 1
    order_id = f"WO-{uuid4().hex[:8].upper()}"
    stamp = now_iso()
    code = f"WO-2026-1102-{count:03d}"
    priority = "HIGH" if group["risk_level"] in {"HIGH", "CRITICAL"} else "MEDIUM"
    connection.execute(
        "INSERT INTO work_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            order_id,
            code,
            group["asset_id"],
            group_id,
            f"处理：{group['title']}",
            WorkOrderStatus.OPEN.value,
            priority,
            "待分派",
            f"由告警候选组 {group_id} 转工单，需现场核实原始事件。",
            "待确认",
            "待确认",
            "待确认",
            stamp,
            stamp,
            None,
            None,
        ),
    )
    connection.execute(
        "INSERT INTO work_order_events "
        "(work_order_id, status, actor, note, created_at) VALUES (?, ?, ?, ?, ?)",
        (order_id, WorkOrderStatus.OPEN.value, actor, "告警候选组转为检修工单", stamp),
    )
    connection.execute(
        "INSERT INTO audit_logs (actor, action, target_type, target_id, reason, created_at) "
        "VALUES (?, 'WORK_ORDER_CREATED', 'work_order', ?, ?, ?)",
        (actor, order_id, f"来源告警组 {group_id}", stamp),
    )
    connection.commit()
    return get_work_order(connection, order_id) or {}


def save_ai_run(
    connection: sqlite3.Connection,
    group_id: str,
    result: dict,
) -> dict:
    stamp = now_iso()
    content = json.dumps(result.get("evidence", []), ensure_ascii=False)
    connection.execute(
        "INSERT INTO ai_runs "
        "(alarm_group_id, model, summary, evidence_json, result_json, confidence, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            group_id,
            result.get("model", "local-fallback"),
            result.get("summary", ""),
            content,
            json.dumps(result, ensure_ascii=False),
            float(result.get("confidence", 0.0)),
            "VALIDATED",
            stamp,
        ),
    )
    connection.execute(
        "UPDATE alarm_groups SET ai_status='COMPLETED' WHERE id=?",
        (group_id,),
    )
    connection.execute(
        "INSERT INTO audit_logs (actor, action, target_type, target_id, reason, created_at) "
        "VALUES ('AI Assist', 'AI_EVIDENCE_GENERATED', 'alarm_group', ?, ?, ?)",
        (group_id, "只读证据生成", stamp),
    )
    connection.commit()
    return get_alarm_group(connection, group_id) or {}


def recent_audit(connection: sqlite3.Connection, limit: int = 50) -> list[dict]:
    rows = connection.execute(
        "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def ingest_thingsboard_alarm(
    connection: sqlite3.Connection,
    *,
    device_id: str,
    asset_id: str,
    event_id: str | None,
    metric: str,
    value: float,
    unit: str,
    threshold: float,
    occurred_at: datetime,
    ingested_at: datetime,
    source_cycle: str | None,
    source: str,
) -> dict:
    asset = connection.execute(
        "SELECT * FROM assets WHERE id=?",
        (asset_id,),
    ).fetchone()
    if asset is None:
        raise ValueError("Asset not found or outside the authorized asset group")
    group_id = f"TB-{uuid4().hex[:12].upper()}"
    risk = "HIGH" if value >= threshold else "MEDIUM"
    stamp = now_iso()
    connection.execute(
        "INSERT INTO alarm_groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            group_id,
            asset_id,
            f"ThingsBoard 外部事件 · {metric}",
            risk,
            "PENDING_REVIEW",
            "由 ThingsBoard Rule Engine 推送，等待人工核验",
            occurred_at.isoformat(),
            occurred_at.isoformat(),
            ingested_at.isoformat(),
            ingested_at.isoformat(),
            1,
            0 if event_id else 1,
            0,
            "NOT_RUN",
        ),
    )
    connection.execute(
        "INSERT INTO alarm_events "
        "(group_id, raw_event_id, event_id, device_id, asset_id, metric, value, unit, "
        "threshold, occurred_at, ingested_at, source_cycle, is_backfilled, source) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
        (
            group_id,
            f"TB-RAW-{uuid4().hex[:8].upper()}",
            event_id,
            device_id,
            asset_id,
            metric,
            value,
            unit,
            threshold,
            occurred_at.isoformat(),
            ingested_at.isoformat(),
            source_cycle,
            source,
        ),
    )
    connection.execute(
        "INSERT INTO audit_logs (actor, action, target_type, target_id, reason, created_at) "
        "VALUES ('ThingsBoard', 'ALARM_INGESTED', 'alarm_group', ?, ?, ?)",
        (group_id, f"来自设备 {device_id}", stamp),
    )
    connection.commit()
    return get_alarm_group(connection, group_id) or {}
