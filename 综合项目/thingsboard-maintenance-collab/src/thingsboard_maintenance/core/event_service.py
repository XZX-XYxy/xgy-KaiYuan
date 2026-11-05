from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable


@dataclass(slots=True)
class EventRecord:
    device_id: str
    event_id: str | None
    occurred_at: datetime
    ingested_at: datetime
    source_cycle: str | None = None
    telemetry_name: str = ""
    value: float | None = None
    source_ref: str = ""


@dataclass(slots=True)
class CandidateGroup:
    device_id: str
    event_id: str | None
    events: list[EventRecord] = field(default_factory=list)
    missing_event_id: bool = False

    @property
    def first_occurrence(self) -> datetime:
        return min(item.occurred_at for item in self.events)

    @property
    def last_occurrence(self) -> datetime:
        return max(item.occurred_at for item in self.events)


def build_candidate_groups(events: Iterable[EventRecord]) -> list[CandidateGroup]:
    """Group by device and event id while preserving every raw event."""
    grouped: dict[tuple[str, str | None], list[EventRecord]] = defaultdict(list)
    missing: list[EventRecord] = []

    for event in events:
        if not event.event_id:
            missing.append(event)
            continue
        grouped[(event.device_id, event.event_id)].append(event)

    groups = [
        CandidateGroup(device_id=device_id, event_id=event_id, events=items)
        for (device_id, event_id), items in grouped.items()
    ]
    groups.extend(
        CandidateGroup(
            device_id=event.device_id,
            event_id=None,
            events=[event],
            missing_event_id=True,
        )
        for event in missing
    )
    return sorted(groups, key=lambda group: group.first_occurrence)
