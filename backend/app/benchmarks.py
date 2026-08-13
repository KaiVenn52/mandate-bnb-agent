"""Versioned, reproducible Agent Advantage benchmark fixtures.

The fixtures are deliberately frozen and deterministic.  The API returns the
complete input, its SHA-256 digest, the raw agent output, and server-side
execution time so a reviewer can reproduce every claimed result.  Human
baseline timings are never generated here; they must come from a real person.
"""

from __future__ import annotations

import hashlib
import json
import time
from copy import deepcopy
from typing import Any


BENCHMARK_VERSION = "mandate-aar-1.0.0"


TASKS: dict[str, dict[str, Any]] = {
    "A-01": {
        "title": "Stablecoin yield route selection",
        "category": "yield-optimisation",
        "high_stakes": False,
        "mandate": {
            "capital_usd": 10_000,
            "asset": "USDT",
            "max_risk": "medium",
            "leverage_allowed": False,
            "max_actions_per_week": 2,
            "allowed_protocols": ["PancakeSwap", "Venus", "Lista"],
        },
        "candidates": [
            {"id": "venus-supply", "protocol": "Venus", "net_apy_pct": 5.92, "risk": "low", "leverage": 0, "actions_per_week": 1, "stablecoin_exposure_pct": 100},
            {"id": "lista-usdt", "protocol": "Lista", "net_apy_pct": 5.95, "risk": "medium", "leverage": 0, "actions_per_week": 2, "stablecoin_exposure_pct": 100},
            {"id": "pancake-stable-lp", "protocol": "PancakeSwap", "net_apy_pct": 6.15, "risk": "medium", "leverage": 0, "actions_per_week": 4, "stablecoin_exposure_pct": 100},
            {"id": "leveraged-loop", "protocol": "Venus", "net_apy_pct": 8.40, "risk": "high", "leverage": 2, "actions_per_week": 2, "stablecoin_exposure_pct": 100},
        ],
        "answer_key": {"decision": "lista-usdt", "metric": 5.95, "rejected": ["pancake-stable-lp", "leveraged-loop"]},
        "rubric": [
            "4 points: selected route obeys every hard mandate constraint",
            "2 points: reported net APY is 5.95%",
            "2 points: identifies both higher-yield constraint violations",
            "2 points: gives a concise evidence-based recommendation",
        ],
    },
    "A-02": {
        "title": "BNB/USDT grid plan safety review",
        "category": "trading",
        "high_stakes": True,
        "mandate": {"max_drawdown_pct": 5.0, "max_trades_per_day": 12, "minimum_profit_factor": 1.35, "fees_must_be_included": True},
        "candidates": [
            {"id": "calm-18", "gross_pnl_pct": 3.30, "fees_pct": 0.40, "max_drawdown_pct": 3.00, "profit_factor": 1.44, "trades_per_day": 6},
            {"id": "balanced-26", "gross_pnl_pct": 3.90, "fees_pct": 0.50, "max_drawdown_pct": 4.40, "profit_factor": 1.52, "trades_per_day": 9},
            {"id": "turbo-40", "gross_pnl_pct": 5.70, "fees_pct": 0.90, "max_drawdown_pct": 6.10, "profit_factor": 1.61, "trades_per_day": 15},
        ],
        "answer_key": {"decision": "balanced-26", "metric": 3.40, "rejected": ["turbo-40"]},
        "rubric": [
            "4 points: rejects every plan breaching drawdown or activity caps",
            "2 points: computes 3.40% net PnL after fees",
            "2 points: selects the best compliant plan",
            "2 points: reports risk limits instead of presenting return alone",
        ],
    },
    "A-03": {
        "title": "Venus health-factor intervention",
        "category": "security-risk-monitoring",
        "high_stakes": True,
        "mandate": {"minimum_health_factor": 1.8, "new_borrowing_allowed": False, "allowed_actions": ["repay", "add-collateral", "no-action"]},
        "position": {"collateral_value_usd": 12_000, "liquidation_threshold": 0.80, "debt_usd": 6_900},
        "candidates": [
            {"id": "repay-1600", "action": "repay", "amount_usd": 1_600},
            {"id": "add-3600", "action": "add-collateral", "amount_usd": 3_600},
            {"id": "borrow-500", "action": "borrow", "amount_usd": 500},
            {"id": "no-action", "action": "no-action", "amount_usd": 0},
        ],
        "answer_key": {"decision": "repay-1600", "metric": 1.8113, "rejected": ["borrow-500", "no-action"]},
        "rubric": [
            "4 points: action is allowed and restores health factor to at least 1.8",
            "2 points: recomputes post-action health factor to about 1.8113",
            "2 points: chooses the lower-capital compliant intervention",
            "2 points: rejects borrowing and no-action with reasons",
        ],
    },
}


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def public_task(task_id: str) -> dict[str, Any]:
    task = deepcopy(TASKS[task_id])
    task.pop("answer_key")
    task["id"] = task_id
    task["benchmark_version"] = BENCHMARK_VERSION
    task["input_sha256"] = hashlib.sha256(_canonical_json(task).encode()).hexdigest()
    return task


