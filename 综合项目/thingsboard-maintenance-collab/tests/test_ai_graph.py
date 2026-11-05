from thingsboard_maintenance.ai.graph import run_maintenance_graph
from thingsboard_maintenance.config import settings


def test_ai_graph_falls_back_without_external_model(monkeypatch) -> None:
    monkeypatch.setattr(settings, "dashscope_api_key", "")
    result = run_maintenance_graph(
        question="重复告警与振动新事件如何区分？",
        context={},
        authorized=True,
        task="knowledge_qa",
    )

    assert result["allowedNextStep"] == "HUMAN_REVIEW"
    assert result["citations"]
    assert result["evidence"]
    assert result["guardrailViolations"] == []
