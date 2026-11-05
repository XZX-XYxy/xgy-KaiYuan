from __future__ import annotations

from datetime import UTC, datetime

import httpx


def main() -> None:
    now = datetime.now(UTC).replace(microsecond=0).isoformat()
    payload = {
        "device_id": "DEV-AG-01",
        "asset_id": "AST-AG-01",
        "event_id": "EVT-DEMO-TB-001",
        "metric": "vibration",
        "value": 8.8,
        "unit": "mm/s",
        "threshold": 7.1,
        "occurred_at": now,
        "ingested_at": now,
        "source_cycle": "TB-RULE-CHAIN-01",
        "source": "ThingsBoard Rule Engine",
    }
    response = httpx.post(
        "http://127.0.0.1:8000/api/integrations/thingsboard/alarm",
        json=payload,
        timeout=10.0,
    )
    response.raise_for_status()
    result = response.json()
    print(f"Created alarm group: {result['id']}")


if __name__ == "__main__":
    main()
