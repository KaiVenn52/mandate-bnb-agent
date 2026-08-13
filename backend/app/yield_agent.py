"""Live, read-only BSC stablecoin yield analysis agent.

The agent reads public DefiLlama pool and protocol snapshots, applies the
user's hard mandate constraints, and returns a portable hash-verifiable
deliverable. It never signs or broadcasts a transaction.
"""

from __future__ import annotations

import hashlib
import json
import math
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any


YIELDS_URL = "https://yields.llama.fi/pools"
PROTOCOLS_URL = "https://api.llama.fi/protocols"
CHAIN = "BSC"

PROTOCOL_PROJECTS = {
    "PancakeSwap": {"pancakeswap-amm", "pancakeswap-amm-v3", "pancakeswap-infinity", "pancakeswap-stableswap"},
    "Venus": {"venus-core-pool", "venus-flux", "venus-isolated-pools"},
    "Lista": {"lista-lending"},
}
PROJECT_PROTOCOL = {
    project: protocol
    for protocol, projects in PROTOCOL_PROJECTS.items()
    for project in projects
}
RISK_RANK = {"low": 0, "medium": 1, "high": 2}
TVL_FLOOR = {"low": 10_000_000, "medium": 1_000_000, "high": 250_000}
APY_CEILING = {"low": 15.0, "medium": 30.0, "high": 100.0}
REWARD_SHARE_CEILING = {"low": 0.25, "medium": 0.60, "high": 1.0}
YIELD_REFERENCE_URL = "https://mandate-bnb-agent.vercel.app/evidence/yield-route-reference.json"
YIELD_REFERENCE_SHA256 = "be4e4264f3b5d106ec9f8517c4ddf9292b8b107b92e871243d8702c9302d6d3c"
YIELD_COMMERCE_ADDRESS = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE"
YIELD_ROUTER_ADDRESS = "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25"
YIELD_POLICY_ADDRESS = "0xd6a4217588f6b1f5657a92a3e94e6422ad771cea"


class YieldDataError(RuntimeError):
    pass


def build_yield_deliverable(job_id: int) -> dict[str, Any]:
    if job_id < 0:
        raise ValueError("job_id must be non-negative")
    return {
        "version": 1,
        "job_id": job_id,
        "chain_id": 97,
        "contracts": {
            "commerce": YIELD_COMMERCE_ADDRESS,
            "router": YIELD_ROUTER_ADDRESS,
            "policy": YIELD_POLICY_ADDRESS,
        },
        "response": {
            "content": "YieldRoute completed a live read-only BSC stablecoin analysis. The selected reference route was Lista Lending USDT at 5.01909% observed APY for a 5,000 USDT high-risk mandate. No transaction was attempted.",
            "content_type": "application/json",
        },
        "evidence": {"uri": YIELD_REFERENCE_URL, "sha256": YIELD_REFERENCE_SHA256},
        "metadata": {
            "agent_id": "1806",
            "category": "yield-optimisation",
            "evidence_mode": "live-read-only-reference-snapshot",
            "data_provider": "DefiLlama",
            "sdk": "bnbagent-0.4.2",
        },
    }


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _fetch_json(url: str) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": "MANDATE/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read())
    except (OSError, ValueError, urllib.error.URLError) as exc:
        raise YieldDataError(f"Could not read {url}: {exc}") from exc


def _number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return None


def _asset_matches(symbol: str, asset: str) -> bool:
    tokens = {token.upper() for token in symbol.replace("/", "-").split("-")}
    return asset.upper() in tokens


def _risk_level(pool: dict[str, Any], protocol: dict[str, Any] | None) -> tuple[str, list[str]]:
    reasons: list[str] = []
    tvl = _number(pool.get("tvlUsd")) or 0
    apy = _number(pool.get("apy")) or 0
    apy_base = _number(pool.get("apyBase"))
    reward_share = 1.0 if apy_base is None and apy > 0 else max(0.0, (apy - (apy_base or 0)) / apy) if apy else 0.0
    change_7d = _number(protocol.get("change_7d")) if protocol else None

    level = "low"
    if tvl < 10_000_000 or reward_share > 0.25 or (change_7d is not None and change_7d < -10):
        level = "medium"
    if tvl < 1_000_000 or reward_share > 0.60 or apy > 30 or pool.get("exposure") != "single":
        level = "high"
    if tvl < 10_000_000: reasons.append("pool TVL below $10m")
    if reward_share > 0.25: reasons.append(f"{reward_share:.0%} of APY is rewards or unverified base")
    if change_7d is not None and change_7d < -10: reasons.append(f"protocol TVL changed {change_7d:.1f}% over 7d")
    if pool.get("exposure") != "single": reasons.append("multi-asset exposure")
    if apy > 30: reasons.append("APY outlier above 30%")
    return level, reasons


