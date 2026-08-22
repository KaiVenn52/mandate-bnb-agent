# MANDATE

**Set the outcome. Cap the risk. Hire the proof.**

MANDATE is an outcome-first BNB Chain agent marketplace. A user states an objective and hard limits, compares only eligible agents in read-only Shadow Mode, reviews a bounded permission contract, then creates an auditable ERC-8183 job. Every completed job becomes evidence instead of a generic star rating.

## Why this can win

- **Different marketplace primitive:** outcome -> evidence -> permission -> execution, rather than an agent-card directory.
- **Decision-grade data:** complete flows and category-specific scoreboards for LP rebalancing, grid trading, yield optimisation, and health-factor monitoring.
- **Safe before signing:** mandate limits, protocol allowlists, spend ceilings, expiry, and revoke remain visible before any transaction.
- **Mandate-native matching:** asset, capital, protocol, leverage, risk, activity and service-spend ceilings now flow from the user's text into eligibility, permission review and the immutable ERC-8183 job description.
- **Partner-track fit:** Shadow Mode produces the A/B structure required by the TermiX Agent Advantage Report.
- **Reproducible benchmark lab:** three versioned, frozen tasks expose public inputs, locked rubrics, input hashes, real agent runs, and human-only baseline worksheets.
- **Standards-native:** live BSC ERC-8004 registry discovery plus a guarded BNB Agent SDK gateway for the ERC-8183 job lifecycle.
- **Live protocol capability:** Agent #1807 reads the official Venus Core Pool Comptroller at a pinned BNB Chain block, applies a user-defined liquidation-buffer mandate, and exports a SHA-256-verifiable deliverable without requesting a signature or moving funds.
- **Live YieldRoute capability:** Agent #1806 reads current BSC stablecoin pools and protocol TVL trends from DefiLlama, applies mandate risk gates, calculates capital-specific outcomes, and exports a SHA-256-verifiable read-only deliverable.
- **Completed YieldRoute ERC-8183 proof:** Job #506 binds a public YieldRoute report and SHA-256 to a seven-step, user-approved BSC Testnet lifecycle. The exact 0.1 test U escrow returned at settlement and the residual allowance is zero.

## Current truth status

- The registry total on the results page is fetched live from the public 8004scan API with `chainId=56`.
- The four reference identities are live on BSC Testnet as ERC-8004 Agents #1804-#1807. Marketplace candidate performance remains labelled demo data; the three completed TermiX measurements are separately hash-verified.
- **Updated TermiX status:** the Evidence page now uses three completed, same-input task pairs; unrelated historical category scorecards remain explicitly labelled sample data.
- ERC-8183 YieldRoute Job #506 completed the full current-policy lifecycle with an exact 0.1 test U escrow and zero residual allowance; all seven transaction links are in `docs/onchain-evidence.md`.
- Permission review is a non-broadcast preview. A verified candidate can then continue into the real BSC Testnet hire flow.
- The public hire path supports a separate evaluator/client wallet: the client creates and funds, the registered provider submits, and settlement is permissionless after the optimistic window. The `jobId` stays in the shareable URL across the wallet handoff.
- The configured submission wallet is `0xD30BbB80c863c9B94622EF92337AaD65148D2EC3`; its BSC Testnet readiness is shown live on the Evidence page.
- The gateway can broadcast only after the operator enables live mode, configures the encrypted SDK wallet, and passes server-side budget/provider policy checks.

## Run the web app

```bash
npm install
copy .env.example .env.local
npm run dev
```

Production validation:

```bash
npm run lint
npm run build
npm run preview
```

## Run the guarded BNB Agent gateway

Use Python 3.10+ in an isolated environment:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8003
```

Safe endpoints:

- `GET /health` reports network, SDK, standards, and live/preview mode.
- `POST /agents/venus-risk/run` performs a live, read-only Venus Core Pool risk decision with pinned-block evidence.
- `POST /jobs/preview` validates budget, provider, description, and expiry without broadcasting.
- `POST /jobs/execute` runs `create_job -> register_job -> set_budget -> fund` through `ERC8183Client`; it returns HTTP 409 unless `MANDATE_LIVE_TRANSACTIONS=true`.

Never put wallet secrets in `VITE_*` environment variables. The SDK wallet stays server-side and uses its encrypted keystore.

## Architecture

```text
User mandate
  -> Match + category risk gates
      -> 8004scan public API (live BSC registry discovery)
      -> Shadow Mode (agent vs identical baseline)
      -> Permission review
          -> Guarded Python gateway
              -> BNB Agent SDK / ERC-8183 on BSC testnet
                  -> job receipt -> evidence passport
```

## Submission-critical status

- Complete: public source, four ERC-8004 identities, fully settled YieldRoute ERC-8183 Job #506, three recorded TermiX A/B pairs, a public Agent Advantage Report, live read-only YieldRoute and Venus capabilities, and an evaluator-wallet-to-provider ERC-8183 hire path.
- Honest boundary: marketplace candidate history outside the verified benchmark and Job #506 remains clearly labelled sample data. MANDATE does not claim mainnet execution or profitability.
- Remaining external actions: record/upload the demo video and submit the official form. Each requires owner approval.

## Public evidence endpoints

- `GET /api/benchmarks` — all frozen inputs, rubrics, versions, and SHA-256 digests
- `POST /api/benchmarks/{task_id}/agent-run` — raw deterministic agent output and measured compute time
- `POST /api/benchmarks/{task_id}/baseline-score` — scores a browser-timed human answer without fabricating a baseline
- `GET /api/erc8183/yield-deliverable/506` — canonical SDK-compatible YieldRoute deliverable
- `GET /api/erc8183/marketplace-deliverable/{category}/{jobId}` — canonical category deliverable used by the four hire paths
- `GET /evidence/evidence-passport-506.json` — machine-readable identity, benchmark and transaction evidence
- `GET /evidence/MANDATE-Agent-Advantage-Report.pdf` — required TermiX report

Before final submission, add the final demo-video URL and obtain owner approval for the submission form.

See [submission-checklist.md](docs/submission-checklist.md), [onchain-runbook.md](docs/onchain-runbook.md), and [demo-script.md](docs/demo-script.md).
