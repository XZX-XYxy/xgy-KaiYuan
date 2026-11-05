from __future__ import annotations

import re


FORBIDDEN_ACTIONS = (
    "自动停机",
    "自动启动",
    "自动复产",
    "自动关闭告警",
    "自动修改工单",
    "绕过上锁挂牌",
    "AUTO_STOP",
    "AUTO_START",
    "AUTO_RESTORE",
    "AUTO_CLOSE",
    "AUTO_UPDATE_WORK_ORDER",
)


def validate_ai_output(text: str) -> list[str]:
    """Return guardrail violations found in a model response."""
    normalized = re.sub(r"\s+", " ", text).upper()
    return [item for item in FORBIDDEN_ACTIONS if item.upper() in normalized]
