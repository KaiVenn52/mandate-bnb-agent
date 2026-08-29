import pytest
from fastapi import HTTPException

from app.main import _public_https_endpoint, execution_status, health, provider_capability_contract


def test_health_distinguishes_live_service_from_autonomous_execution():
    result = health()

    assert result["ok"] is True
    assert result["live"] is True
    assert result["liveData"] is True
    assert result["autonomousExecution"] is False
    assert "read-only" in result["executionMode"]
    assert set(result["agents"]) == {"rebalancing", "grid", "yieldRoute", "venusRisk"}


def test_execution_status_exposes_asset_transaction_gap_per_category():
    result = execution_status()

    assert result["schema"] == "mandate.execution-status.v1"
    assert result["chain_id"] == 97
    assert result["registry_chain_id"] == 56
    assert set(result["categories"]) == {"rebalancing", "grid", "yield", "health"}
    assert all(item["service_escrow_enabled"] is True for item in result["categories"].values())
    assert all(item["asset_transaction_enabled"] is False for item in result["categories"].values())
    assert result["service_receipts"]["erc8183_jobs"] == [642, 644, 666]


def test_provider_capability_contract_is_explicit_about_independent_receipts():
    result = provider_capability_contract()

    assert result["schema"] == "mandate.provider-service.v1"
    assert result["chain_id"] == 97
    assert result["required"]["execution_receipts"].startswith("at least one successful")
    assert "execution_receipt_protocol" in result["required"]
    assert "commerce_submission" in result["required"]
    assert "project-owned transaction" in result["receipt_policy"]


def test_provider_acceptance_proxy_rejects_private_endpoints_before_network_io():
    with pytest.raises(HTTPException, match="Private or local"):
        _public_https_endpoint("https://localhost:3000/accept")
    with pytest.raises(HTTPException, match="public HTTPS"):
        _public_https_endpoint("http://provider.example/accept")
