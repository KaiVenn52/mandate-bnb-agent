# MANDATE

**Set the outcome. Cap the risk. Hire the proof.**

MANDATE is an outcome-first BNB Chain agent marketplace. A user states an objective and hard limits, verifies an eligible agent with a live read-only capability, reviews a bounded permission contract, then creates an auditable ERC-8183 job. Every completed job becomes evidence instead of a generic star rating.

## Why this can win

- **Different marketplace primitive:** outcome -> evidence -> permission -> execution, rather than an agent-card directory.
- **Decision-grade data:** complete flows and category-specific scoreboards for LP rebalancing, grid trading, yield optimisation, and health-factor monitoring.
- **Safe before signing:** mandate limits, protocol allowlists, spend ceilings, expiry, and revoke remain visible before any transaction.
- **Mandate-native matching:** asset, capital, protocol, leverage, risk, activity and service-spend ceilings now flow from the user's text into eligibility, permission review and the immutable ERC-8183 job description.
- **Mandate creation is not agent creation:** creating a mandate saves a provider-independent requirement first. Marketplace search happens only when the user asks for it; a zero-match result never weakens the limits or forces a choice.
- **Open demand, not a fake fourth agent:** when every disclosed provider is excluded, the client can publish an unfunded ERC-8183 job with `provider = address(0)`. Providers bid offchain and the client must explicitly assign one before funding.
- **Partner-track path:** the evidence lab now requires a funded ERC-8183 job with separate client/provider wallets before it will run a TermiX agent path.
- **Reproducible benchmark lab:** three versioned, frozen tasks expose public inputs, locked rubrics, input hashes, real agent runs, and human-only baseline worksheets.
- **Standards-native:** live BSC ERC-8004 registry discovery plus a guarded BNB Agent SDK gateway for the ERC-8183 job lifecycle.
- **Live protocol capability:** Agent #1807 reads the official Venus Core Pool Comptroller at a pinned BNB Chain block, applies a user-defined liquidation-buffer mandate, and exports a SHA-256-verifiable deliverable without requesting a signature or moving funds.
- **Live YieldRoute capability:** Agent #1806 reads current BSC stablecoin pools and protocol TVL trends from DefiLlama, applies mandate risk gates, calculates capital-specific outcomes, and exports a SHA-256-verifiable read-only deliverable.
- **Constraint continuity:** LP and Grid live reads carry the saved action period and parsed gas-drag/drawdown ceilings into the gateway; each response echoes the exact limit plus its conservative daily normalisation.
- **Completed YieldRoute ERC-8183 proof:** Job #506 binds a public YieldRoute report and SHA-256 to a seven-step, user-approved BSC Testnet lifecycle. The exact 0.1 test U escrow returned at settlement and the residual allowance is zero.
- **Provider provenance is enforced in the UI:** only identities with a public ERC-8004 receipt enter the hireable inventory. Old comparison fixtures are marked `unverified-sample`, carry no APY/PnL/completion claims, and are withheld from ranking.
- **Independent-provider onboarding:** `/provider-onboarding` lets a provider connect a separate BSC Testnet wallet, publish an HTTPS `mandate.provider-service.v1` document, and sign one ERC-8004 registration per category. The document must advertise A2A/MCP acceptance, a category-matched action/contract allowlist and at least one successful provider-signed contract-call receipt; the browser checks sender, target, calldata and success on BSC before merging the identity into the callable marketplace. No private key is collected.
- **External direct-hire handshake:** when a discovered agent exposes an active BSC Testnet HTTPS A2A/MCP endpoint and provider wallet, the registry profile can request a signed acceptance (domain verification is only a signal). MANDATE validates either its compact `mandate.provider-acceptance-request.v1` response—including a future expiry—or the official BNBAgent A2A negotiation quote before assignment; otherwise the flow falls back to an unfunded Open Mandate invite.
- **External bounded execution handoff:** after an external provider is assigned and the client funds the ERC-8183 job, the Commerce screen can send `mandate.provider-execution-request.v1` to the provider. The provider executes one named action with its own wallet and returns a signed `mandate.provider-execution-receipt.v1`; the browser verifies the provider sender, target, calldata, value ceiling, allowlist, success status and optional provider-signed ERC-8183 submit receipt before accepting the result.
- **Execution boundary is machine-readable:** `GET /agents/execution-status` reports, per category, that the built-in gateway is live read-only and lists the provider-owned wallet/session/receipt prerequisites for enabling bounded asset execution. A registry record without those receipts remains non-hireable for asset execution, even when its endpoint responds.

## Current truth status

