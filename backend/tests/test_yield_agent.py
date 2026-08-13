import hashlib
import json
import unittest
from unittest.mock import patch

from app.yield_agent import run_yield_route_agent


POOLS = {"data": [
    {"pool": "venus", "chain": "BSC", "project": "venus-core-pool", "symbol": "USDT", "tvlUsd": 80_000_000, "apy": 2.0, "apyBase": 2.0, "apyReward": 0, "stablecoin": True, "exposure": "single", "ilRisk": "no", "poolMeta": None},
    {"pool": "lista", "chain": "BSC", "project": "lista-lending", "symbol": "USDT", "tvlUsd": 4_000_000, "apy": 5.0, "apyBase": 5.0, "apyReward": 0, "stablecoin": True, "exposure": "single", "ilRisk": "no", "poolMeta": None},
    {"pool": "pancake", "chain": "BSC", "project": "pancakeswap-amm", "symbol": "USDT-BUSD", "tvlUsd": 300_000, "apy": 9.0, "apyBase": 9.0, "apyReward": 0, "stablecoin": True, "exposure": "multi", "ilRisk": "no", "poolMeta": None},
]}
PROTOCOLS = [
    {"slug": "venus-core-pool", "tvl": 1_000_000_000, "change_7d": 1.0},
    {"slug": "lista-lending", "tvl": 700_000_000, "change_7d": 10.0},
    {"slug": "pancakeswap-amm", "tvl": 1_600_000_000, "change_7d": -1.0},
]


class YieldAgentTests(unittest.TestCase):
    def run_case(self, risk="medium", protocols=None):
        with patch("app.yield_agent._fetch_json", side_effect=[POOLS, PROTOCOLS]):
            return run_yield_route_agent("USDT", 5000, risk, 0, protocols or [], 2)

    def test_selects_highest_compliant_route(self):
        result = self.run_case()
        self.assertEqual(result["decision"]["selected_pool_id"], "lista")
        self.assertEqual(result["decision"]["estimated_gross_yield_usd_year"], 250.0)
        self.assertFalse(result["decision"]["transaction_attempted"])

    def test_low_risk_uses_higher_tvl_floor(self):
        result = self.run_case("low")
        self.assertEqual(result["decision"]["selected_pool_id"], "venus")
        self.assertIn("pool-tvl-below-risk-floor", result["rejected_routes"][0]["violations"])

    def test_protocol_allowlist_is_enforced(self):
        result = self.run_case(protocols=["Venus"])
        self.assertEqual(result["coverage"]["matching_pools"], 1)
        self.assertEqual(result["decision"]["protocol"], "Venus")

    def test_evidence_hash_covers_manifest(self):
        result = self.run_case()
        digest = result.pop("deliverable_sha256")
        canonical = json.dumps(result, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        self.assertEqual(digest, hashlib.sha256(canonical.encode()).hexdigest())


if __name__ == "__main__":
    unittest.main()
