from app.main import health


def test_health_distinguishes_live_service_from_autonomous_execution():
    result = health()

    assert result["ok"] is True
    assert result["live"] is True
    assert result["liveData"] is True
    assert result["autonomousExecution"] is False
    assert "read-only" in result["executionMode"]
    assert set(result["agents"]) == {"rebalancing", "grid", "yieldRoute", "venusRisk"}
