"""Live read-only BSC market agents for LP rebalancing and grid planning.

Both agents read the canonical WBNB/USDT PancakeSwap market from DexScreener,
apply explicit mandate limits, and return hash-verifiable decision evidence.
They never sign or broadcast a transaction.
"""

from __future__ import annotations

import hashlib
import json
import math
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any


DEXSCREENER_URL = (
    "https://api.dexscreener.com/token-pairs/v1/bsc/"
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
)
USDT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955"
CHAIN_ID = 56


class MarketDataError(RuntimeError):
    pass


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _number(value: Any) -> float:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    if isinstance(value, str):
        try:
            parsed = float(value)
            return parsed if math.isfinite(parsed) else 0.0
        except ValueError:
            return 0.0
    return 0.0


def _fetch_pairs() -> list[dict[str, Any]]:
    request = urllib.request.Request(DEXSCREENER_URL, headers={"User-Agent": "MANDATE/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read())
    except (OSError, ValueError, urllib.error.URLError) as exc:
        raise MarketDataError(f"DexScreener read failed: {exc}") from exc
    if not isinstance(payload, list):
        raise MarketDataError("DexScreener returned an unexpected payload")
    return payload


def _live_market() -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    for pair in _fetch_pairs():
        base = str(pair.get("baseToken", {}).get("address", "")).lower()
        quote = str(pair.get("quoteToken", {}).get("address", "")).lower()
        if pair.get("chainId") != "bsc" or "pancake" not in str(pair.get("dexId", "")).lower():
            continue
        if USDT_ADDRESS not in {base, quote}:
            continue
        candidates.append(pair)
    if not candidates:
        raise MarketDataError("No PancakeSwap WBNB/USDT market was returned")
    # Prefer V3 for concentrated-liquidity analysis and the deepest V3 market.
    v3 = [pair for pair in candidates if "v3" in (pair.get("labels") or [])]
    pool = max(v3 or candidates, key=lambda item: _number(item.get("liquidity", {}).get("usd")))
    price = _number(pool.get("priceUsd"))
    if price <= 0:
        raise MarketDataError("Live market price was missing")
    changes = pool.get("priceChange") or {}
    return {
        "pair_address": pool.get("pairAddress"),
        "dex": pool.get("dexId"),
        "version": (pool.get("labels") or ["unknown"])[0],
        "price_usd": price,
        "change_m5_pct": _number(changes.get("m5")),
        "change_h1_pct": _number(changes.get("h1")),
        "change_h6_pct": _number(changes.get("h6")),
        "change_h24_pct": _number(changes.get("h24")),
        "liquidity_usd": _number(pool.get("liquidity", {}).get("usd")),
        "volume_h24_usd": _number(pool.get("volume", {}).get("h24")),
        "buys_h24": int(_number(pool.get("txns", {}).get("h24", {}).get("buys"))),
        "sells_h24": int(_number(pool.get("txns", {}).get("h24", {}).get("sells"))),
        "url": pool.get("url"),
    }


def _finish(payload: dict[str, Any]) -> dict[str, Any]:
    payload["generated_at_utc"] = datetime.now(timezone.utc).isoformat()
    payload["deliverable_sha256"] = hashlib.sha256(_canonical_json(payload).encode()).hexdigest()
    return payload


def run_rebalancing_agent(
    capital_usd: float,
    max_rebalances_per_day: int,
    max_gas_drag_pct: float,
    target_width_pct: float,
) -> dict[str, Any]:
    market = _live_market()
    observed_move = max(
        abs(market["change_h1_pct"]),
        abs(market["change_h6_pct"]) / 2,
        abs(market["change_h24_pct"]) / 4,
        0.75,
    )
    adaptive_half_width = max(target_width_pct / 2, min(15.0, observed_move * 2.4))
    lower = market["price_usd"] * (1 - adaptive_half_width / 100)
    upper = market["price_usd"] * (1 + adaptive_half_width / 100)
    estimated_daily_gas_usd = min(max_rebalances_per_day, 2) * 0.08
    conservative_daily_fee_usd = max(0.01, capital_usd * min(market["volume_h24_usd"] / max(market["liquidity_usd"], 1), 2) * 0.0001)
    gas_drag = estimated_daily_gas_usd / conservative_daily_fee_usd * 100
    action = "HOLD_RANGE"
    reasons = ["current price remains the centre of the newly calculated range"]
    if abs(market["change_h1_pct"]) > adaptive_half_width * 0.7:
        action = "REBALANCE_RANGE"
        reasons = ["one-hour move approaches the mandate range boundary"]
    if gas_drag > max_gas_drag_pct:
        action = "NO_ACTION"
        reasons = ["estimated gas drag exceeds the mandate ceiling"]
    payload = {
        "schema": "mandate.rebalancing-evidence.v1",
        "agent": {"erc8004_id": 1804, "name": "RangeGuard"},
        "mandate": {
            "capital_usd": capital_usd,
            "max_rebalances_per_day": max_rebalances_per_day,
            "max_gas_drag_pct": max_gas_drag_pct,
            "target_width_pct": target_width_pct,
            "broadcast_allowed": False,
        },
        "source": {"chain": "BNB Smart Chain", "chain_id": CHAIN_ID, "provider": "DexScreener", "url": DEXSCREENER_URL},
        "market": market,
        "decision": {
            "status": action,
            "range_lower_usd": round(lower, 4),
            "range_upper_usd": round(upper, 4),
            "adaptive_width_pct": round(adaptive_half_width * 2, 3),
            "estimated_gas_drag_pct": round(gas_drag, 3),
            "reasons": reasons,
            "recommendation": f"{action.replace('_', ' ').title()}: use the live ${market['price_usd']:.2f} BNB price with a ${lower:.2f}-${upper:.2f} bounded range.",
            "transaction_attempted": False,
        },
        "limitations": [
            "This is a point-in-time decision, not continuous position management.",
            "Gas and fee estimates are conservative heuristics and must be rechecked before execution.",
            "No LP NFT or wallet position was read or moved.",
        ],
    }
    return _finish(payload)


def run_grid_agent(
    capital_usd: float,
    max_drawdown_pct: float,
    max_orders_per_day: int,
    grid_levels: int,
) -> dict[str, Any]:
    market = _live_market()
    directional_pressure = max(abs(market["change_h6_pct"]), abs(market["change_h24_pct"]))
    ranging = directional_pressure <= max(4.0, max_drawdown_pct)
    half_width = max(1.5, min(max_drawdown_pct * 0.8, abs(market["change_h24_pct"]) * 1.4 + 1.0))
    lower = market["price_usd"] * (1 - half_width / 100)
    upper = market["price_usd"] * (1 + half_width / 100)
    levels = min(grid_levels, max_orders_per_day, 24)
    step = (upper - lower) / max(levels - 1, 1)
    prices = [round(lower + step * index, 4) for index in range(levels)]
    status = "GRID_READY" if ranging and levels >= 3 else "PAUSE_GRID"
    payload = {
        "schema": "mandate.grid-evidence.v1",
        "agent": {"erc8004_id": 1805, "name": "GridPilot"},
        "mandate": {
            "capital_usd": capital_usd,
            "max_drawdown_pct": max_drawdown_pct,
            "max_orders_per_day": max_orders_per_day,
            "requested_grid_levels": grid_levels,
            "broadcast_allowed": False,
        },
        "source": {"chain": "BNB Smart Chain", "chain_id": CHAIN_ID, "provider": "DexScreener", "url": DEXSCREENER_URL},
        "market": market,
        "decision": {
            "status": status,
            "market_regime": "RANGING" if ranging else "TRENDING",
            "grid_lower_usd": round(lower, 4),
            "grid_upper_usd": round(upper, 4),
            "grid_levels": levels,
            "order_notional_usd": round(capital_usd / levels, 2),
            "grid_prices_usd": prices,
            "hard_stop_usd": round(market["price_usd"] * (1 - max_drawdown_pct / 100), 4),
            "recommendation": (
                f"Run {levels} bounded levels between ${lower:.2f} and ${upper:.2f}."
                if status == "GRID_READY"
                else "Pause new grid orders because the observed move exceeds the ranging-market gate."
            ),
            "transaction_attempted": False,
        },
        "limitations": [
            "The plan uses live DEX market statistics, not a promise of profit.",
            "No orders, approvals, swaps, or custody changes were attempted.",
            "The plan must be refreshed before execution because market conditions change.",
        ],
    }
    return _finish(payload)
