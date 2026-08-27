from __future__ import annotations

import html
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence" / "termix"
PUBLIC = ROOT / "public" / "evidence"

TASKS = {
    "A-01": ("Stablecoin yield route selection", "Yield optimisation"),
    "A-02": ("BNB/USDT grid plan safety review", "Trading"),
    "A-03": ("Venus health-factor intervention", "Security / risk monitoring"),
}


def load(name: str) -> dict:
    return json.loads((EVIDENCE / name).read_text(encoding="utf-8"))


def build() -> None:
    onchain = load("onchain-hires.json")
    hires = {row["task_id"]: row for row in onchain["hires"]}
    rows = []
    for task_id, (task, category) in TASKS.items():
        human = load(f"raw/{task_id}-baseline.json")
        agent = load(f"raw/{task_id}-agent.json")
        hire = hires[task_id]
        human_seconds = human["elapsed_ms"] / 1000
        agent_seconds = agent["client_roundtrip_ms"] / 1000
        assert agent["input_sha256"] == human["input_sha256"]
        assert agent["marketplace_hire"]["job_id"] == hire["job_id"]
        assert hire["status"] == "COMPLETED" and hire["client"].lower() != hire["provider"].lower()
        rows.append({
            "task_id": task_id, "task": task, "category": category,
            "human_seconds": round(human_seconds, 7), "agent_seconds": round(agent_seconds, 7),
            "time_saved_seconds": round(human_seconds - agent_seconds, 7),
            "speedup_x": human_seconds / agent_seconds,
            "human_quality": human["quality_score"], "agent_quality": agent["quality_score"],
            "quality_delta": agent["quality_score"] - human["quality_score"],
            "input_sha256": agent["input_sha256"], "job_id": hire["job_id"],
            "agent_id": hire["agent_id"], "budget_test_u": hire["budget_test_u"],
            "deliverable_url": hire["deliverable_url"], "known_transactions": hire["known_transactions"],
        })
    summary = {
        "paired_tasks": 3,
        "independent_completed_hires": 3,
        "median_human_seconds": statistics.median(r["human_seconds"] for r in rows),
        "median_agent_seconds": statistics.median(r["agent_seconds"] for r in rows),
        "median_time_saved_seconds": statistics.median(r["time_saved_seconds"] for r in rows),
        "median_speedup_x": statistics.median(r["speedup_x"] for r in rows),
        "average_quality_delta_points": statistics.mean(r["quality_delta"] for r in rows),
        "service_cost": "0.1 test U per task; no fiat value claimed",
        "gas_cost": "Paid in testnet tBNB; complete lifecycle gas not aggregated; no fiat value claimed",
    }
    payload = {
        "generated_at_utc": onchain["generated_at_utc"],
        "benchmark_version": "mandate-aar-1.1.0-hire-backed",
        "network": onchain["network"], "chain_id": onchain["chain_id"],
        "client": onchain["client"], "provider": onchain["provider"],
        "rows": rows, "summary": summary,
        "limitations": [
            "One human operator and three frozen structured tasks; results are not a population estimate.",
            "Agent time is a production API round trip after hire verification; human time includes reading and composition.",
            "Test U and tBNB have no claimed fiat value; full lifecycle gas was not aggregated.",
            "The experiment measures task execution, not real-capital profitability.",
        ],
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    (EVIDENCE / "summary.json").write_text(text, encoding="utf-8")
    (EVIDENCE / "artifact.json").write_text(text, encoding="utf-8")
    (PUBLIC / "termix" / "summary.json").write_text(text, encoding="utf-8")

    cards = "".join(
        f'<article><small>{r["task_id"]} · Job #{r["job_id"]}</small><h3>{html.escape(r["task"])}</h3>'
        f'<p><b>{r["speedup_x"]:.1f}×</b> speedup · {r["human_quality"]}/10 → {r["agent_quality"]}/10</p>'
        f'<p>{r["human_seconds"]:.3f}s human · {r["agent_seconds"]:.4f}s agent · 0.1 test U</p>'
        f'<a href="{html.escape(r["deliverable_url"])}">Public deliverable</a></article>' for r in rows
    )
    report = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MANDATE Agent Advantage Report</title>
<style>body{{margin:0;background:#f4f1e8;color:#161614;font:16px/1.55 Arial,sans-serif}}main{{max-width:1080px;margin:auto;padding:64px 24px}}.k{{font:700 12px monospace;color:#926c00;letter-spacing:.14em}}h1{{font-size:56px;line-height:1;margin:12px 0}}.metrics,.cards{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:28px 0}}.metrics div,article,section{{background:#fff;border:1px solid #cfc9bb;padding:22px}}.metrics b{{display:block;font-size:30px}}table{{width:100%;border-collapse:collapse;background:#fff}}th,td{{padding:12px;border:1px solid #cfc9bb;text-align:left}}th{{background:#1d1d1a;color:#fff}}a{{color:#8b6500}}@media(max-width:700px){{h1{{font-size:38px}}.metrics,.cards{{grid-template-columns:1fr}}}}</style>
<main><p class="k">TERMIX · FINAL HIRE-BACKED EVIDENCE</p><h1>Agent Advantage Report</h1><p>Three real paired tasks. Three independently hired providers. Three completed ERC-8183 jobs on BSC Testnet.</p>
<div class="metrics"><div><b>3 / 3</b>completed independent hires</div><div><b>{summary["median_speedup_x"]:.1f}×</b>median per-task speedup</div><div><b>+{summary["average_quality_delta_points"]:.1f}</b>average quality points</div></div>
<div class="cards">{cards}</div><section><h2>Truthful cost statement</h2><p>Each marketplace job escrowed 0.1 test U. Test U has no claimed fiat value. Gas was paid in BSC Testnet tBNB; complete lifecycle gas was not retained as an aggregate, so this report makes no dollar-cost advantage claim.</p></section>
<section><h2>Method and limitations</h2><p>Both paths received identical frozen input hashes and a rubric locked before execution. Human timings are browser-measured and self-attested. Agent timings are new hire-gated production round trips; the 2.99-second A-01 cold start is retained. This small controlled benchmark demonstrates workflow advantage, not trading profitability.</p></section>
<p><a href="/evidence/MANDATE-Agent-Advantage-Report.pdf">Download the reviewed PDF</a> · <a href="/evidence/termix/summary.json">Machine-readable summary</a> · <a href="/evidence/termix/onchain-hires.json">Onchain hire inventory</a></p></main></html>'''
    (EVIDENCE / "agent-advantage-report.html").write_text(report, encoding="utf-8")
    (PUBLIC / "agent-advantage-report.html").write_text(report, encoding="utf-8")

    package = report.replace("Agent Advantage Report</h1>", "Submission Evidence Package</h1>")
    (PUBLIC / "submission-package.html").write_text(package, encoding="utf-8")


if __name__ == "__main__":
    build()
