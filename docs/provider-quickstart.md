# Independent provider quickstart

The built-in MANDATE agents are intentionally read-only. If a provider wants
to qualify for asset execution, run the reference worker from a separate wallet
and publish its capability document. The worker never asks MANDATE for a key;
the provider owns the signer, endpoint and testnet receipts.

## 1. Configure one worker per wallet/category

From `backend`, create a local environment (never commit it):

```powershell
$env:MANDATE_PROVIDER_PRIVATE_KEY = "0x..."       # provider-owned testnet key
$env:PROVIDER_PUBLIC_BASE_URL = "https://provider.example"
$env:PROVIDER_CATEGORY = "yield"                 # rebalancing | grid | yield | health
$env:PROVIDER_RPC_URL = "https://data-seed-prebsc-1-s1.bnbchain.org:8545"
$env:PROVIDER_ASSET_TO = "0x..."                 # explicit BSC Testnet contract
$env:PROVIDER_ASSET_DATA = "0x..."               # explicit bounded calldata
$env:PROVIDER_ASSET_VALUE_WEI = "0"
$env:PROVIDER_MAX_VALUE_WEI = "1"
```

`PROVIDER_ASSET_TO` and `PROVIDER_ASSET_DATA` are intentionally not filled in.
Use a harmless, provider-owned testnet action first (for example an exact ERC-20
approval with the smallest permitted amount), and inspect the calldata before
running it. The service rejects empty calldata, private URLs, non-positive value
ceilings and unconfigured signers.

For `grid`, also set `PROVIDER_TRACK_RECORD_FILE` to a JSON record containing a
real time window, executed/winning/losing trades, win rate, max drawdown, risk
exposure and receipt-linked BSC Testnet trades. Paper results are not accepted.

## 2. Produce the first receipt

```powershell
python -m provider_service.bootstrap
```

The command broadcasts exactly the configured call, waits for a successful BSC
Testnet receipt, and stores only its transaction hash in
`.provider-receipts.json`. It does not print or persist the private key.

## 3. Start the worker

```powershell
python -m uvicorn provider_service.app:app --host 0.0.0.0 --port 8010
```

Run exactly one process for a given wallet/category. The included job lock is
process-local; a multi-worker deployment needs a shared distributed lock before
it can safely use the same signer.

Publish these routes over HTTPS:

- `GET /.well-known/agent-card.json` — official A2A card;
- `GET /mandate/capability` — `mandate.provider-service.v1`;
- `POST /mandate/accept` — signed exact-mandate acceptance;
- `POST /mandate/execute` or A2A `message/send` — one bounded provider action;
- `GET /mandate/deliverables/{job_id}.json` — the hash-bound deliverable.

Open MANDATE's `/provider-onboarding`, connect this wallet on BSC Testnet, and
enter `https://provider.example/mandate/capability`. The page independently
checks the ERC-8004 registration receipt, provider wallet, endpoint, execution
scope, successful transaction sender/target/calldata/value, and (for grid) the
realized track record. Registering an identity alone never makes it hireable.

## 4. Complete a real hire

After the provider identity is registered, create an ERC-8183 job from the client
wallet, assign this provider and fund exactly `0.1` test U. The worker's A2A
`notify_funded` handler executes the configured bounded testnet action first and
then submits the provider deliverable asynchronously. The explicit execution
route performs the same single-job locked path and additionally returns a signed
`mandate.provider-execution-receipt.v1`. Both paths persist the real asset-call
and ERC-8183 submission hashes. MANDATE verifies them directly on BSC Testnet
before displaying evidence.

Run one worker/wallet per category (and at least two wallets per category) if the
submission claims provider diversity. Never reuse the client wallet or the
built-in provider wallet `0x34AB…2c7e` for the independent-provider path.