def _evaluate_pool(pool: dict[str, Any], protocol: dict[str, Any] | None, mandate: dict[str, Any]) -> dict[str, Any]:
    apy = _number(pool.get("apy")) or 0.0
    apy_base = _number(pool.get("apyBase"))
    apy_reward = _number(pool.get("apyReward")) or 0.0
    tvl = _number(pool.get("tvlUsd")) or 0.0
    risk, risk_signals = _risk_level(pool, protocol)
    violations: list[str] = []
    if RISK_RANK[risk] > RISK_RANK[mandate["max_risk"]]: violations.append("risk-cap-exceeded")
    if tvl < TVL_FLOOR[mandate["max_risk"]]: violations.append("pool-tvl-below-risk-floor")
    if apy > APY_CEILING[mandate["max_risk"]]: violations.append("apy-outlier-above-risk-ceiling")
    reward_share = 1.0 if apy_base is None and apy > 0 else max(0.0, (apy - (apy_base or 0)) / apy) if apy else 0.0
    if reward_share > REWARD_SHARE_CEILING[mandate["max_risk"]]: violations.append("reward-share-above-risk-ceiling")
    if pool.get("exposure") != "single": violations.append("single-asset-mandate-required")
    if str(pool.get("ilRisk", "yes")).lower() != "no": violations.append("impermanent-loss-risk")

    capital = mandate["capital_usd"]
    return {
        "pool_id": pool.get("pool"),
        "protocol": PROJECT_PROTOCOL.get(str(pool.get("project"))),
        "project": pool.get("project"),
        "symbol": pool.get("symbol"),
        "pool_meta": pool.get("poolMeta"),
        "apy_pct": round(apy, 5),
        "apy_base_pct": round(apy_base, 5) if apy_base is not None else None,
        "apy_reward_pct": round(apy_reward, 5),
        "estimated_gross_yield_usd_year": round(capital * apy / 100, 2),
        "pool_tvl_usd": round(tvl, 2),
        "protocol_tvl_usd": round(_number(protocol.get("tvl")) or 0, 2) if protocol else None,
        "protocol_tvl_change_7d_pct": round(_number(protocol.get("change_7d")) or 0, 4) if protocol else None,
        "risk": risk,
        "risk_signals": risk_signals,
        "eligible": not violations,
        "violations": violations,
        "source_fields": ["apy", "apyBase", "apyReward", "tvlUsd", "stablecoin", "exposure", "ilRisk"],
    }


def run_yield_route_agent(
    asset: str,
    capital_usd: float,
    max_risk: str,
    leverage_max: float,
    allowed_protocols: list[str],
    max_actions_per_week: int,
) -> dict[str, Any]:
    if max_risk not in RISK_RANK:
        raise ValueError("max_risk must be low, medium, or high")
    requested = allowed_protocols or list(PROTOCOL_PROJECTS)
    normalized = [name for name in PROTOCOL_PROJECTS if name.lower() in {item.lower() for item in requested}]
    if not normalized:
        raise ValueError("No supported protocol remains in the allowlist")

    yields_payload = _fetch_json(YIELDS_URL)
    protocols_payload = _fetch_json(PROTOCOLS_URL)
    protocol_by_slug = {str(item.get("slug")): item for item in protocols_payload if item.get("slug")}
    allowed_projects = {project for name in normalized for project in PROTOCOL_PROJECTS[name]}
    pools = [
        pool for pool in yields_payload.get("data", [])
        if pool.get("chain") == CHAIN
        and pool.get("project") in allowed_projects
        and pool.get("stablecoin") is True
        and _asset_matches(str(pool.get("symbol", "")), asset)
        and (_number(pool.get("apy")) or 0) > 0
    ]

    mandate = {
        "asset": asset.upper(),
        "capital_usd": capital_usd,
        "max_risk": max_risk,
        "leverage_max": leverage_max,
        "allowed_protocols": normalized,
        "max_actions_per_week": max_actions_per_week,
        "broadcast_allowed": False,
    }
    evaluated = [_evaluate_pool(pool, protocol_by_slug.get(str(pool.get("project"))), mandate) for pool in pools]
    eligible = sorted((item for item in evaluated if item["eligible"]), key=lambda item: (-item["apy_pct"], -item["pool_tvl_usd"]))
    rejected = sorted((item for item in evaluated if not item["eligible"]), key=lambda item: -item["apy_pct"])
    selected = eligible[0] if eligible else None

    if selected:
        decision = {
            "status": "ROUTE_FOUND",
            "selected_pool_id": selected["pool_id"],
            "protocol": selected["protocol"],
            "project": selected["project"],
            "symbol": selected["symbol"],
            "apy_pct": selected["apy_pct"],
            "estimated_gross_yield_usd_year": selected["estimated_gross_yield_usd_year"],
            "recommendation": "Best currently observed APY among supported pools that satisfy every encoded risk gate. Review protocol and smart-contract risk before any deposit.",
            "transaction_attempted": False,
        }
    else:
        decision = {
            "status": "NO_COMPLIANT_ROUTE",
            "selected_pool_id": None,
            "recommendation": "No observed supported pool satisfies every encoded mandate constraint. Keep funds unchanged.",
            "transaction_attempted": False,
        }

    generated_at = datetime.now(timezone.utc).isoformat()
    manifest: dict[str, Any] = {
        "schema": "mandate.yield-route-evidence.v1",
        "agent": {"erc8004_id": 1806, "name": "YieldRoute"},
        "mandate": mandate,
        "source": {
            "chain": "BNB Smart Chain",
            "chain_id": 56,
            "provider": "DefiLlama",
            "yield_url": YIELDS_URL,
            "protocol_url": PROTOCOLS_URL,
            "retrieved_at_utc": generated_at,
            "method": "public API snapshot; read-only",
        },
        "coverage": {
            "supported_protocols": normalized,
            "matching_pools": len(evaluated),
            "eligible_pools": len(eligible),
            "rejected_pools": len(rejected),
            "limitations": [
                "APY is a point-in-time third-party observation and is not guaranteed.",
                "DefiLlama does not attest that a route is free of leverage; MANDATE limits this run to disclosed single-asset pools in its supported protocol universe.",
                "Estimated yield excludes future APY changes, gas, slippage, taxes, and smart-contract loss.",
            ],
        },
        "decision": decision,
        "eligible_routes": eligible[:5],
        "rejected_routes": rejected[:10],
        "generated_at_utc": generated_at,
    }
    manifest["deliverable_sha256"] = hashlib.sha256(_canonical_json(manifest).encode()).hexdigest()
    return manifest
