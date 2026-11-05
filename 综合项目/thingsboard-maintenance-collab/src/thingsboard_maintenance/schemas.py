from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ReviewRequest(BaseModel):
    status: str
    actor: str = "罗启山"
    reason: str = Field(min_length=1)


class WorkOrderTransitionRequest(BaseModel):
    status: str
    actor: str = "段之衡"
    note: str = Field(min_length=1)


class CreateWorkOrderRequest(BaseModel):
    actor: str = "陶书原"


class AIAnalyzeRequest(BaseModel):
    alarm_group_id: str


class AIAskRequest(BaseModel):
    question: str = Field(min_length=2)
    asset_id: str | None = None


class ThingsBoardAlarmIngest(BaseModel):
    device_id: str
    asset_id: str
    event_id: str | None = None
    metric: str
    value: float
    unit: str = ""
    threshold: float
    occurred_at: datetime
    ingested_at: datetime
    source_cycle: str | None = None
    source: str = "ThingsBoard Rule Engine"
