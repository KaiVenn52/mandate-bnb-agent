import unittest

from app.yield_agent import build_yield_deliverable


class YieldDeliverableTests(unittest.TestCase):
    def test_manifest_binds_job_and_reference_evidence(self):
        result = build_yield_deliverable(999)
        self.assertEqual(result["job_id"], 999)
        self.assertEqual(result["metadata"]["agent_id"], "1806")
        self.assertEqual(result["evidence"]["uri"], "https://mandate-bnb-agent.vercel.app/evidence/yield-route-reference.json")
        self.assertEqual(
            result["evidence"]["sha256"],
            "be4e4264f3b5d106ec9f8517c4ddf9292b8b107b92e871243d8702c9302d6d3c",
        )
        self.assertFalse("transaction" in result["response"]["content"].lower() and "attempted" not in result["response"]["content"].lower())


if __name__ == "__main__":
    unittest.main()
