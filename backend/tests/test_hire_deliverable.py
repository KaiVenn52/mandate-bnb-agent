import pytest
from fastapi import HTTPException

from app import main


def test_hire_deliverable_is_stable_and_excludes_timing(monkeypatch):
    hire = {
        "job_id": 601,
        "client": "0x1111111111111111111111111111111111111111",
        "provider": "0x2222222222222222222222222222222222222222",
        "status": 1,
        "budget_wei": 100000000000000000,
    }
    monkeypatch.setattr(main, "verify_hired_job", lambda job_id, task_id: hire)

    first = main.benchmark_hire_deliverable("A-01", 601)
    second = main.benchmark_hire_deliverable("A-01", 601)

    assert first == second
    assert first["marketplace_hire"] == hire
    assert first["quality_score"] == 10
    assert "server_compute_ms" not in first
    assert first["hash_canonicalization"].startswith("recursive-key-sorted")


def test_hire_deliverable_rejects_unknown_task():
    with pytest.raises(HTTPException) as exc:
        main.benchmark_hire_deliverable("A-99", 601)
    assert exc.value.status_code == 404