- The registry total on the results page is fetched live from the public 8004scan API with `chainId=97` (BNB Chain Testnet).
- The four reference identities are live on BSC Testnet as ERC-8004 Agents #1804-#1807. Unverified comparison fixtures are withheld from hiring and their old APY, PnL, win-rate, capital and completion values are not presented as marketplace history.
- **TermiX status:** three independent, funded ERC-8183 hires are complete on BSC Testnet: YieldRoute Job #642, GridPilot Job #644, and LiqShield Job #666. Each final task output embeds verified job metadata and is paired with the original browser-timed human baseline; the older direct-API outputs remain archived for reproducibility only.
- ERC-8183 YieldRoute Job #506 completed the full current-policy lifecycle with an exact 0.1 test U escrow and zero residual allowance; all seven transaction links are in `docs/onchain-evidence.md`.
- Permission review is a non-broadcast preview. A verified candidate can then continue into the real BSC Testnet hire flow.
- The marketplace separates providers with structured execution evidence from live ERC-8004 semantic discoveries. The former can be constraint-gated and activated; the latter are searched across the live BNB Chain index and can progress to a direct hire only after a provider-signed acceptance, then to bounded execution only after a provider-signed testnet receipt is independently verified.
- Live external results are the primary marketplace surface. Each opens a registry-backed qualification page covering identity, active status, callable service, endpoint ownership, trust signals and the exact mandate gaps that still block funding. A callable BSC Testnet endpoint can be asked for a signed acceptance directly; the provider's signature is verified even when 8004scan has not completed its domain check, while offline/non-callable records remain invite-only.
- External A2A records use the official BNBAgent `message/send` negotiation shape when they do not implement MANDATE's small acceptance adapter. The buyer resolves `/.well-known/agent-card.json`, follows the card's advertised negotiation skill (`negotiate` or `negotiate-erc8183-job`), verifies the provider-signed quote, chain, Commerce contract, request hash, payment token and 0.1 U ceiling, then anchors the same signed quote in the ERC-8183 job description. After funding, sellers that advertise `notify_funded` receive that official handoff and can submit their own deliverable asynchronously; providers that advertise MANDATE's `execute-bounded-testnet-action` return a signed execution receipt plus an optional provider-signed Commerce submission. A2A/MCP endpoints without a valid quote or execution receipt/chain submission remain blocked.
- An external identity can be invited into an unfunded Open Mandate. The invitation is written into the ERC-8183 job brief, while provider assignment and escrow remain blocked until that provider accepts the exact limits. A verified acceptance receipt is carried into `setProvider` call metadata.
- The built-in category surface contains one registered callable provider per category and withholds unverified fixture rows from the hireable table; it is never presented as the whole ERC-8004 registry. If none passes and no live discovery can be verified, Open Mandate preserves the exact requirement as a real unassigned BSC Testnet ERC-8183 job.
- The built-in category surface starts with one registered callable provider per category; the new onboarding path adds additional identities only after a second wallet's ERC-8004 receipt, provider capability document and successful testnet execution receipt are confirmed. Provider diversity is counted by distinct wallets, not by display names.
- Open Mandate publication is live and gas-only: it creates an unfunded job and moves no test U. Provider proposal collection and `setProvider` remain an offchain/client handoff before the existing funded hire lifecycle.
- The public hire path supports a separate evaluator/client wallet: the client creates and funds, the registered provider submits, and settlement is permissionless after the optimistic window. The `jobId` stays in the shareable URL across the wallet handoff.
- The configured submission wallet is `0xD30BbB80c863c9B94622EF92337AaD65148D2EC3`; its BSC Testnet readiness is shown live on the Evidence page.
- The gateway can broadcast only after the operator enables live mode, configures the encrypted SDK wallet, and passes server-side budget/provider policy checks.
- The built-in grid track record is a reproducible paper test with explicit risk exposure and an empty onchain transaction set. It is not realized PnL. A provider-owned realized record is accepted only when its time window, win/loss counts, win rate, maximum drawdown, risk exposure and every linked BSC Testnet transaction receipt pass the browser's scope checks.

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

### Wallet connections

- MetaMask uses the official MetaMask Connect connector, including its mobile QR fallback.
- Installed Bitget, Binance, OKX, Trust, Coinbase and other EVM extensions are discovered through EIP-6963 with legacy injected-provider fallbacks where the wallet documents one.
- The repository includes MANDATE's public Reown Project ID so the WalletConnect QR option works in the deployed app. `VITE_WALLETCONNECT_PROJECT_ID` can override it for forks; this identifier is public and is not a wallet secret.
- Wallet connection only exposes the selected public account. Every BSC Testnet state change still needs a separate wallet confirmation.

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

