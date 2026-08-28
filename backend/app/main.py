"""MANDATE's read-only agent and evidence gateway.

The server never holds a transaction signer. ERC-8183 mutations are simulated
client-side and require the correct connected client or provider wallet.
"""

from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .benchmarks import BENCHMARK_VERSION, TASKS, public_task, run_agent, score_baseline
from .market_agents import MarketDataError, run_grid_agent, run_rebalancing_agent
from .hire_verifier import HireVerificationError, verify_hired_job
from .grid_track_record import TrackRecordDataError, run_grid_track_record
from .registry_proxy import RegistryProxyError, fetch_registry
from .rate_limit import RateLimitMiddleware
from .venus_agent import ChainReadError, run_venus_risk_agent
from .yield_agent import YieldDataError, build_yield_deliverable, run_yield_route_agent


NETWORK = os.getenv("NETWORK", "bsc-testnet")
OPERATOR_ADDRESS = os.getenv("MANDATE_OPERATOR_ADDRESS", "")
MAX_BUDGET = int(os.getenv("MANDATE_MAX_BUDGET_WEI", "1000000000000000000"))
ALLOWED_PROVIDERS = {
    address.strip().lower()
    for address in os.getenv("MANDATE_ALLOWED_PROVIDERS", "").split(",")
    if address.strip()
}
WEB_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "MANDATE_WEB_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"
    ).split(",")
    if origin.strip()
]

ERC8183_COMMERCE_ADDRESS = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE"
ERC8183_ROUTER_ADDRESS = "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25"
ERC8183_POLICY_ADDRESS = "0xd6a4217588f6b1f5657a92a3e94e6422ad771cea"

MARKETPLACE_DELIVERABLES = {
    "rebalancing": {
        "agent_id": "1804",
        "content": "RangeGuard completed a bounded LP rebalancing plan against the disclosed marketplace category fixture. Decision: NO_ACTION. No LP position was delegated and no asset transaction was attempted.",
        "evidence_mode": "controlled-category-proof",
    },
    "grid": {
        "agent_id": "1805",
        "content": "GridPilot completed the frozen BNB/USDT grid safety review. Decision: balanced-26. The higher-return turbo plan was rejected for exceeding drawdown and activity caps. No asset transaction was attempted.",
        "evidence_mode": "verified-termix-fixture",
    },
    "health": {
        "agent_id": "1807",
        "content": "LiqShield completed the frozen Venus health-factor intervention. Decision: repay-1600. Borrowing and no-action were rejected by the bounded policy. No asset transaction was attempted.",
        "evidence_mode": "verified-termix-fixture",
    },
}


class JobRequest(BaseModel):
    provider: str = Field(pattern=r"^0x[a-fA-F0-9]{40}$")
    description: str = Field(min_length=12, max_length=1200)
    budget_wei: int = Field(gt=0)
    duration_seconds: int = Field(default=3900, ge=600, le=604800)


class JobPreview(BaseModel):
    mode: str
    network: str
    provider: str
    description: str
    budget_wei: int
    expired_at: int
    lifecycle: list[str]
    broadcast: bool


class BaselineOutput(BaseModel):
    decision: str = Field(min_length=1, max_length=80)
    metric: float
    rejected: list[str] = Field(default_factory=list, max_length=10)
    recommendation: str = Field(min_length=20, max_length=1200)
    elapsed_ms: int = Field(ge=1000, le=7_200_000)


class VenusRiskRequest(BaseModel):
    account: str = Field(pattern=r"^0x[a-fA-F0-9]{40}$")
    minimum_buffer_usd: float = Field(default=1000, ge=0, le=100_000_000)


class YieldRouteRequest(BaseModel):
    asset: str = Field(default="USDT", pattern=r"^[A-Za-z0-9]{2,12}$")
    capital_usd: float = Field(gt=0, le=100_000_000)
    max_risk: str = Field(default="medium", pattern=r"^(low|medium|high)$")
    leverage_max: float = Field(default=0, ge=0, le=10)
    allowed_protocols: list[str] = Field(default_factory=list, max_length=10)
    max_actions_per_week: int = Field(default=2, ge=1, le=100)


class RebalancingRequest(BaseModel):
    capital_usd: float = Field(gt=0, le=100_000_000)
    max_rebalances_per_day: int = Field(default=2, ge=1, le=24)
    max_gas_drag_pct: float = Field(default=20, gt=0, le=100)
    target_width_pct: float = Field(default=15, ge=2, le=50)


class GridRequest(BaseModel):
    capital_usd: float = Field(gt=0, le=100_000_000)
    max_drawdown_pct: float = Field(default=5, gt=0, le=50)
    max_orders_per_day: int = Field(default=12, ge=1, le=100)
    grid_levels: int = Field(default=7, ge=3, le=24)


