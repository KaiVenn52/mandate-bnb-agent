"""A small, self-hosted provider worker for real BSC Testnet execution.

This is intentionally separate from ``backend.app.main``.  MANDATE's public
gateway never owns a signer; a provider runs this service with its own wallet,
publishes the resulting capability document, and can be independently hired.

The worker is safe-by-default:
* no private key means every signing/execution route is unavailable;
* an asset target and calldata must be explicitly configured;
* every call is bounded by one category, one target allowlist and one value cap;
* ERC-8183 submission is performed only for a funded job assigned to this
  provider wallet;
* capability receipts are the actual successful transaction hashes observed by
  this worker, never generated placeholders.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from ipaddress import ip_address
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from web3 import Web3


CHAIN_ID = 97
COMMERCE_ADDRESS = os.getenv(
    "PROVIDER_COMMERCE_ADDRESS", "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE"
)
U_TOKEN_ADDRESS = os.getenv(
    "PROVIDER_U_TOKEN_ADDRESS", "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565"
)
RPC_URL = os.getenv("PROVIDER_RPC_URL", "https://data-seed-prebsc-1-s1.bnbchain.org:8545")
PRIVATE_KEY = os.getenv("MANDATE_PROVIDER_PRIVATE_KEY", "").strip()
PUBLIC_BASE_URL = (
    os.getenv("PROVIDER_PUBLIC_BASE_URL", "").strip()
    or os.getenv("RENDER_EXTERNAL_URL", "").strip()
).rstrip("/")
CATEGORY = os.getenv("PROVIDER_CATEGORY", "yield").strip().lower()
PROVIDER_NAME = os.getenv("PROVIDER_NAME", f"MANDATE {CATEGORY.title()} Provider").strip()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
RECEIPTS_FILE = Path(os.getenv("PROVIDER_RECEIPTS_FILE", ".provider-receipts.json"))
DELIVERABLES_FILE = Path(os.getenv("PROVIDER_DELIVERABLES_FILE", ".provider-deliverables.json"))
TRACK_RECORD_FILE = Path(os.getenv("PROVIDER_TRACK_RECORD_FILE", "")).expanduser() if os.getenv("PROVIDER_TRACK_RECORD_FILE") else None
ASSET_TARGET = os.getenv("PROVIDER_ASSET_TO", "").strip()
ASSET_DATA = os.getenv("PROVIDER_ASSET_DATA", "").strip()
ASSET_VALUE_WEI = os.getenv("PROVIDER_ASSET_VALUE_WEI", "0").strip()
MAX_VALUE_WEI = os.getenv("PROVIDER_MAX_VALUE_WEI", "1").strip()

CATEGORIES = {"rebalancing", "grid", "yield", "health"}
ACTION_BY_CATEGORY = {
    "rebalancing": "execute-bounded-lp-rebalance",
    "grid": "execute-bounded-grid-swap",
    "yield": "execute-bounded-yield-route",
    "health": "execute-bounded-health-intervention",
}

COMMERCE_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "jobId", "type": "uint256"},
            {"internalType": "bytes32", "name": "deliverable", "type": "bytes32"},
            {"internalType": "bytes", "name": "optParams", "type": "bytes"},
        ],
        "name": "submit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "jobId", "type": "uint256"}],
        "name": "jobs",
        "outputs": [
            {"internalType": "uint256", "name": "id", "type": "uint256"},
            {"internalType": "address", "name": "client", "type": "address"},
            {"internalType": "address", "name": "provider", "type": "address"},
            {"internalType": "address", "name": "evaluator", "type": "address"},
            {"internalType": "string", "name": "description", "type": "string"},
            {"internalType": "uint256", "name": "budget", "type": "uint256"},
            {"internalType": "uint256", "name": "expiredAt", "type": "uint256"},
            {"internalType": "uint8", "name": "status", "type": "uint8"},
            {"internalType": "address", "name": "hook", "type": "address"},
            {"internalType": "uint256", "name": "submittedAt", "type": "uint256"},
            {"internalType": "bytes32", "name": "deliverable", "type": "bytes32"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _valid_public_https(value: str) -> bool:
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or not host or parsed.username or parsed.password or host == "localhost" or host.endswith(".local"):
        return False
    try:
        address = ip_address(host)
    except ValueError:
        return True
    return not (address.is_private or address.is_loopback or address.is_link_local or address.is_multicast or address.is_reserved or address.is_unspecified)


def _read_json(path: Path, default: Any) -> Any:
    state_key = _database_state_key(path)
    if DATABASE_URL and state_key:
        try:
            import psycopg

            with psycopg.connect(DATABASE_URL) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "CREATE TABLE IF NOT EXISTS mandate_provider_state "
                        "(key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
                    )
                    cursor.execute("SELECT value FROM mandate_provider_state WHERE key = %s", (state_key,))
                    row = cursor.fetchone()
                    return row[0] if row else default
        except Exception as exc:
            raise RuntimeError("Provider durable state database is unavailable.") from exc
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, ValueError):
        return default


def _write_json(path: Path, value: Any) -> None:
    state_key = _database_state_key(path)
    if DATABASE_URL and state_key:
        try:
            import psycopg
            from psycopg.types.json import Jsonb

            with psycopg.connect(DATABASE_URL) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "CREATE TABLE IF NOT EXISTS mandate_provider_state "
                        "(key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
                    )
                    cursor.execute(
                        "INSERT INTO mandate_provider_state (key, value, updated_at) VALUES (%s, %s, NOW()) "
                        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
                        (state_key, Jsonb(value)),
                    )
            return
        except Exception as exc:
            raise RuntimeError("Provider durable state database is unavailable.") from exc
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(temporary, path)


def _database_state_key(path: Path) -> str | None:
    if path == RECEIPTS_FILE:
        return f"{CATEGORY}:receipts"
    if path == DELIVERABLES_FILE:
        return f"{CATEGORY}:deliverables"
    return None


def _receipt_hashes() -> list[str]:
    raw = _read_json(RECEIPTS_FILE, [])
    if not isinstance(raw, list):
        return []
    seen: set[str] = set()
    values: list[str] = []
    for item in raw:
        value = item.get("hash") if isinstance(item, dict) else item
        if isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{64}", value):
            key = value.lower()
            if key not in seen:
                seen.add(key)
                values.append(value)
    return values


def _remember_receipt(tx_hash: str, *, kind: str = "execution") -> None:
    values = _read_json(RECEIPTS_FILE, [])
    if not isinstance(values, list):
        values = []
    existing = {item.get("hash", "").lower() for item in values if isinstance(item, dict)}
    if tx_hash.lower() not in existing:
        values.append({"hash": tx_hash, "kind": kind, "recorded_at_utc": _now()})
        _write_json(RECEIPTS_FILE, values)


def _account() -> Any:
    if not PRIVATE_KEY:
        raise HTTPException(503, "Provider signer is not configured. Set MANDATE_PROVIDER_PRIVATE_KEY on the provider worker.")
    try:
        return Account.from_key(PRIVATE_KEY)
    except Exception as exc:  # pragma: no cover - provider configuration failure
        raise HTTPException(503, "Provider signer configuration is invalid.") from exc


def _w3() -> Web3:
    client = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 20}))
    if not client.is_connected():
        raise HTTPException(503, "Provider RPC is unavailable.")
    return client


def _base_url() -> str:
    if not _valid_public_https(PUBLIC_BASE_URL):
        raise HTTPException(503, "Provider public base URL must be a public HTTPS origin.")
    return PUBLIC_BASE_URL


def _scope() -> dict[str, Any]:
    if CATEGORY not in CATEGORIES:
        raise HTTPException(503, "PROVIDER_CATEGORY must be rebalancing, grid, yield or health.")
    try:
        max_value = int(MAX_VALUE_WEI)
    except ValueError as exc:
        raise HTTPException(503, "PROVIDER_MAX_VALUE_WEI must be an integer.") from exc
    if max_value <= 0:
        raise HTTPException(503, "PROVIDER_MAX_VALUE_WEI must be positive.")
    allowlist = [Web3.to_checksum_address(COMMERCE_ADDRESS)]
    if ASSET_TARGET:
        if not Web3.is_address(ASSET_TARGET):
            raise HTTPException(503, "PROVIDER_ASSET_TO is not a valid EVM address.")
        allowlist.append(Web3.to_checksum_address(ASSET_TARGET))
    return {
        "category": CATEGORY,
        "chain_id": CHAIN_ID,
        "allowed_actions": [ACTION_BY_CATEGORY[CATEGORY]],
        "contract_allowlist": list(dict.fromkeys(allowlist)),
        "max_value_wei": str(max_value),
    }


def _track_record() -> dict[str, Any] | None:
    if TRACK_RECORD_FILE is None:
        return None
    value = _read_json(TRACK_RECORD_FILE, None)
    return value if isinstance(value, dict) else None


def _sign_text(value: str) -> str:
    account = _account()
    return "0x" + account.sign_message(encode_defunct(text=value)).signature.hex().removeprefix("0x")


def _hex0x(value: Any) -> str:
    """Return Web3/HexBytes values in the canonical EVM 0x-prefixed form."""

    encoded = value.hex() if hasattr(value, "hex") else str(value)
    return "0x" + encoded.removeprefix("0x")


def _provider_address() -> str:
    return _account().address


def _job(w3: Web3, job_id: int) -> tuple[Any, ...]:
    contract = w3.eth.contract(address=Web3.to_checksum_address(COMMERCE_ADDRESS), abi=COMMERCE_ABI)
    try:
        result = contract.functions.jobs(job_id).call()
    except Exception as exc:
        raise HTTPException(502, f"Unable to read ERC-8183 job #{job_id}.") from exc
    if not isinstance(result, (tuple, list)) or len(result) < 11:
        raise HTTPException(502, "AgenticCommerce returned an unexpected job shape.")
    return tuple(result)


def _send_transaction(w3: Web3, to: str, data: str, value: int = 0) -> str:
    account = _account()
    if not Web3.is_address(to):
        raise HTTPException(503, "Provider transaction target is not a valid EVM address.")
    if not isinstance(data, str) or not re.fullmatch(r"0x(?:[0-9a-fA-F]{2})+", data):
        raise HTTPException(503, "Provider asset calldata must be non-empty hex.")
    try:
        value_limit = int(MAX_VALUE_WEI)
    except ValueError as exc:
        raise HTTPException(503, "PROVIDER_MAX_VALUE_WEI must be an integer.") from exc
    if value < 0 or value > value_limit:
        raise HTTPException(503, "Provider transaction value exceeds its configured ceiling.")
    target = Web3.to_checksum_address(to)
    nonce = w3.eth.get_transaction_count(account.address, "pending")
    tx: dict[str, Any] = {
        "from": account.address,
        "to": target,
        "value": value,
        "data": data,
        "nonce": nonce,
        "chainId": CHAIN_ID,
        "gasPrice": w3.eth.gas_price,
    }
    try:
        tx["gas"] = w3.eth.estimate_gas(tx)
    except Exception:
        tx["gas"] = 300_000
    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
    raw = getattr(signed, "raw_transaction", getattr(signed, "rawTransaction", None))
    if raw is None:
        raise HTTPException(503, "Provider SDK did not return a signed transaction.")
    try:
        tx_hash = w3.eth.send_raw_transaction(raw)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    except Exception as exc:
        raise HTTPException(502, "Provider transaction could not be broadcast or confirmed.") from exc
    if receipt.get("status") != 1:
        raise HTTPException(502, "Provider transaction reverted on BSC Testnet.")
    return _hex0x(tx_hash)


def send_configured_asset(*, kind: str = "bootstrap") -> str:
    """Send the explicitly configured bounded asset call and persist its hash.

    The CLI uses this before ERC-8004 onboarding so the capability document can
    list a real receipt. It never invents calldata or chooses a protocol target.
    """

    if not ASSET_TARGET or not ASSET_DATA:
        raise RuntimeError("Set PROVIDER_ASSET_TO and PROVIDER_ASSET_DATA before bootstrapping.")
    try:
        value = int(ASSET_VALUE_WEI or "0")
    except ValueError as exc:
        raise RuntimeError("PROVIDER_ASSET_VALUE_WEI must be an integer.") from exc
    client = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 20}))
    if not client.is_connected():
        raise RuntimeError("Provider RPC is unavailable.")
    tx_hash = _send_transaction(client, ASSET_TARGET, ASSET_DATA, value)
    _remember_receipt(tx_hash, kind=kind)
    return tx_hash


def _load_manifest(job_id: int, mandate_digest: str, action: str, request_nonce: str) -> dict[str, Any] | None:
    existing = _read_json(DELIVERABLES_FILE, {})
    value = existing.get(str(job_id)) if isinstance(existing, dict) else None
    if not isinstance(value, dict):
        return None
    if value.get("mandate_digest") != mandate_digest or value.get("action") != action or value.get("request_nonce") != request_nonce:
        raise HTTPException(409, "This job already has a deliverable bound to different execution terms.")
    tx_hash = value.get("execution_transaction_hash")
    if not isinstance(tx_hash, str) or not re.fullmatch(r"0x[0-9a-fA-F]{64}", tx_hash):
        raise HTTPException(409, "The saved provider deliverable has no valid execution transaction hash.")
    return value


def _manifest(job_id: int, mandate_digest: str, action: str, request_nonce: str, execution_tx_hash: str) -> dict[str, Any]:
    existing_manifest = _load_manifest(job_id, mandate_digest, action, request_nonce)
    if existing_manifest is not None:
        return existing_manifest
    existing = _read_json(DELIVERABLES_FILE, {})
    manifest = {
        "schema": "mandate.provider-deliverable.v1",
        "version": 1,
        "job_id": job_id,
        "chain_id": CHAIN_ID,
        "category": CATEGORY,
        "provider_address": _provider_address(),
        "mandate_digest": mandate_digest,
        "action": action,
        "request_nonce": request_nonce,
        "execution_transaction_hash": execution_tx_hash,
        "decision": "bounded-testnet-action-completed",
        "generated_at_utc": _now(),
        "limitations": [
            "This receipt covers one provider-owned BSC Testnet call inside the declared allowlist.",
            "It is not a profitability guarantee or a mainnet authorization.",
        ],
    }
    if not isinstance(existing, dict):
        existing = {}
    existing[str(job_id)] = manifest
    _write_json(DELIVERABLES_FILE, existing)
    return manifest


def _submit_job(w3: Web3, job_id: int, manifest: dict[str, Any]) -> tuple[str, str, str]:
    job = _job(w3, job_id)
    provider = str(job[2])
    status = int(job[7])
    if provider.lower() != _provider_address().lower():
        raise HTTPException(403, "This funded ERC-8183 job is assigned to a different provider wallet.")
    if status != 1:
        if status in {2, 3}:
            raise HTTPException(409, "This ERC-8183 job already has a submitted or completed deliverable.")
        raise HTTPException(409, "The ERC-8183 job is not funded yet.")
    deliverable_url = f"{_base_url()}/mandate/deliverables/{job_id}.json"
    deliverable_hash = _hex0x(Web3.keccak(text=_canonical(manifest)))
    opt_params = json.dumps({"deliverable_url": deliverable_url, "provider_service": PROVIDER_NAME}, separators=(",", ":")).encode()
    contract = w3.eth.contract(address=Web3.to_checksum_address(COMMERCE_ADDRESS), abi=COMMERCE_ABI)
    account = _account()
    nonce = w3.eth.get_transaction_count(account.address, "pending")
    tx = contract.functions.submit(job_id, bytes.fromhex(deliverable_hash.removeprefix("0x")), opt_params).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": CHAIN_ID,
        "gasPrice": w3.eth.gas_price,
    })
    try:
        tx["gas"] = w3.eth.estimate_gas(tx)
    except Exception:
        tx["gas"] = 300_000
    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
    raw = getattr(signed, "raw_transaction", getattr(signed, "rawTransaction", None))
    if raw is None:
        raise HTTPException(503, "Provider SDK did not return a signed Commerce transaction.")
    try:
        tx_hash = w3.eth.send_raw_transaction(raw)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    except Exception as exc:
        raise HTTPException(502, "Provider Commerce submission could not be broadcast or confirmed.") from exc
    if receipt.get("status") != 1:
        raise HTTPException(502, "Provider Commerce submission reverted on BSC Testnet.")
    normalized_tx_hash = _hex0x(tx_hash)
    _remember_receipt(normalized_tx_hash, kind="erc8183-submit")
    return normalized_tx_hash, deliverable_hash, deliverable_url


def _execute(job_id: int, mandate_digest: str, request_nonce: str, *, protocol: str) -> dict[str, Any]:
    if not isinstance(job_id, int) or job_id <= 0 or not isinstance(mandate_digest, str) or not mandate_digest.startswith("0x") or len(mandate_digest) != 66:
        raise HTTPException(422, "Execution requires a positive job ID and a bytes32 mandate digest.")
    if CATEGORY not in CATEGORIES:
        raise HTTPException(503, "Provider category is not configured.")
    if not ASSET_TARGET or not ASSET_DATA:
        raise HTTPException(503, "Provider asset execution is not configured; set PROVIDER_ASSET_TO and PROVIDER_ASSET_DATA first.")
    try:
        value = int(ASSET_VALUE_WEI or "0")
    except ValueError as exc:
        raise HTTPException(503, "PROVIDER_ASSET_VALUE_WEI must be an integer.") from exc
    key = str(job_id)
    with _INFLIGHT_LOCK:
        if key in _INFLIGHT:
            raise HTTPException(409, "Execution for this ERC-8183 job is already in progress.")
        _INFLIGHT.add(key)
    try:
        w3 = _w3()
        # Re-read the job after taking the per-job lock and before spending gas.
        # This prevents both arbitrary relay use and duplicate asset actions.
        job = _job(w3, job_id)
        if str(job[2]).lower() != _provider_address().lower():
            raise HTTPException(403, "The funded job is not assigned to this provider wallet.")
        if int(job[7]) != 1:
            raise HTTPException(409, "The ERC-8183 job must be funded and awaiting delivery.")
        action = ACTION_BY_CATEGORY[CATEGORY]
        existing_manifest = _load_manifest(job_id, mandate_digest, action, request_nonce)
        asset_hash = str(existing_manifest["execution_transaction_hash"]) if existing_manifest else send_configured_asset(kind=f"{CATEGORY}-execution")
        manifest = _manifest(job_id, mandate_digest, action, request_nonce, asset_hash)
        commerce_hash, deliverable_hash, deliverable_url = _submit_job(w3, job_id, manifest)
        scope = _scope()
        unsigned: dict[str, Any] = {
            "schema": "mandate.provider-execution-receipt.v1",
            "version": 1,
            "accepted": True,
            "chain_id": CHAIN_ID,
            "job_id": str(job_id),
            "category": CATEGORY,
            "action": action,
            "mandate_digest": mandate_digest,
            "request_nonce": request_nonce,
            "provider_address": _provider_address(),
            "transaction_hash": asset_hash,
            "transaction_to": Web3.to_checksum_address(ASSET_TARGET),
            "executed_at_utc": _now(),
            "execution_scope": scope,
            "deliverable_hash": deliverable_hash,
            "deliverable_url": deliverable_url,
            "commerce_submission": {
                "transaction_hash": commerce_hash,
                "deliverable_hash": deliverable_hash,
                "deliverable_url": deliverable_url,
            },
            "protocol": protocol,
            "service_endpoint": f"{_base_url()}/mandate/execute",
        }
        receipt_digest = _hex0x(Web3.keccak(text=_canonical(unsigned)))
        return {**unsigned, "receipt_digest": receipt_digest, "signature": _sign_text(receipt_digest)}
    finally:
        with _INFLIGHT_LOCK:
            _INFLIGHT.discard(key)


def _schedule_funded_delivery(job_id: int) -> None:
    key = str(job_id)

    def worker() -> None:
        try:
            w3 = _w3()
            job = _job(w3, job_id)
            if int(job[7]) == 1 and str(job[2]).lower() == _provider_address().lower():
                # The official A2A notification path is a real delivery path:
                # derive a stable digest from the immutable onchain brief, run
                # the configured bounded action, then submit its manifest.
                mandate_digest = _hex0x(Web3.keccak(text=str(job[4])))
                _execute(job_id, mandate_digest, f"notify-{job_id}", protocol="a2a")
        except Exception:
            # The browser can poll and retry through the explicit execution route;
            # never turn a background failure into a false accepted receipt.
            pass

    threading.Thread(target=worker, name=f"mandate-delivery-{key}", daemon=True).start()


def _a2a_result(request_id: Any, data: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"parts": [{"kind": "data", "data": data}]}}


def _a2a_data(payload: dict[str, Any]) -> dict[str, Any]:
    params = payload.get("params") if isinstance(payload.get("params"), dict) else {}
    message = params.get("message") if isinstance(params.get("message"), dict) else {}
    parts = message.get("parts") if isinstance(message.get("parts"), list) else []
    for part in parts:
        if not isinstance(part, dict) or part.get("kind") not in {"data", "json"}:
            continue
        data = part.get("data")
        if isinstance(data, dict):
            return data
        if isinstance(data, str):
            try:
                decoded = json.loads(data)
            except ValueError:
                continue
            if isinstance(decoded, dict):
                return decoded
    raise HTTPException(400, "A2A message did not contain a JSON data part.")


def _negotiate(data: dict[str, Any]) -> dict[str, Any]:
    negotiation = data.get("negotiation") if isinstance(data.get("negotiation"), dict) else data
    task = negotiation.get("task_description")
    terms = negotiation.get("terms")
    if not isinstance(task, str) or not isinstance(terms, dict) or not isinstance(terms.get("deliverables"), str) or not isinstance(terms.get("quality_standards"), str):
        raise HTTPException(422, "A2A negotiation requires task_description and quality_standards.")
    request_hash = _hex0x(Web3.keccak(text=_canonical(negotiation)))
    supplied_hash = data.get("request_hash")
    if supplied_hash and str(supplied_hash).lower() != request_hash.lower():
        raise HTTPException(422, "A2A request_hash does not match the request terms.")
    now = int(time.time())
    expiry = now + 900
    response_terms: dict[str, Any] = {
        "deliverables": terms["deliverables"],
        "quality_standards": terms["quality_standards"],
        "price": "100000000000000000",
        "currency": U_TOKEN_ADDRESS,
        "evaluation_required": True,
        "evaluator_type": "uma_oov3",
    }
    if isinstance(terms.get("success_criteria"), list):
        response_terms["success_criteria"] = terms["success_criteria"]
    response = {
        "accepted": True,
        "terms": response_terms,
        "estimated_completion_seconds": 180,
        "quote_expires_at": expiry,
        "negotiated_at": now,
    }
    response_hash = _hex0x(Web3.keccak(text=_canonical(response)))
    signable = {
        "version": 1,
        "negotiated_at": now,
        "task": task.replace("[", "(").replace("]", ")"),
        "terms": {
            "deliverables": terms["deliverables"].replace("[", "(").replace("]", ")"),
            "quality_standards": terms["quality_standards"].replace("[", "(").replace("]", ")"),
        },
        "price": response_terms["price"],
        "currency": response_terms["currency"],
        "quote_expires_at": expiry,
        "chain_id": CHAIN_ID,
        "verifying_contract": Web3.to_checksum_address(COMMERCE_ADDRESS),
    }
    if response_terms.get("success_criteria"):
        signable["terms"]["success_criteria"] = [str(item).replace("[", "(").replace("]", ")") for item in response_terms["success_criteria"]]
    negotiation_hash = _hex0x(Web3.keccak(text=_canonical(signable)))
    return {
        "request": negotiation,
        "request_hash": request_hash,
        "response": response,
        "response_hash": response_hash,
        "negotiation_hash": negotiation_hash,
        "provider_sig": _sign_text(negotiation_hash),
        "provider_address": _provider_address(),
        "chain_id": CHAIN_ID,
        "verifying_contract": Web3.to_checksum_address(COMMERCE_ADDRESS),
    }


app = FastAPI(title="MANDATE Independent Provider Worker", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)
_INFLIGHT: set[str] = set()
_INFLIGHT_LOCK = threading.Lock()


@app.get("/health")
def health() -> dict[str, Any]:
    # Render uses this route as a liveness probe. It must only report whether
    # the HTTP process is alive; signer, database and RPC readiness belong to
    # the separate readiness route below.
    provider_address: str | None = None
    signer_status = "missing"
    if PRIVATE_KEY:
        try:
            provider_address = Account.from_key(PRIVATE_KEY).address
            signer_status = "ready"
        except Exception:
            signer_status = "invalid"
    return {
        "ok": True,
        "service": "mandate-independent-provider",
        "category": CATEGORY,
        "chain_id": CHAIN_ID,
        "provider_address": provider_address,
        "signer_configured": bool(PRIVATE_KEY),
        "signer_status": signer_status,
        "asset_execution_configured": bool(ASSET_TARGET and ASSET_DATA),
        "durable_state_configured": bool(DATABASE_URL),
        "note": "Liveness only. Use /ready for signer, durable state and RPC readiness.",
    }


@app.get("/ready")
def ready() -> dict[str, Any]:
    """Fail closed unless every autonomous-execution dependency is usable."""
    provider_address = _provider_address()
    _base_url()
    scope = _scope()
    client = _w3()
    try:
        receipt_count = len(_receipt_hashes())
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    return {
        "ok": True,
        "service": "mandate-independent-provider",
        "provider_address": provider_address,
        "category": CATEGORY,
        "chain_id": CHAIN_ID,
        "rpc_connected": client.is_connected(),
        "asset_execution_configured": bool(ASSET_TARGET and ASSET_DATA),
        "durable_state_available": True,
        "execution_receipt_count": receipt_count,
        "execution_scope": scope,
    }


@app.get("/.well-known/agent-card.json")
def agent_card() -> dict[str, Any]:
    base = _base_url()
    action = ACTION_BY_CATEGORY.get(CATEGORY, "execute-bounded-testnet-action")
    execution_skills = []
    if ASSET_TARGET and ASSET_DATA:
        execution_skills = [
            {"id": "notify_funded", "name": "Funded job notification", "description": "Executes the configured bounded action and submits delivery after funding."},
            {"id": "execute-bounded-testnet-action", "name": action, "description": "Executes one configured provider-owned BSC Testnet call."},
        ]
    return {
        "name": PROVIDER_NAME,
        "description": f"Independent {CATEGORY} provider with bounded BSC Testnet execution and ERC-8183 delivery receipts.",
        "url": f"{base}/a2a",
        "version": "1.0.0",
        "supportedInterfaces": [{"url": f"{base}/a2a", "protocolBinding": "JSONRPC"}],
        "skills": [
            {"id": "negotiate", "name": "ERC-8183 negotiation", "description": "Signs a bounded quote for the exact mandate."},
            *execution_skills,
        ],
    }


@app.get("/mandate/capability")
def capability() -> dict[str, Any]:
    address = _provider_address()
    scope = _scope()
    if not ASSET_TARGET or not ASSET_DATA:
        # Return a truthful document that the onboarding page will reject until
        # the provider explicitly configures a bounded asset call.
        asset_enabled = False
    else:
        asset_enabled = True
    result: dict[str, Any] = {
        "schema": "mandate.provider-service.v1",
        "version": 1,
        "chain_id": CHAIN_ID,
        "provider_address": address,
        "service_protocol": "A2A",
        "categories": [CATEGORY],
        "acceptance_endpoint": f"{_base_url()}/mandate/accept",
        "execution_endpoint": f"{_base_url()}/mandate/execute",
        "capabilities": {
            "bounded_service_escrow": True,
            "bounded_testnet_execution": asset_enabled,
            "asset_transactions": asset_enabled,
        },
        "execution_scope": scope,
        "execution_receipts": _receipt_hashes(),
    }
    if CATEGORY == "grid":
        result["track_record"] = _track_record()
    return result


@app.post("/mandate/accept")
def accept(payload: dict[str, Any]) -> dict[str, Any]:
    address = _provider_address()
    if payload.get("schema") != "mandate.provider-acceptance-request.v1" or payload.get("chain_id") != CHAIN_ID or payload.get("candidate", {}).get("provider_wallet", "").lower() != address.lower():
        raise HTTPException(422, "Acceptance request is not bound to this provider wallet and BSC Testnet.")
    digest = payload.get("mandate_digest")
    if not isinstance(digest, str) or len(digest) != 66 or not digest.startswith("0x"):
        raise HTTPException(422, "Acceptance request must contain a bytes32 mandate_digest.")
    expires = int(time.time()) + 900
    return {
        "schema": "mandate.provider-acceptance.v1",
        "accepted": True,
        "chain_id": CHAIN_ID,
        "token_id": str(payload["candidate"]["token_id"]),
        "provider_address": address,
        "mandate_digest": digest,
        "signature": _sign_text(digest),
        "accepted_at_utc": _now(),
        "expires_at_utc": datetime.fromtimestamp(expires, timezone.utc).isoformat().replace("+00:00", "Z"),
        "protocol": "mandate",
        "service_endpoint": f"{_base_url()}/mandate/accept",
    }


@app.get("/mandate/deliverables/{job_id}.json")
def deliverable(job_id: int) -> dict[str, Any]:
    deliverables = _read_json(DELIVERABLES_FILE, {})
    value = deliverables.get(str(job_id)) if isinstance(deliverables, dict) else None
    if not isinstance(value, dict):
        raise HTTPException(404, "The provider has not produced a deliverable for this job.")
    return value


@app.post("/mandate/execute")
def execute(payload: dict[str, Any]) -> dict[str, Any]:
    job_id = payload.get("job_id")
    try:
        normalized_job = int(job_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(422, "job_id must be an integer.") from exc
    provider = payload.get("provider_address")
    if not isinstance(provider, str) or provider.lower() != _provider_address().lower():
        raise HTTPException(403, "Execution request provider does not match this worker wallet.")
    if payload.get("category") != CATEGORY or payload.get("action") != ACTION_BY_CATEGORY[CATEGORY]:
        raise HTTPException(422, "Execution request category/action is outside this worker's scope.")
    return _execute(normalized_job, str(payload.get("mandate_digest", "")), str(payload.get("request_nonce", "")), protocol="mandate")


@app.post("/a2a")
def a2a(payload: dict[str, Any]) -> dict[str, Any]:
    request_id = payload.get("id")
    data = _a2a_data(payload)
    skill = data.get("skill")
    if skill == "negotiate":
        return _a2a_result(request_id, _negotiate(data))
    if skill == "notify_funded":
        if not ASSET_TARGET or not ASSET_DATA:
            raise HTTPException(503, "Provider asset execution is not configured; funded delivery was not accepted.")
        try:
            job_id = int(data.get("job_id"))
        except (TypeError, ValueError) as exc:
            raise HTTPException(422, "notify_funded requires an integer job_id.") from exc
        _schedule_funded_delivery(job_id)
        return _a2a_result(request_id, {"status": "accepted", "job_id": job_id, "provider_address": _provider_address()})
    if skill == "execute-bounded-testnet-action":
        try:
            job_id = int(data.get("job_id"))
        except (TypeError, ValueError) as exc:
            raise HTTPException(422, "Execution requires an integer job_id.") from exc
        if data.get("provider_address", "").lower() != _provider_address().lower() or data.get("category") != CATEGORY or data.get("action") != ACTION_BY_CATEGORY[CATEGORY]:
            raise HTTPException(403, "A2A execution request is outside this worker's provider scope.")
        receipt = _execute(job_id, str(data.get("mandate_digest", "")), str(data.get("request_nonce", "")), protocol="a2a")
        return _a2a_result(request_id, receipt)
    raise HTTPException(422, "Unsupported A2A skill.")