def _run_yield(task: dict[str, Any]) -> dict[str, Any]:
    risk_rank = {"low": 0, "medium": 1, "high": 2}
    mandate = task["mandate"]
    compliant, rejected = [], []
    for route in task["candidates"]:
        reasons = []
        if route["protocol"] not in mandate["allowed_protocols"]: reasons.append("protocol-not-allowed")
        if route["leverage"] and not mandate["leverage_allowed"]: reasons.append("leverage-forbidden")
        if risk_rank[route["risk"]] > risk_rank[mandate["max_risk"]]: reasons.append("risk-cap-exceeded")
        if route["actions_per_week"] > mandate["max_actions_per_week"]: reasons.append("activity-cap-exceeded")
        if route["stablecoin_exposure_pct"] != 100: reasons.append("asset-exposure-mismatch")
        (rejected if reasons else compliant).append({"id": route["id"], "reasons": reasons})
    selected_id = max((x["id"] for x in compliant), key=lambda candidate_id: next(x["net_apy_pct"] for x in task["candidates"] if x["id"] == candidate_id))
    selected = next(x for x in task["candidates"] if x["id"] == selected_id)
    return {"decision": selected_id, "metric": selected["net_apy_pct"], "rejected": rejected, "recommendation": f"Select {selected_id}: highest net APY among routes that satisfy every hard constraint."}


def _run_grid(task: dict[str, Any]) -> dict[str, Any]:
    mandate = task["mandate"]
    compliant, rejected = [], []
    for plan in task["candidates"]:
        reasons = []
        if plan["max_drawdown_pct"] > mandate["max_drawdown_pct"]: reasons.append("drawdown-cap-exceeded")
        if plan["trades_per_day"] > mandate["max_trades_per_day"]: reasons.append("activity-cap-exceeded")
        if plan["profit_factor"] < mandate["minimum_profit_factor"]: reasons.append("profit-factor-below-minimum")
        net = round(plan["gross_pnl_pct"] - plan["fees_pct"], 2)
        (rejected if reasons else compliant).append({"id": plan["id"], "net_pnl_pct": net, "reasons": reasons})
    selected = max(compliant, key=lambda x: x["net_pnl_pct"])
    return {"decision": selected["id"], "metric": selected["net_pnl_pct"], "rejected": rejected, "recommendation": f"Select {selected['id']}; it has the best fee-adjusted return without breaching the 5% drawdown or 12-trade caps."}


