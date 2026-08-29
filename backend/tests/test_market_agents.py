from app.market_agents import run_grid_agent, run_rebalancing_agent


LIVE_MARKET = {
    "pair_address": "0xpair",
    "dex": "pancakeswap",
    "version": "v3",
    "price_usd": 700.0,
    "change_m5_pct": 0.1,
    "change_h1_pct": 0.6,
    "change_h6_pct": 1.2,
    "change_h24_pct": 2.0,
    "liquidity_usd": 10_000_000.0,
    "volume_h24_usd": 20_000_000.0,
    "buys_h24": 100,
    "sells_h24": 90,
    "url": "https://dexscreener.com/bsc/0xpair",
}


def test_rebalancing_agent_returns_bounded_live_decision(monkeypatch):
    monkeypatch.setattr("app.market_agents._live_market", lambda: LIVE_MARKET)
    result = run_rebalancing_agent(10_000, 2, 20, 15)
    assert result["agent"]["erc8004_id"] == 1804
    assert result["decision"]["transaction_attempted"] is False
    assert result["decision"]["range_lower_usd"] < 700 < result["decision"]["range_upper_usd"]
    assert len(result["deliverable_sha256"]) == 64


def test_grid_agent_caps_levels_and_returns_no_transaction(monkeypatch):
    monkeypatch.setattr("app.market_agents._live_market", lambda: LIVE_MARKET)
    result = run_grid_agent(5_000, 5, 6, 12)
    assert result["agent"]["erc8004_id"] == 1805
    assert result["decision"]["grid_levels"] == 6
    assert result["decision"]["transaction_attempted"] is False
    assert len(result["decision"]["grid_prices_usd"]) == 6


def test_rebalancing_evidence_preserves_non_daily_activity_limit(monkeypatch):
    monkeypatch.setattr("app.market_agents._live_market", lambda: LIVE_MARKET)
    result = run_rebalancing_agent(10_000, 1, 20, 15, action_cap=2, action_period="week")
    assert result["mandate"]["action_cap"] == 2
    assert result["mandate"]["action_period"] == "week"
    assert result["mandate"]["effective_daily_cap"] == 0.2857


def test_grid_evidence_preserves_user_activity_limit(monkeypatch):
    monkeypatch.setattr("app.market_agents._live_market", lambda: LIVE_MARKET)
    result = run_grid_agent(5_000, 4, 1, 7, action_cap=2, action_period="week")
    assert result["mandate"]["action_cap"] == 2
    assert result["mandate"]["action_period"] == "week"
    assert result["mandate"]["effective_daily_cap"] == 0.2857