class HireBackedRunRequest(BaseModel):
    job_id: int = Field(gt=0)


app = FastAPI(title="MANDATE BNB Agent Gateway", version="0.1.0")
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=WEB_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def validate_policy(request: JobRequest) -> None:
    if request.budget_wei > MAX_BUDGET:
        raise HTTPException(422, "Budget exceeds the server-side mandate ceiling")
    if ALLOWED_PROVIDERS and request.provider.lower() not in ALLOWED_PROVIDERS:
        raise HTTPException(403, "Provider is not in the server-side allowlist")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "network": NETWORK,
        # "live" describes the public service, not autonomous trading authority.
        # The four endpoints are callable in production and read live BSC/market
        # data. They deliberately cannot sign or broadcast protocol transactions.
        "live": True,
        "liveData": True,
        "autonomousExecution": False,
        "executionMode": "live-read-only; transactional writes guarded",
        "sdk": "bnbagent",
        "standards": ["ERC-8004", "ERC-8183"],
        "operatorAddress": OPERATOR_ADDRESS or None,
        "agents": {
            "rebalancing": "/agents/rebalancing/run",
            "grid": "/agents/grid/run",
            "yieldRoute": "/agents/yield-route/run",
            "venusRisk": "/agents/venus-risk/run",
        },
    }


@app.get("/erc8183/deliverable/{job_id}")
def erc8183_deliverable(job_id: int) -> dict[str, Any]:
    """Canonical SDK DeliverableManifest for the controlled pilot job."""
    if job_id < 0:
        raise HTTPException(422, "job_id must be non-negative")
    return {
        "version": 1,
        "job_id": job_id,
        "chain_id": 97,
        "contracts": {
            "commerce": ERC8183_COMMERCE_ADDRESS,
            "router": ERC8183_ROUTER_ADDRESS,
            "policy": ERC8183_POLICY_ADDRESS,
        },
        "response": {
            "content": (
                "MANDATE Health Factor pilot completed against a controlled test fixture. "
                "Decision: NO_ACTION. The bounded policy correctly refused execution because "
                "no live lending position was delegated."
            ),
            "content_type": "text/plain",
        },
        "metadata": {
            "agent_id": "1807",
            "category": "health-factor-monitoring",
            "evidence_mode": "controlled-test-fixture",
            "sdk": "bnbagent-0.4.2",
        },
    }


