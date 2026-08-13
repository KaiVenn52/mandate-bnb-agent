# MANDATE Agent Advantage benchmark protocol

Status: **all 3 human baselines and all 3 agent outputs recorded, hash-checked, summarized, and packaged into the local Agent Advantage Report**.

## Official qualification rule

The current BNB Chain Tracks page requires an Agent Advantage Report with:

1. At least three real tasks run both ways: an agent hired through the marketplace versus without an agent.
2. Time, cost, output quality, and the actual outputs for every task.
3. At least one trading, stock, or security task.

Source checked 2026-08-12: <https://www.bnbchain.org/en/hackathons/smart-money-era>.

## Frozen tasks

| ID | Category | Frozen input SHA-256 | Locked correct decision | Quality rubric |
|---|---|---|---|---:|
| A-01 | Yield optimisation | `2150d74ff5e31d5d420eff2435cd6dc8030845c5bc84db68fd4af02a817aee21` | `lista-usdt` | 10 points |
| A-02 | Trading | `153f5f9a569877b6494132642c256c45ad864e1a14ae5263fca11827ac2c7eb2` | `balanced-26` | 10 points |
| A-03 | Security/risk monitoring | `a398c50ddcc3cc105b602e7052e5213eef35f8f6bbaff69a7cde11047f5bc27e` | `repay-1600` | 10 points |

The inputs, constraints, candidate rows, and rubric are returned by `GET /api/benchmarks`. The versioned agent implementation is run by `POST /api/benchmarks/{task_id}/agent-run`.

## A/B controls

- Both paths receive the exact JSON represented by the same input hash.
- The rubric is visible and locked before either path starts.
- Agent timing includes server compute time and browser-observed request round trip.
- Human timing starts when the operator opens the worksheet and stops on submission; it is labelled browser-measured and self-attested.
- Raw outputs are exported as JSON. The report must not substitute screenshots for these files.
- Quality uses the same 10-point answer key: constraint compliance 4, required calculation 2, rejection analysis 2, recommendation/evidence 2.
- Agent cost must include marketplace service price and chain fees if hired onchain. Human cost is elapsed time multiplied by a disclosed hourly labour assumption. Test U and tBNB are reported separately from USD and are never presented as real monetary spend.
- Any intervention, failed run, retry, or revealed answer invalidates that attempt and must be disclosed.

## Completed qualification evidence

A real person completed all three no-agent worksheets before the agent results were revealed. All six output bundles are retained under `evidence/termix/raw`, and the Evidence page now reports the measured 3/3 result. The canonical local report is `evidence/termix/agent-advantage-report.html`; its embedded data queries were executed against SQLite and matched every report snapshot row. PDF export and final screen recording remain submission-packaging tasks.

## Recorded runs

| Task | Path | UTC | Time | Quality | Raw output |
|---|---|---|---:|---:|---|
| A-01 | Human, no agent | 2026-08-12 04:36:25 | 290.004 s | 2/10 | `evidence/termix/raw/A-01-baseline.json` |
| A-01 | YieldRoute Agent #1806 | 2026-08-12 05:00:29 | 271.8 ms browser round trip | 10/10 | `evidence/termix/raw/A-01-agent.json` |
| A-02 | Human, no agent | 2026-08-12 04:48:36 | 233.650 s | 4/10 | `evidence/termix/raw/A-02-baseline.json` |
| A-02 | GridPilot Agent #1805 | 2026-08-12 04:59:36 | 269.6 ms browser round trip | 10/10 | `evidence/termix/raw/A-02-agent.json` |
| A-03 | Human, no agent | 2026-08-12 04:57:31 | 226.700 s | 8/10 | `evidence/termix/raw/A-03-baseline.json` |
| A-03 | LiqShield Agent #1807 | 2026-08-12 04:59:44 | 290.8 ms browser round trip | 10/10 | `evidence/termix/raw/A-03-agent.json` |

The agent times above are browser-observed round trips to the public production API. Server compute time is retained inside each raw JSON file. Both paths had $0 observed incremental cash cost, so no paid-service cost advantage is claimed. A-02's integral metric crossed a Python-float/JavaScript-Number wire boundary; `A-02-verification.json` documents the schema-preserving normalization that reproduces the recorded hash.
