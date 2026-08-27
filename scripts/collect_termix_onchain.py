from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from web3 import Web3


ROOT = Path(__file__).resolve().parents[1]
RPC_URLS = [
    "https://bsc-testnet-rpc.publicnode.com",
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
]
COMMERCE = Web3.to_checksum_address("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE")
ROUTER = Web3.to_checksum_address("0xD7d36D66d2F1B608A0F943f722D27e3744f66F25")
CLIENT = "0xD30BbB80c863c9B94622EF92337AaD65148D2EC3"
PROVIDER = "0x34ABe1790E6d67E25c7616799C2C6B7336932c7e"
JOBS = {
    "A-01": {
        "job_id": 642,
        "category": "yield",
        "agent_id": 1806,
        "create_tx": "0x65075a013ca176bf1e4c6abedd4de61bf94140ad227ca9cd100c298aa98b19df",
    },
    "A-02": {
        "job_id": 644,
        "category": "grid",
        "agent_id": 1805,
        "create_tx": "0x049bc0cad3ea587460b2e821d2919ad03876ab7903bee9904d611df126496942",
        "submit_tx": "0x0a6d266e0b1d455ab9405f502115350426a92b139ad25fb8d50cafeadc5f5cf3",
        "settle_tx": "0x110a45c0e374ab9297143a0dd428850141e29732bca5c7f678dbe0af9d88f1a9",
    },
    "A-03": {
        "job_id": 666,
        "category": "health",
        "agent_id": 1807,
        "create_tx": "0x368381e2f5989fc08dbef7907913029a16e199a59d8501e5c17b84b95ccec1c2",
        "settle_tx": "0xc939266cea840943359333fe83d99db50c91799bc9c64e2acbef297a083a13d1",
    },
}

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


def main() -> None:
    web3 = next(
        (candidate for url in RPC_URLS if (candidate := Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 30}))).is_connected()),
        None,
    )
    if web3 is None:
        raise RuntimeError("BSC Testnet RPC is unavailable")
    contract = web3.eth.contract(address=COMMERCE, abi=GET_JOB_ABI)
    hires = []
    for task_id, config in JOBS.items():
        job = contract.functions.getJob(config["job_id"]).call()
        description = json.loads(job[4])
        if job[1].lower() != CLIENT.lower() or job[2].lower() != PROVIDER.lower():
            raise RuntimeError(f"Job #{config['job_id']} does not use the expected independent wallets")
        if job[7] != 3 or job[5] != 100_000_000_000_000_000 or description.get("category") != config["category"]:
            raise RuntimeError(f"Job #{config['job_id']} is not a completed matching-category 0.1 U hire")
        transactions = {
            key.removesuffix("_tx"): {
                "transaction_hash": value,
                "explorer_url": f"https://testnet.bscscan.com/tx/{value}",
            }
            for key, value in config.items() if key.endswith("_tx")
        }
        hires.append({
            "task_id": task_id,
            "job_id": config["job_id"],
            "agent_id": config["agent_id"],
            "category": config["category"],
            "chain_id": 97,
            "client": job[1],
            "provider": job[2],
            "budget_test_u": "0.1",
            "budget_wei": job[5],
            "status": "COMPLETED",
            "deliverable": "0x" + job[10].hex(),
            "submitted_at_unix": job[9],
            "deliverable_url": f"https://mandate-bnb-agent.vercel.app/api/benchmarks/{task_id}/hire-deliverable/{config['job_id']}",
            "known_transactions": transactions,
            "gas_cost_note": "Lifecycle gas was paid in valueless BSC Testnet tBNB; complete per-job gas aggregation was not retained and no fiat conversion is claimed.",
        })

    artifact = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "network": "BSC Testnet",
        "chain_id": 97,
        "commerce_contract": COMMERCE,
        "router_contract": ROUTER,
        "client": CLIENT,
        "provider": PROVIDER,
        "qualification": "3 / 3 independent ERC-8183 hires completed",
        "service_cost": "0.1 test U per task; test token has no claimed fiat value",
        "hires": hires,
    }
    targets = [
        ROOT / "evidence" / "termix" / "onchain-hires.json",
        ROOT / "public" / "evidence" / "termix" / "onchain-hires.json",
    ]
    for target in targets:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"targets": [str(target) for target in targets], "jobs": [hire["job_id"] for hire in hires]}, indent=2))


if __name__ == "__main__":
    main()