def _run_health(task: dict[str, Any]) -> dict[str, Any]:
    p, mandate = task["position"], task["mandate"]
    evaluated = []
    for option in task["candidates"]:
        collateral, debt = p["collateral_value_usd"], p["debt_usd"]
        allowed = option["action"] in mandate["allowed_actions"]
        if option["action"] == "repay": debt -= option["amount_usd"]
        elif option["action"] == "add-collateral": collateral += option["amount_usd"]
        elif option["action"] == "borrow": debt += option["amount_usd"]
        hf = round(collateral * p["liquidation_threshold"] / debt, 4)
        evaluated.append({"id": option["id"], "allowed": allowed, "post_health_factor": hf, "capital_required_usd": option["amount_usd"]})
    compliant = [x for x in evaluated if x["allowed"] and x["post_health_factor"] >= mandate["minimum_health_factor"]]
    selected = min(compliant, key=lambda x: x["capital_required_usd"])
    rejected = [{"id": x["id"], "reasons": (["action-forbidden"] if not x["allowed"] else []) + (["health-factor-below-minimum"] if x["post_health_factor"] < mandate["minimum_health_factor"] else [])} for x in evaluated if x["id"] != selected["id"] and (not x["allowed"] or x["post_health_factor"] < mandate["minimum_health_factor"])]
    return {"decision": selected["id"], "metric": selected["post_health_factor"], "rejected": rejected, "recommendation": f"Select {selected['id']}; it restores HF above 1.8 with the least required capital and adds no debt."}


RUNNERS = {"A-01": _run_yield, "A-02": _run_grid, "A-03": _run_health}


def run_agent(task_id: str) -> dict[str, Any]:
    public = public_task(task_id)
    source = deepcopy(TASKS[task_id])
    started_ns = time.perf_counter_ns()
    output = RUNNERS[task_id](source)
    elapsed_ns = time.perf_counter_ns() - started_ns
    answer = source["answer_key"]
    decision_ok = output["decision"] == answer["decision"]
    metric_ok = abs(float(output["metric"]) - float(answer["metric"])) <= 0.0001
    rejected_ids = {x["id"] for x in output["rejected"]}
    rejection_ok = set(answer["rejected"]).issubset(rejected_ids)
    quality_score = (4 if decision_ok else 0) + (2 if metric_ok else 0) + (2 if rejection_ok else 0) + (2 if output.get("recommendation") else 0)
    return {
        "task_id": task_id,
        "benchmark_version": BENCHMARK_VERSION,
        "agent_id": {"A-01": 1806, "A-02": 1805, "A-03": 1807}[task_id],
        "input_sha256": public["input_sha256"],
        "server_compute_ms": round(elapsed_ns / 1_000_000, 4),
        "quality_score": quality_score,
        "quality_max": 10,
        "output": output,
    }


def score_baseline(task_id: str, output: dict[str, Any], elapsed_ms: int) -> dict[str, Any]:
    """Score a real human answer without inventing or altering its timing."""
    # Match the JSON wire representation before hashing. JavaScript serializes
    # an integral Number as 18, while Python otherwise preserves float 18.0.
    # Normalizing here makes a downloaded JSON file independently hashable.
    output = deepcopy(output)
    metric = output.get("metric")
    if isinstance(metric, float) and metric.is_integer():
        output["metric"] = int(metric)
    answer = TASKS[task_id]["answer_key"]
    decision_ok = output.get("decision") == answer["decision"]
    try:
        metric_ok = abs(float(output.get("metric")) - float(answer["metric"])) <= 0.0001
    except (TypeError, ValueError):
        metric_ok = False
    rejected = {str(value) for value in output.get("rejected", [])}
    rejection_ok = set(answer["rejected"]).issubset(rejected)
    recommendation_ok = len(str(output.get("recommendation", "")).strip()) >= 20
    quality_score = (4 if decision_ok else 0) + (2 if metric_ok else 0) + (2 if rejection_ok else 0) + (2 if recommendation_ok else 0)
    return {
        "task_id": task_id,
        "benchmark_version": BENCHMARK_VERSION,
        "input_sha256": public_task(task_id)["input_sha256"],
        "elapsed_ms": elapsed_ms,
        "timing_source": "browser-performance-timer; self-attested human run",
        "quality_score": quality_score,
        "quality_max": 10,
        "output_sha256": hashlib.sha256(_canonical_json(output).encode()).hexdigest(),
        "output": output,
    }
