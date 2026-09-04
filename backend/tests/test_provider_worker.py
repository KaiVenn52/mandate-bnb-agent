import json

import pytest
from fastapi import HTTPException

from provider_service import app as worker


def test_provider_worker_is_fail_closed_without_signer(monkeypatch):
    monkeypatch.setattr(worker, "PRIVATE_KEY", "")
    status = worker.health()
    assert status["signer_configured"] is False
    assert status["signer_status"] == "missing"
    assert status["ok"] is True
    assert status["asset_execution_configured"] is False
    with pytest.raises(HTTPException) as failure:
        worker.capability()
    assert failure.value.status_code == 503


def test_liveness_survives_invalid_signer_without_claiming_readiness(monkeypatch):
    monkeypatch.setattr(worker, "PRIVATE_KEY", "not-a-private-key")
    status = worker.health()
    assert status["ok"] is True
    assert status["provider_address"] is None
    assert status["signer_configured"] is True
    assert status["signer_status"] == "invalid"
    with pytest.raises(HTTPException) as failure:
        worker.ready()
    assert failure.value.status_code == 503


def test_receipt_store_rejects_non_hashes_and_deduplicates(tmp_path, monkeypatch):
    valid = "0x" + "ab" * 32
    receipt_file = tmp_path / "receipts.json"
    receipt_file.write_text(json.dumps([valid, valid.upper().replace("0X", "0x"), "0xnot-a-hash", {"hash": valid}]), encoding="utf-8")
    monkeypatch.setattr(worker, "RECEIPTS_FILE", receipt_file)
    assert worker._receipt_hashes() == [valid]


def test_manifest_is_idempotent_and_bound_to_exact_terms(tmp_path, monkeypatch):
    deliverables = tmp_path / "deliverables.json"
    monkeypatch.setattr(worker, "DELIVERABLES_FILE", deliverables)
    monkeypatch.setattr(worker, "PRIVATE_KEY", "0x" + "11" * 32)
    digest = "0x" + "22" * 32
    tx_hash = "0x" + "33" * 32
    first = worker._manifest(42, digest, "execute-bounded-yield-route", "request-1", tx_hash)
    second = worker._manifest(42, digest, "execute-bounded-yield-route", "request-1", tx_hash)
    assert first == second
    assert first["execution_transaction_hash"] == tx_hash
    with pytest.raises(HTTPException) as failure:
        worker._manifest(42, "0x" + "44" * 32, "execute-bounded-yield-route", "request-1", tx_hash)
    assert failure.value.status_code == 409


def test_public_url_validation_rejects_credentials_and_local_hosts():
    assert worker._valid_public_https("https://provider.example") is True
    assert worker._valid_public_https("http://provider.example") is False
    assert worker._valid_public_https("https://user:pass@provider.example") is False
    assert worker._valid_public_https("https://localhost") is False
    assert worker._valid_public_https("https://worker.local") is False
    assert worker._valid_public_https("https://10.0.0.1") is False
    assert worker._valid_public_https("https://169.254.169.254") is False


def test_render_external_url_is_supported(monkeypatch):
    monkeypatch.setattr(worker, "PUBLIC_BASE_URL", "https://mandate-provider-yield.onrender.com")
    assert worker._base_url() == "https://mandate-provider-yield.onrender.com"


def test_hex_values_are_always_returned_with_evm_prefix():
    class PrefixlessHex:
        def hex(self):
            return "ab" * 32

    assert worker._hex0x(PrefixlessHex()) == "0x" + "ab" * 32
    assert worker._hex0x("0x" + "cd" * 32) == "0x" + "cd" * 32