@app.get("/erc8183/yield-deliverable/{job_id}")
def erc8183_yield_deliverable(job_id: int) -> dict[str, Any]:
    """Canonical public manifest for a YieldRoute evidence job."""
    try:
        return build_yield_deliverable(job_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.get("/erc8183/marketplace-deliverable/{category}/{job_id}")
def erc8183_marketplace_deliverable(category: str, job_id: int) -> dict[str, Any]:
    """Public deterministic deliverable used by each marketplace hire path."""
    if job_id < 0:
        raise HTTPException(422, "job_id must be non-negative")
    if category == "yield":
        return build_yield_deliverable(job_id)
    deliverable = MARKETPLACE_DELIVERABLES.get(category)
    if not deliverable:
        raise HTTPException(404, "Unknown marketplace category")
    return {
        "version": 1,
        "job_id": job_id,
        "chain_id": 97,
        "contracts": {
            "commerce": ERC8183_COMMERCE_ADDRESS,
            "router": ERC8183_ROUTER_ADDRESS,
            "policy": ERC8183_POLICY_ADDRESS,
        },
        "response": {
            "content": deliverable["content"],
            "content_type": "application/json",
        },
        "metadata": {
            "agent_id": deliverable["agent_id"],
            "category": category,
            "evidence_mode": deliverable["evidence_mode"],
            "sdk": "bnbagent-0.4.2",
        },
    }


@app.get("/benchmarks")
def benchmark_index() -> dict[str, Any]:
    return {
        "version": BENCHMARK_VERSION,
        "status": "legacy paired measurements available; new agent runs require a verified marketplace hire",
        "tasks": [public_task(task_id) for task_id in TASKS],
    }


@app.get("/registry/agents")
def registry_agents() -> dict[str, Any]:
    try:
        return fetch_registry("/agents", {"page": "1", "limit": "1", "chainId": "56"}, ttl_seconds=120)
    except RegistryProxyError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.get("/registry/agents/search")
def registry_search(q: str = Query(min_length=3, max_length=500)) -> dict[str, Any]:
    try:
        return fetch_registry("/agents/search", {"q": q, "chainId": "56", "limit": "10", "semanticWeight": "0.65"}, ttl_seconds=300)
    except RegistryProxyError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.get("/registry/agents/56/{token_id}")
def registry_agent(token_id: int) -> dict[str, Any]:
    if token_id <= 0:
        raise HTTPException(422, "Invalid ERC-8004 token ID")
    try:
        return fetch_registry(f"/agents/56/{token_id}", {}, ttl_seconds=300)
    except RegistryProxyError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.get("/benchmarks/{task_id}")
def benchmark_task(task_id: str) -> dict[str, Any]:
    if task_id not in TASKS:
        raise HTTPException(404, "Unknown benchmark task")
    return public_task(task_id)


@app.post("/benchmarks/{task_id}/agent-run")
def benchmark_agent_run(task_id: str, request: HireBackedRunRequest) -> dict[str, Any]:
    if task_id not in TASKS:
        raise HTTPException(404, "Unknown benchmark task")
    try:
        hire = verify_hired_job(request.job_id, task_id)
    except HireVerificationError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {**run_agent(task_id), "marketplace_hire": hire}


@app.get("/benchmarks/{task_id}/hire-deliverable/{job_id}")
def benchmark_hire_deliverable(task_id: str, job_id: int) -> dict[str, Any]:
    """Return the stable result that an independently hired provider anchors.

    The variable server timing is intentionally excluded so the canonical JSON
    has the same keccak256 before submission and during later reviewer checks.
    """
    if task_id not in TASKS:
        raise HTTPException(404, "Unknown benchmark task")
    try:
        hire = verify_hired_job(job_id, task_id)
    except HireVerificationError as exc:
        raise HTTPException(422, str(exc)) from exc
    result = run_agent(task_id)
    result.pop("server_compute_ms", None)
    return {
        **result,
        "marketplace_hire": hire,
        "hash_canonicalization": "recursive-key-sorted compact JSON, then keccak256(UTF-8)",
    }


@app.post("/agents/venus-risk/run")
def venus_risk_run(request: VenusRiskRequest) -> dict[str, Any]:
    """Run a read-only agent against a pinned live BNB Chain block."""
    try:
        return run_venus_risk_agent(request.account, request.minimum_buffer_usd)
    except ChainReadError as exc:
        raise HTTPException(503, f"Live BNB Chain read failed: {exc}") from exc


@app.post("/agents/yield-route/run")
def yield_route_run(request: YieldRouteRequest) -> dict[str, Any]:
    """Run a live, read-only BSC stablecoin route analysis."""
    try:
        return run_yield_route_agent(
            asset=request.asset,
            capital_usd=request.capital_usd,
            max_risk=request.max_risk,
            leverage_max=request.leverage_max,
            allowed_protocols=request.allowed_protocols,
            max_actions_per_week=request.max_actions_per_week,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except YieldDataError as exc:
        raise HTTPException(503, f"Live yield data read failed: {exc}") from exc


@app.post("/agents/rebalancing/run")
def rebalancing_run(request: RebalancingRequest) -> dict[str, Any]:
    try:
        return run_rebalancing_agent(
            capital_usd=request.capital_usd,
            max_rebalances_per_day=request.max_rebalances_per_day,
            max_gas_drag_pct=request.max_gas_drag_pct,
            target_width_pct=request.target_width_pct,
        )
    except MarketDataError as exc:
        raise HTTPException(503, f"Live PancakeSwap market read failed: {exc}") from exc


@app.post("/agents/grid/run")
def grid_run(request: GridRequest) -> dict[str, Any]:
    try:
        return run_grid_agent(
            capital_usd=request.capital_usd,
            max_drawdown_pct=request.max_drawdown_pct,
            max_orders_per_day=request.max_orders_per_day,
            grid_levels=request.grid_levels,
        )
    except MarketDataError as exc:
        raise HTTPException(503, f"Live BNB/USDT market read failed: {exc}") from exc


@app.get("/agents/grid/track-record")
def grid_track_record(days: int = Query(default=30, ge=2, le=30)) -> dict[str, Any]:
    """Return a transparent historical paper test, never a realized-PnL claim."""
    try:
        return run_grid_track_record(days)
    except TrackRecordDataError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.post("/benchmarks/{task_id}/baseline-score")
def benchmark_baseline_score(task_id: str, submission: BaselineOutput) -> dict[str, Any]:
    if task_id not in TASKS:
        raise HTTPException(404, "Unknown benchmark task")
    values = submission.model_dump() if hasattr(submission, "model_dump") else submission.dict()
    elapsed_ms = values.pop("elapsed_ms")
    return score_baseline(task_id, values, elapsed_ms)


@app.post("/jobs/preview", response_model=JobPreview)
def preview_job(request: JobRequest) -> JobPreview:
    validate_policy(request)
    return JobPreview(
        mode="wallet-signature-required",
        network=NETWORK,
        provider=request.provider,
        description=request.description,
        budget_wei=request.budget_wei,
        expired_at=int(time.time()) + request.duration_seconds,
        lifecycle=["create", "register", "set-budget", "fund"],
        broadcast=False,
    )
