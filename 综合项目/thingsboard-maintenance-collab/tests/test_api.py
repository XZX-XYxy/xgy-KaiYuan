from fastapi.testclient import TestClient
from datetime import UTC, datetime

from thingsboard_maintenance.main import create_app


def test_dashboard_and_alarm_api(tmp_path) -> None:
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200

        dashboard = client.get("/api/dashboard/summary")
        assert dashboard.status_code == 200
        payload = dashboard.json()
        assert payload["kpis"]["rawEvents"] == 120
        assert payload["kpis"]["duplicateCandidates"] == 18

        groups = client.get("/api/alarm-groups")
        assert groups.status_code == 200
        assert len(groups.json()["items"]) == 10

        group_id = groups.json()["items"][0]["id"]
        detail = client.get(f"/api/alarm-groups/{group_id}")
        assert detail.status_code == 200
        assert detail.json()["events"]


def test_demo_refresh_keeps_record_counts(tmp_path) -> None:
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        response = client.post("/api/demo/refresh")
        assert response.status_code == 200
        payload = response.json()
        assert payload["refreshed"] is True
        assert payload["telemetryEvents"] == 120

        dashboard = client.get("/api/dashboard/summary").json()
        assert dashboard["kpis"]["rawEvents"] == 120
        assert any(bucket["telemetry"] > 0 for bucket in dashboard["trend"])


def test_knowledge_and_graph_api(tmp_path) -> None:
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        search = client.get("/api/knowledge/search", params={"q": "告警 时间 去重", "limit": 8})
        assert search.status_code == 200
        assert len(search.json()["items"]) > 0

        graph = client.get("/api/knowledge/graph")
        assert graph.status_code == 200
        payload = graph.json()
        assert payload["knowledgeCount"] >= 40
        assert payload["nodes"]
        assert payload["edges"]


def test_thingsboard_alarm_ingest(tmp_path) -> None:
    app = create_app(tmp_path / "test.db")
    stamp = datetime.now(UTC).isoformat()
    with TestClient(app) as client:
        response = client.post(
            "/api/integrations/thingsboard/alarm",
            json={
                "device_id": "DEV-AG-01",
                "asset_id": "AST-AG-01",
                "event_id": "EVT-API-TEST-001",
                "metric": "vibration",
                "value": 8.6,
                "unit": "mm/s",
                "threshold": 7.1,
                "occurred_at": stamp,
                "ingested_at": stamp,
                "source_cycle": "RULE-CHAIN-TEST",
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["asset_id"] == "AST-AG-01"
        assert payload["events"][0]["event_id"] == "EVT-API-TEST-001"