- `GET /health` reports network, SDK, standards, and read-only execution mode.
- `POST /agents/rebalancing/run` and `POST /agents/grid/run` read the live PancakeSwap BNB/USDT market and return bounded, hash-verifiable evidence.
- `POST /agents/yield-route/run` reads live BSC stablecoin yield data and applies the saved mandate.
- `POST /agents/venus-risk/run` performs a live, read-only Venus Core Pool risk decision with pinned-block evidence.
- `GET /agents/execution-status` exposes the per-category asset-execution status and the exact evidence needed to enable it.
- `GET /providers/capability-contract` publishes the exact independent-provider JSON contract used by `/provider-onboarding`; the project endpoint cannot self-certify a second provider.
- `POST /registry/provider-acceptance` is a single SSRF-guarded CORS fallback for a buyer-initiated external signed-acceptance request; it never signs, assigns or funds a job.
- `POST /registry/provider-execution` is a rate-limited, SSRF-guarded CORS fallback for one buyer-initiated bounded execution request; it never signs, assigns, funds or submits a job on behalf of any wallet. The browser verifies the returned provider receipt onchain.
- `POST /registry/provider-card` and `POST /registry/provider-capability` are separate SSRF-guarded GET-only fallbacks for provider cards and capability documents when a service omits browser CORS; neither route is a generic proxy.
- `POST /jobs/preview` validates budget, provider, description, and expiry without broadcasting.

There is deliberately no server-funded transaction endpoint. Every ERC-8183 write is simulated in the browser and then requires the correct client or provider wallet signature. Never put wallet secrets in `VITE_*` environment variables.

## Run an independent execution provider

The repository includes a separate, fail-closed provider worker for teams that
want to become directly hireable with their own wallet and bounded BSC Testnet
receipts. It is not mounted into MANDATE's public buyer gateway and never sends
a signing key to the browser. See [provider-quickstart.md](docs/provider-quickstart.md).
The included Render Blueprint runs exactly one worker and stores its receipts in
PostgreSQL so container restarts do not erase the public evidence trail.

## Architecture

```text
User requirement
  -> Build provider-independent mandate
      -> Search disclosed marketplace candidates
          -> eligible match -> live read-only verification + permission review
          -> no eligible match -> publish unfunded Open Mandate
  -> Match + category risk gates
      -> 8004scan public API (live BSC registry discovery)
      -> live capability (agent vs frozen evidence baseline in the lab)
      -> Permission review
          -> Guarded Python gateway
              -> BNB Agent SDK / ERC-8183 on BSC testnet
                  -> job receipt -> evidence passport
```

## Submission-critical status

- Complete: public source, four ERC-8004 identities, settled lifecycle proof Job #506, four live read-only agent capabilities, strict marketplace matching, external-provider Open Mandates, provider onboarding, three independent funded TermiX hires, and the regenerated hire-backed Agent Advantage Report.
- Honest boundary: the current built-in agents do not sign DeFi asset transactions; the grid record has no onchain trades; a second provider and real trading record still require wallet-controlled registration and bounded testnet receipts. MANDATE does not claim mainnet execution or profitability.
- Remaining external actions: record/upload the demo video and submit the official form. Each requires owner approval.

## Public evidence endpoints

- `GET /api/benchmarks` — all frozen inputs, rubrics, versions, and SHA-256 digests
- `POST /api/benchmarks/{task_id}/agent-run` — requires `{ "job_id": ... }`; verifies a funded, separate-provider ERC-8183 hire before returning agent output
- `GET /api/benchmarks/{task_id}/hire-deliverable/{job_id}` — stable, hire-verified A-01/A-02/A-03 output whose canonical JSON hash is submitted by the independent provider
- `POST /api/benchmarks/{task_id}/baseline-score` — scores a browser-timed human answer without fabricating a baseline
- `GET /api/erc8183/yield-deliverable/506` — canonical SDK-compatible YieldRoute deliverable
- `GET /api/erc8183/marketplace-deliverable/{category}/{jobId}` — canonical category deliverable used by the four hire paths
- `GET /evidence/evidence-passport-506.json` — machine-readable identity, benchmark and transaction evidence
- `GET /evidence/MANDATE-Agent-Advantage-Report.pdf` — final hire-backed report generated from Jobs #642, #644, and #666

Before final submission, add the final demo-video URL and obtain owner approval for the submission form.

See [submission-checklist.md](docs/submission-checklist.md), [onchain-runbook.md](docs/onchain-runbook.md), and [demo-script.md](docs/demo-script.md).
