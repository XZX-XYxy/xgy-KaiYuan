from __future__ import annotations

import json
import random
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

from thingsboard_maintenance.config import settings


SCHEMA = """
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    alias TEXT NOT NULL,
    model TEXT NOT NULL,
    location TEXT NOT NULL,
    group_name TEXT NOT NULL,
    status TEXT NOT NULL,
    criticality TEXT NOT NULL,
    last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    occurred_at TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    is_backfilled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alarm_groups (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    title TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    first_occurrence TEXT NOT NULL,
    last_occurrence TEXT NOT NULL,
    first_ingest TEXT NOT NULL,
    last_ingest TEXT NOT NULL,
    event_count INTEGER NOT NULL,
    missing_event_id INTEGER NOT NULL DEFAULT 0,
    is_new_event INTEGER NOT NULL DEFAULT 0,
    ai_status TEXT NOT NULL DEFAULT 'NOT_RUN'
);

CREATE TABLE IF NOT EXISTS alarm_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    raw_event_id TEXT NOT NULL,
    event_id TEXT,
    device_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    threshold REAL NOT NULL,
    occurred_at TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    source_cycle TEXT,
    is_backfilled INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    asset_id TEXT NOT NULL,
    alarm_group_id TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    assignee TEXT NOT NULL,
    description TEXT NOT NULL,
    manual_version TEXT NOT NULL,
    spare_parts TEXT NOT NULL,
    downtime_window TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    repair_completed_at TEXT,
    recovered_at TEXT
);

CREATE TABLE IF NOT EXISTS work_order_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    actor TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alarm_group_id TEXT,
    model TEXT NOT NULL,
    summary TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat()


def sqlite_path(url: str | None = None) -> Path:
    raw = url or settings.database_url
    if raw.startswith("sqlite:///"):
        raw = raw.removeprefix("sqlite:///")
    return Path(raw).resolve()


def connect(path: Path | None = None) -> sqlite3.Connection:
    db_path = path or sqlite_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(path: Path | None = None) -> None:
    db_path = path or sqlite_path()
    with connect(db_path) as connection:
        connection.executescript(SCHEMA)
        exists = connection.execute("SELECT COUNT(*) FROM assets").fetchone()[0]
        if exists == 0:
            seed_database(connection)


def seed_database(connection: sqlite3.Connection) -> None:
    now = datetime.now(UTC).replace(microsecond=0)
    assets = [
        (
            "AST-AG-01",
            "AG-01",
            "一号反应釜搅拌器",
            "大搅拌",
            "JBJ-140L",
            "A 区 · 反应工段",
            "反应设备组",
            "WARNING",
            "A",
            iso(now - timedelta(seconds=12)),
        ),
        (
            "AST-P-101",
            "P-101",
            "循环冷却水泵",
            "东泵",
            "CR-32-2",
            "B 区 · 公用工程",
            "泵组",
            "RUNNING",
            "A",
            iso(now - timedelta(seconds=8)),
        ),
        (
            "AST-C-201",
            "C-201",
            "螺杆空压机",
            "二空压",
            "GA-75",
            "C 区 · 动力站",
            "压缩机群",
            "RUNNING",
            "B",
            iso(now - timedelta(seconds=18)),
        ),
        (
            "AST-R-301",
            "R-301",
            "加氢反应釜",
            "三号釜",
            "R-5KL",
            "A 区 · 反应工段",
            "反应设备组",
            "WARNING",
            "A",
            iso(now - timedelta(seconds=21)),
        ),
        (
            "AST-CT-01",
            "CT-01",
            "冷却塔风机",
            "北塔",
            "LBC-900",
            "B 区 · 公用工程",
            "风机设备组",
            "RUNNING",
            "B",
            iso(now - timedelta(seconds=15)),
        ),
        (
            "AST-CV-01",
            "CV-01",
            "成品输送机",
            "成品线",
            "DS-1200",
            "D 区 · 包装工段",
            "输送设备组",
            "STOPPED",
            "C",
            iso(now - timedelta(minutes=4)),
        ),
    ]
    connection.executemany(
        "INSERT INTO assets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        assets,
    )

    device_asset = {
        "DEV-AG-01": "AST-AG-01",
        "DEV-P-101": "AST-P-101",
        "DEV-C-201": "AST-C-201",
        "DEV-R-301": "AST-R-301",
        "DEV-CT-01": "AST-CT-01",
        "DEV-CV-01": "AST-CV-01",
    }
    metrics = ["temperature", "vibration", "current"]
    rng = random.Random(42)
    telemetry_rows: list[tuple[object, ...]] = []
    for index in range(120):
        device_id = list(device_asset)[index % len(device_asset)]
        metric = metrics[index % len(metrics)]
        occurred = now - timedelta(minutes=(119 - index) * 9)
        ingested = occurred + timedelta(seconds=rng.randint(2, 25))
        baseline = {"temperature": 62.0, "vibration": 3.4, "current": 22.0}[metric]
        value = round(baseline + rng.uniform(-3.0, 12.0), 2)
        telemetry_rows.append(
            (
                device_id,
                device_asset[device_id],
                metric,
                value,
                iso(occurred),
                iso(ingested),
                1 if index in {7, 31, 64, 98} else 0,
            )
        )
    connection.executemany(
        "INSERT INTO telemetry_events "
        "(device_id, asset_id, metric, value, occurred_at, ingested_at, is_backfilled) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        telemetry_rows,
    )

    groups = [
        {
            "id": "AG-20261102-001",
            "asset_id": "AST-AG-01",
            "title": "温度连续超限 · 5 条重传候选",
            "risk_level": "CRITICAL",
            "status": "PENDING_REVIEW",
            "reason": "设备与事件 ID 相同，首末发生时间跨 5 分钟",
            "minutes": 122,
            "count": 5,
            "metric": "temperature",
            "value": 86.4,
            "unit": "°C",
            "threshold": 80.0,
            "event_id": "EVT-TEMP-AG01-001",
            "missing": 0,
            "new": 0,
            "backfill": 0,
        },
        {
            "id": "AG-20261102-002",
            "asset_id": "AST-AG-01",
            "title": "振动异常 · 疑似独立新事件",
            "risk_level": "CRITICAL",
            "status": "PENDING_REVIEW",
            "reason": "时间接近温度告警，但测点与事件 ID 均不同",
            "minutes": 117,
            "count": 1,
            "metric": "vibration",
            "value": 8.2,
            "unit": "mm/s",
            "threshold": 7.1,
            "event_id": "EVT-VIB-AG01-021",
            "missing": 0,
            "new": 1,
            "backfill": 0,
        },
        {
            "id": "AG-20261102-003",
            "asset_id": "AST-P-101",
            "title": "轴承温度高位 · 4 条重复候选",
            "risk_level": "HIGH",
            "status": "HUMAN_VERIFIED",
            "reason": "同设备、同事件 ID、时间窗口连续",
            "minutes": 84,
            "count": 4,
            "metric": "temperature",
            "value": 74.8,
            "unit": "°C",
            "threshold": 70.0,
            "event_id": "EVT-TEMP-P101-003",
            "missing": 0,
            "new": 0,
            "backfill": 0,
        },
        {
            "id": "AG-20261102-004",
            "asset_id": "AST-C-201",
            "title": "运行电流波动",
            "risk_level": "MEDIUM",
            "status": "PENDING_REVIEW",
            "reason": "负载变化与电流峰值同时出现，需结合工况核实",
            "minutes": 63,
            "count": 3,
            "metric": "current",
            "value": 31.5,
            "unit": "A",
            "threshold": 29.0,
            "event_id": "EVT-CUR-C201-009",
            "missing": 0,
            "new": 0,
            "backfill": 0,
        },
        {
            "id": "AG-20261102-005",
            "asset_id": "AST-R-301",
            "title": "釜内压力短时超限",
            "risk_level": "HIGH",
            "status": "HUMAN_VERIFIED",
            "reason": "同事件 ID 重传，保留首末时间",
            "minutes": 51,
            "count": 3,
            "metric": "pressure",
            "value": 0.92,
            "unit": "MPa",
            "threshold": 0.85,
            "event_id": "EVT-PRS-R301-012",
            "missing": 0,
            "new": 0,
            "backfill": 0,
        },
        {
            "id": "AG-20261102-006",
            "asset_id": "AST-CT-01",
            "title": "风机振动重复上报",
            "risk_level": "MEDIUM",
            "status": "PENDING_REVIEW",
            "reason": "同设备与事件 ID，需与轴承温度联合判断",
            "minutes": 39,
            "count": 3,
            "metric": "vibration",
            "value": 6.8,
            "unit": "mm/s",
            "threshold": 6.0,
            "event_id": "EVT-VIB-CT01-014",
            "missing": 0,
            "new": 0,
            "backfill": 0,
        },
        {
            "id": "AG-20261102-007",
            "asset_id": "AST-CV-01",
            "title": "电机温度与停机时间不一致",
            "risk_level": "MEDIUM",
            "status": "PENDING_REVIEW",
            "reason": "事件 ID 相同，但存在补传时间与本地记录",
            "minutes": 27,
            "count": 3,
            "metric": "temperature",
            "value": 68.3,
            "unit": "°C",
            "threshold": 65.0,
            "event_id": "EVT-TEMP-CV01-018",
            "missing": 0,
            "new": 0,
            "backfill": 1,
        },
        {
            "id": "AG-20261102-008",
            "asset_id": "AST-AG-01",
            "title": "缺少事件 ID 的告警候选",
            "risk_level": "HIGH",
            "status": "PENDING_REVIEW",
            "reason": "来源缺少 event_id，禁止自动归并",
            "minutes": 18,
            "count": 3,
            "metric": "temperature",
            "value": 84.1,
            "unit": "°C",
            "threshold": 80.0,
            "event_id": None,
            "missing": 1,
            "new": 0,
            "backfill": 0,
        },
        {
            "id": "AG-20261102-009",
            "asset_id": "AST-P-101",
            "title": "传感器漂移候选",
            "risk_level": "MEDIUM",
            "status": "ROLLED_BACK",
            "reason": "校准曲线异常，原归并已回退",
            "minutes": 11,
            "count": 2,
            "metric": "temperature",
            "value": 71.9,
            "unit": "°C",
            "threshold": 70.0,
            "event_id": "EVT-TEMP-P101-024",
            "missing": 0,
            "new": 0,
            "backfill": 1,
        },
        {
            "id": "AG-20261102-010",
            "asset_id": "AST-C-201",
            "title": "已恢复的短时电流告警",
            "risk_level": "LOW",
            "status": "CLOSED",
            "reason": "连续健康样本已满足恢复条件",
            "minutes": 5,
            "count": 1,
            "metric": "current",
            "value": 28.4,
            "unit": "A",
            "threshold": 29.0,
            "event_id": "EVT-CUR-C201-031",
            "missing": 0,
            "new": 0,
            "backfill": 0,
        },
    ]

    for index, group in enumerate(groups):
        base = now - timedelta(minutes=int(group["minutes"]))
        all_occurred = []
        all_ingested = []
        for offset in range(int(group["count"])):
            occurred = base + timedelta(minutes=offset * 2)
            ingested = occurred + timedelta(
                seconds=8 + offset * 3 + (900 if group["backfill"] and offset == 0 else 0)
            )
            all_occurred.append(occurred)
            all_ingested.append(ingested)
            connection.execute(
                "INSERT INTO alarm_events "
                "(group_id, raw_event_id, event_id, device_id, asset_id, metric, value, unit, "
                "threshold, occurred_at, ingested_at, source_cycle, is_backfilled, source) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    group["id"],
                    f"RAW-{index + 1:03d}-{offset + 1:02d}",
                    group["event_id"],
                    "DEV-" + str(group["asset_id"]).removeprefix("AST-"),
                    group["asset_id"],
                    group["metric"],
                    round(float(group["value"]) + offset * 0.12, 2),
                    group["unit"],
                    group["threshold"],
                    iso(occurred),
                    iso(ingested),
                    "NASA-CYCLE-23" if group["asset_id"] == "AST-P-101" else "LOCAL-60",
                    1 if group["backfill"] and offset == 0 else 0,
                    "ThingsBoard Rule Engine",
                ),
            )
        connection.execute(
            "INSERT INTO alarm_groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                group["id"],
                group["asset_id"],
                group["title"],
                group["risk_level"],
                group["status"],
                group["reason"],
                iso(min(all_occurred)),
                iso(max(all_occurred)),
                iso(min(all_ingested)),
                iso(max(all_ingested)),
                group["count"],
                group["missing"],
                group["new"],
                "COMPLETED" if group["id"] in {"AG-20261102-003", "AG-20261102-005"} else "NOT_RUN",
            ),
        )

    work_orders = [
        (
            "WO-001",
            "WO-2026-1102-001",
            "AST-AG-01",
            "AG-20261102-001",
            "核实搅拌器温度重传并检查振动异常",
            "ASSIGNED",
            "HIGH",
            "段之衡",
            "温度告警存在重传，同时关注同设备振动测点。",
            "JBJ-140L 维护手册 V3.2",
            "轴承 6208-2RS × 1；密封圈 × 1",
            "11-02 14:00-15:30",
            iso(now - timedelta(hours=1, minutes=30)),
            iso(now - timedelta(minutes=24)),
            None,
            None,
        ),
        (
            "WO-002",
            "WO-2026-1102-002",
            "AST-P-101",
            "AG-20261102-003",
            "循环泵轴承温度复核",
            "IN_PROGRESS",
            "MEDIUM",
            "段之衡",
            "核对轴承温度与润滑状态，确认是否需要更换。",
            "CR-32-2 维护手册 V2.8",
            "润滑脂 EP2 × 1",
            "11-02 15:00-16:00",
            iso(now - timedelta(hours=5)),
            iso(now - timedelta(minutes=12)),
            None,
            None,
        ),
        (
            "WO-003",
            "WO-2026-1102-003",
            "AST-R-301",
            "AG-20261102-005",
            "反应釜压力波动检查",
            "REPAIR_COMPLETED",
            "HIGH",
            "陶书原",
            "已更换压力变送器接头，等待连续健康样本。",
            "R-5KL 工艺手册 V4.1",
            "接头组件 × 1",
            "11-02 10:00-11:00",
            iso(now - timedelta(hours=7)),
            iso(now - timedelta(minutes=48)),
            iso(now - timedelta(minutes=46)),
            None,
        ),
        (
            "WO-004",
            "WO-2026-1102-004",
            "AST-CT-01",
            "AG-20261102-006",
            "冷却塔风机振动检查",
            "RECOVERY_PENDING",
            "MEDIUM",
            "段之衡",
            "紧固风机联轴器，等待恢复产出确认。",
            "LBC-900 维护手册 V1.9",
            "联轴器弹性块 × 2",
            "11-02 09:00-10:30",
            iso(now - timedelta(hours=9)),
            iso(now - timedelta(minutes=35)),
            iso(now - timedelta(minutes=31)),
            None,
        ),
        (
            "WO-005",
            "WO-2026-1102-005",
            "AST-CV-01",
            None,
            "成品输送机停机检查",
            "OPEN",
            "HIGH",
            "待分派",
            "设备停机，先核实电机温度与供电状态。",
            "DS-1200 维护手册 V2.2",
            "待确认",
            "11-02 16:00-17:00",
            iso(now - timedelta(hours=3)),
            iso(now - timedelta(hours=3)),
            None,
            None,
        ),
        (
            "WO-006",
            "WO-2026-1102-006",
            "AST-C-201",
            "AG-20261102-010",
            "空压机电流峰值复核",
            "CLOSED",
            "LOW",
            "陶书原",
            "峰值由工艺负载引起，设备状态已恢复。",
            "GA-75 维护手册 V3.0",
            "无",
            "11-02 08:00-08:30",
            iso(now - timedelta(hours=10)),
            iso(now - timedelta(hours=8)),
            iso(now - timedelta(hours=9)),
            iso(now - timedelta(hours=8)),
        ),
    ]
    connection.executemany(
        "INSERT INTO work_orders VALUES "
        "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        work_orders,
    )

    for work_order in work_orders:
        connection.execute(
            "INSERT INTO work_order_events "
            "(work_order_id, status, actor, note, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                work_order[0],
                work_order[5],
                work_order[7],
                "演示数据初始化",
                work_order[12],
            ),
        )

    audits = [
        (
            "秦序",
            "TIME_FIELDS_NORMALIZED",
            "asset",
            "AST-AG-01",
            "区分发生时间与补传时间",
            iso(now - timedelta(minutes=42)),
        ),
        (
            "段之衡",
            "CANDIDATE_GROUP_REVIEWED",
            "alarm_group",
            "AG-20261102-003",
            "确认 4 条温度告警为同一事件重传",
            iso(now - timedelta(minutes=36)),
        ),
        (
            "陶书原",
            "WORK_ORDER_UPDATED",
            "work_order",
            "WO-003",
            "维修完成，进入恢复核验",
            iso(now - timedelta(minutes=31)),
        ),
    ]
    connection.executemany(
        "INSERT INTO audit_logs (actor, action, target_type, target_id, reason, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        audits,
    )
    connection.commit()


def decode_json_fields(row: sqlite3.Row | dict) -> dict:
    data = dict(row)
    for key, value in list(data.items()):
        if key.endswith("_json") and isinstance(value, str):
            try:
                data[key.removesuffix("_json")] = json.loads(value)
            except json.JSONDecodeError:
                data[key.removesuffix("_json")] = value
    return data
