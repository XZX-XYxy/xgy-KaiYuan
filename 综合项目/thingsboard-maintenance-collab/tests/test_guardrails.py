from thingsboard_maintenance.core.guardrails import validate_ai_output


def test_guardrail_blocks_device_control() -> None:
    violations = validate_ai_output("建议自动停机并自动复产")
    assert "自动停机" in violations
    assert "自动复产" in violations


def test_guardrail_allows_read_only_explanation() -> None:
    assert validate_ai_output("建议由维修员现场核实振动测点。") == []
