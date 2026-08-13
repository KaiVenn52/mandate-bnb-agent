import hashlib
import json
import unittest
from unittest.mock import patch

from app.venus_agent import _decode_addresses, run_venus_risk_agent


BLOCK = {"hash": "0x" + "ab" * 32, "timestamp": "0x66b7a000"}


def words(*values: int) -> str:
    return "0x" + "".join(f"{value:064x}" for value in values)


def address_array(*addresses: str) -> str:
    return words(32, len(addresses), *(int(address, 16) for address in addresses))


class VenusAgentTests(unittest.TestCase):
    account = "0x1111111111111111111111111111111111111111"
    market = "0x2222222222222222222222222222222222222222"

    def run_case(self, liquidity: int, shortfall: int, markets: tuple[str, ...], minimum: float = 1000):
        replies = ["0x64", BLOCK, words(0, liquidity, shortfall), address_array(*markets)]
        with patch("app.venus_agent._rpc", side_effect=replies):
            return run_venus_risk_agent(self.account, minimum)

    def test_no_position(self):
        result = self.run_case(0, 0, ())
        self.assertEqual(result["decision"]["status"], "NO_POSITION")
        self.assertFalse(result["decision"]["transaction_attempted"])

    def test_liquidation_shortfall_is_critical(self):
        result = self.run_case(0, 250 * 10**18, (self.market,))
        self.assertEqual(result["decision"]["status"], "LIQUIDATABLE")
        self.assertEqual(result["decision"]["severity"], "critical")

    def test_solvent_position_must_meet_user_buffer(self):
        warning = self.run_case(500 * 10**18, 0, (self.market,))
        safe = self.run_case(1500 * 10**18, 0, (self.market,))
        self.assertEqual(warning["decision"]["status"], "BUFFER_BELOW_MANDATE")
        self.assertEqual(safe["decision"]["status"], "WITHIN_MANDATE")

    def test_evidence_hash_covers_manifest(self):
        result = self.run_case(0, 0, ())
        digest = result.pop("evidence_sha256")
        canonical = json.dumps(result, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        self.assertEqual(digest, hashlib.sha256(canonical.encode()).hexdigest())

    def test_address_array_decoder(self):
        self.assertEqual(_decode_addresses(address_array(self.market)), [self.market])


if __name__ == "__main__":
    unittest.main()
