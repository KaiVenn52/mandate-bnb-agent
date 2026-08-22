import pytest
from fastapi import HTTPException

from app.main import erc8183_marketplace_deliverable


def test_all_marketplace_categories_expose_deterministic_deliverables():
    expected_agents = {
        "rebalancing": "1804",
        "grid": "1805",
        "yield": "1806",
        "health": "1807",
    }
    for category, agent_id in expected_agents.items():
        body = erc8183_marketplace_deliverable(category, 506)
        assert body["job_id"] == 506
        assert body["chain_id"] == 97
        assert body["metadata"]["agent_id"] == agent_id
        assert body["response"]["content"]


def test_unknown_marketplace_category_is_rejected():
    with pytest.raises(HTTPException) as exc:
        erc8183_marketplace_deliverable("unknown", 506)
    assert exc.value.status_code == 404
