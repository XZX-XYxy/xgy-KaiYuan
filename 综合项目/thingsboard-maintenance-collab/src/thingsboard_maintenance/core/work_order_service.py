from __future__ import annotations

from enum import StrEnum


class WorkOrderStatus(StrEnum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    REPAIR_COMPLETED = "REPAIR_COMPLETED"
    RECOVERY_PENDING = "RECOVERY_PENDING"
    RECOVERED = "RECOVERED"
    CLOSED = "CLOSED"
    ESCALATED = "ESCALATED"


ALLOWED_TRANSITIONS: dict[WorkOrderStatus, set[WorkOrderStatus]] = {
    WorkOrderStatus.DRAFT: {WorkOrderStatus.OPEN},
    WorkOrderStatus.OPEN: {WorkOrderStatus.ASSIGNED, WorkOrderStatus.ESCALATED},
    WorkOrderStatus.ASSIGNED: {WorkOrderStatus.IN_PROGRESS},
    WorkOrderStatus.IN_PROGRESS: {
        WorkOrderStatus.REPAIR_COMPLETED,
        WorkOrderStatus.ESCALATED,
    },
    WorkOrderStatus.REPAIR_COMPLETED: {WorkOrderStatus.RECOVERY_PENDING},
    WorkOrderStatus.RECOVERY_PENDING: {
        WorkOrderStatus.RECOVERED,
        WorkOrderStatus.ESCALATED,
    },
    WorkOrderStatus.RECOVERED: {WorkOrderStatus.CLOSED},
    WorkOrderStatus.ESCALATED: {WorkOrderStatus.OPEN},
    WorkOrderStatus.CLOSED: set(),
}


def assert_transition_allowed(
    current: WorkOrderStatus,
    target: WorkOrderStatus,
) -> None:
    if target not in ALLOWED_TRANSITIONS[current]:
        raise ValueError(f"Invalid work-order transition: {current} -> {target}")
