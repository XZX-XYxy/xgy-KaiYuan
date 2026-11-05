import pytest

from thingsboard_maintenance.core.work_order_service import (
    WorkOrderStatus,
    assert_transition_allowed,
)


def test_valid_work_order_transition() -> None:
    assert_transition_allowed(WorkOrderStatus.OPEN, WorkOrderStatus.ASSIGNED)


def test_repair_completed_cannot_skip_recovery() -> None:
    with pytest.raises(ValueError):
        assert_transition_allowed(
            WorkOrderStatus.REPAIR_COMPLETED,
            WorkOrderStatus.CLOSED,
        )
