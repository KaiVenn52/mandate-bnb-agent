"""Verify that a TermiX agent run is backed by a real ERC-8183 hire."""

from __future__ import annotations

import json
import os
from typing import Any

from web3 import Web3


COMMERCE_ADDRESS = Web3.to_checksum_address("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE")
RPC_URL = os.getenv("BSC_TESTNET_RPC_URL", "https://data-seed-prebsc-1-s1.bnbchain.org:8545")
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
TASK_CATEGORIES = {"A-01": "yield", "A-02": "grid", "A-03": "health"}

GET_JOB_ABI = [{
    "type": "function",
    "name": "getJob",
    "stateMutability": "view",
    "inputs": [{"name": "jobId", "type": "uint256"}],
    "outputs": [{"name": "", "type": "tuple", "components": [
        {"name": "id", "type": "uint256"}, {"name": "client", "type": "address"},
        {"name": "provider", "type": "address"}, {"name": "evaluator", "type": "address"},
        {"name": "description", "type": "string"}, {"name": "budget", "type": "uint256"},
        {"name": "expiredAt", "type": "uint256"}, {"name": "status", "type": "uint8"},
        {"name": "hook", "type": "address"}, {"name": "submittedAt", "type": "uint256"},
        {"name": "deliverable", "type": "bytes32"},
    ]}],
}]


class HireVerificationError(RuntimeError):
    pass


def verify_hired_job(job_id: int, task_id: str) -> dict[str, Any]:
    try:
        web3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 12}))
        raw = web3.eth.contract(address=COMMERCE_ADDRESS, abi=GET_JOB_ABI).functions.getJob(job_id).call()
    except Exception as exc:
        raise HireVerificationError(f"Could not verify ERC-8183 Job #{job_id}: {exc}") from exc

    client, provider = str(raw[1]), str(raw[2])
    budget, status = int(raw[5]), int(raw[7])
    if provider.lower() == ZERO_ADDRESS or client.lower() == provider.lower():
        raise HireVerificationError("The job must assign a separate non-zero provider; self-hiring is not qualifying marketplace evidence")
    if budget <= 0 or status not in {1, 2, 3}:
        raise HireVerificationError("The job must be funded, submitted, or completed with a non-zero service budget")
    try:
        description = json.loads(raw[4])
    except (TypeError, json.JSONDecodeError) as exc:
        raise HireVerificationError("The job description is not a machine-readable MANDATE brief") from exc
    expected = TASK_CATEGORIES[task_id]
    if description.get("category") != expected:
        raise HireVerificationError(f"Job category {description.get('category')!r} does not match required task category {expected!r}")
    return {
        "chain_id": 97,
        "job_id": job_id,
        "client": client,
        "provider": provider,
        "budget_wei": budget,
        "status": status,
        "explorer_url": f"https://testnet.bscscan.com/address/{COMMERCE_ADDRESS}#readContract",
    }
