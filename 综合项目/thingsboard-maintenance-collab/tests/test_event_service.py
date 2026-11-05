from datetime import UTC, datetime, timedelta

from thingsboard_maintenance.core.event_service import EventRecord, build_candidate_groups


def test_events_with_same_device_and_event_id_are_grouped() -> None:
    now = datetime.now(UTC)
    events = [
        EventRecord("DEV-1", "EVT-1", now, now + timedelta(seconds=3)),
        EventRecord("DEV-1", "EVT-1", now + timedelta(seconds=1), now + timedelta(seconds=4)),
    ]

    groups = build_candidate_groups(events)

    assert len(groups) == 1
    assert len(groups[0].events) == 2
    assert groups[0].first_occurrence == now


def test_missing_event_id_is_kept_as_candidate() -> None:
    now = datetime.now(UTC)
    groups = build_candidate_groups(
        [EventRecord("DEV-1", None, now, now, telemetry_name="vibration")]
    )

    assert len(groups) == 1
    assert groups[0].missing_event_id is True
    assert groups[0].event_id is None
