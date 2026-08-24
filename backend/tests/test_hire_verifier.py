import json

import pytest

from app.hire_verifier import HireVerificationError, verify_hired_job


class _Call:
    def __init__(self, job): self.job = job
    def call(self): return self.job


class _Functions:
    def __init__(self, job): self.job = job
    def getJob(self, _job_id): return _Call(self.job)


class _Contract:
    def __init__(self, job): self.functions = _Functions(job)


class _Eth:
    def __init__(self, job): self.job = job
    def contract(self, **_kwargs): return _Contract(self.job)


def _patch_web3(monkeypatch, job):
    class FakeWeb3:
        HTTPProvider = staticmethod(lambda *_args, **_kwargs: object())
        def __init__(self, _provider): self.eth = _Eth(job)
    monkeypatch.setattr("app.hire_verifier.Web3", FakeWeb3)


def test_verifies_separate_funded_provider(monkeypatch):
    job = (91, "0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000002", "0x0000000000000000000000000000000000000003", json.dumps({"category": "grid"}), 10**17, 0, 1, "0x0000000000000000000000000000000000000003", 0, bytes(32))
    _patch_web3(monkeypatch, job)
    verified = verify_hired_job(91, "A-02")
    assert verified["job_id"] == 91
    assert verified["provider"].endswith("2")


def test_rejects_self_hire(monkeypatch):
    same = "0x0000000000000000000000000000000000000001"
    job = (91, same, same, same, json.dumps({"category": "yield"}), 10**17, 0, 3, same, 0, bytes(32))
    _patch_web3(monkeypatch, job)
    with pytest.raises(HireVerificationError, match="self-hiring"):
        verify_hired_job(91, "A-01")
