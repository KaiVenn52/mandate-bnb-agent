"""Read-only Venus Core Pool risk agent.

The agent reads a pinned BNB Chain block and the official Venus Comptroller.
It never asks for token approvals and never sends a transaction. Its complete
input, source block and decision are hashed into a portable evidence manifest.
"""

from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any


CHAIN_ID = 56
COMPTROLLER = "0xfd36e2c2a6789db23113685031d7f16329158384"
GET_ACCOUNT_LIQUIDITY_SELECTOR = "5ec88c79"
GET_ASSETS_IN_SELECTOR = "abfceffc"
DEFAULT_RPC_URLS = (
    "https://bsc-dataseed.bnbchain.org",
    "https://bsc.publicnode.com",
)


class ChainReadError(RuntimeError):
    pass


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _rpc_urls() -> tuple[str, ...]:
    configured = tuple(
        value.strip()
        for value in os.getenv("BSC_MAINNET_RPC_URLS", "").split(",")
        if value.strip()
    )
    return configured or DEFAULT_RPC_URLS


def _rpc(method: str, params: list[Any]) -> Any:
    payload = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    ).encode()
    errors: list[str] = []
    for rpc_url in _rpc_urls():
        request = urllib.request.Request(
            rpc_url,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "MANDATE/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                body = json.loads(response.read())
            if body.get("error"):
                raise ChainReadError(str(body["error"]))
            return body["result"]
        except (OSError, ValueError, KeyError, urllib.error.URLError, ChainReadError) as exc:
            errors.append(f"{rpc_url}: {exc}")
    raise ChainReadError("; ".join(errors))


def _call_data(selector: str, account: str) -> str:
    return f"0x{selector}{account[2:].lower().rjust(64, '0')}"


def _decode_words(data: str) -> list[int]:
    raw = data[2:] if data.startswith("0x") else data
    if len(raw) % 64:
        raise ChainReadError("Malformed ABI response")
    return [int(raw[index : index + 64], 16) for index in range(0, len(raw), 64)]


def _decode_addresses(data: str) -> list[str]:
    words = _decode_words(data)
    if len(words) < 2 or words[0] != 32:
        raise ChainReadError("Malformed address array response")
    count = words[1]
    if len(words) < 2 + count:
        raise ChainReadError("Truncated address array response")
    return [f"0x{words[index] & ((1 << 160) - 1):040x}" for index in range(2, 2 + count)]


def _usd(value: int) -> str:
    return f"{value / 10**18:.2f}"


def run_venus_risk_agent(account: str, minimum_buffer_usd: float) -> dict[str, Any]:
    block_number_hex = _rpc("eth_blockNumber", [])
    block = _rpc("eth_getBlockByNumber", [block_number_hex, False])
    call = {"to": COMPTROLLER, "data": _call_data(GET_ACCOUNT_LIQUIDITY_SELECTOR, account)}
    liquidity_words = _decode_words(_rpc("eth_call", [call, block_number_hex]))
    if len(liquidity_words) != 3:
        raise ChainReadError("Unexpected getAccountLiquidity response")
    error_code, liquidity, shortfall = liquidity_words

    assets_call = {"to": COMPTROLLER, "data": _call_data(GET_ASSETS_IN_SELECTOR, account)}
    entered_markets = _decode_addresses(_rpc("eth_call", [assets_call, block_number_hex]))
    minimum_buffer_wei = int(minimum_buffer_usd * 10**18)

    if error_code:
        status, severity = "DATA_ERROR", "critical"
        recommendation = "Venus returned a non-zero protocol error. Do not automate any action."
    elif not entered_markets:
        status, severity = "NO_POSITION", "none"
        recommendation = "No Venus Core collateral markets are entered. No lending intervention is required."
    elif shortfall:
        status, severity = "LIQUIDATABLE", "critical"
        recommendation = "Liquidation shortfall detected. Repay debt or add collateral; no transaction was attempted."
    elif liquidity < minimum_buffer_wei:
        status, severity = "BUFFER_BELOW_MANDATE", "warning"
        recommendation = "The position is solvent but its liquidation buffer is below the user mandate. Review promptly."
    else:
        status, severity = "WITHIN_MANDATE", "low"
        recommendation = "The live liquidation buffer satisfies the user mandate. Continue monitoring; take no action."

    manifest: dict[str, Any] = {
        "schema": "mandate.venus-risk-evidence.v1",
        "agent": {"erc8004_id": 1807, "name": "Health Factor Sentinel"},
        "mandate": {
            "account": account,
            "minimum_liquidation_buffer_usd": minimum_buffer_usd,
            "allowed_actions": ["read", "recommend", "no-action"],
            "broadcast_allowed": False,
        },
        "source": {
            "chain": "BNB Smart Chain",
            "chain_id": CHAIN_ID,
            "protocol": "Venus Core Pool",
            "comptroller": COMPTROLLER,
            "block_number": int(block_number_hex, 16),
            "block_hash": block["hash"],
            "block_timestamp": int(block["timestamp"], 16),
            "read_method": "eth_call at pinned block",
        },
        "observation": {
            "protocol_error_code": error_code,
            "entered_market_count": len(entered_markets),
            "entered_markets": entered_markets,
            "liquidity_buffer_wei": str(liquidity),
            "liquidity_buffer_usd": _usd(liquidity),
            "shortfall_wei": str(shortfall),
            "shortfall_usd": _usd(shortfall),
        },
        "decision": {
            "status": status,
            "severity": severity,
            "recommendation": recommendation,
            "transaction_attempted": False,
        },
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    manifest["evidence_sha256"] = hashlib.sha256(_canonical_json(manifest).encode()).hexdigest()
    return manifest
