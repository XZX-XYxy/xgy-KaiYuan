from __future__ import annotations

from dataclasses import dataclass

import httpx

from thingsboard_maintenance.config import settings


@dataclass(slots=True)
class ThingsBoardStatus:
    configured: bool
    reachable: bool
    base_url: str
    detail: str


def probe_thingsboard() -> ThingsBoardStatus:
    if not settings.thingsboard_base_url:
        return ThingsBoardStatus(False, False, "", "THINGSBOARD_BASE_URL 未配置")
    url = f"{settings.thingsboard_base_url.rstrip('/')}/api/auth/login"
    try:
        response = httpx.post(
            url,
            json={
                "username": settings.thingsboard_username,
                "password": settings.thingsboard_password,
            },
            timeout=3.0,
        )
        reachable = response.status_code == 200
        return ThingsBoardStatus(
            True,
            reachable,
            settings.thingsboard_base_url,
            "连接正常" if reachable else f"HTTP {response.status_code}",
        )
    except httpx.HTTPError as error:
        return ThingsBoardStatus(
            True,
            False,
            settings.thingsboard_base_url,
            type(error).__name__,
        )
