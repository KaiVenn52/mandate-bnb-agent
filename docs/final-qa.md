# Final local QA — September 6, 2026

## Baseline and scope

The final audit started from a clean worktree at `6a869d2cb87e2acab673707c13399176becb995a`. The reviewed product and evidence fixes were subsequently pushed as `9b1aac2e6ea62acadcb45fe19ce6fddbdbdacbe6`; the Vercel artifacts and Render provider endpoints were then reverified. No secrets were loaded or reused, and the audit itself broadcast no transaction or form submission.

## Verified evidence

- Job #873 is COMPLETED on chain 97; separate client/provider, Agent #2054 `ownerOf`, 0.1 test U budget and original manifest canonical Keccak hash verified.
- Three successful receipts independently read and decoded: provider approval, provider submission and third-wallet settlement. Execution is `approve(Commerce, 1 base unit of test U)`, zero native value. Settlement transfers 0.1 test U to provider.
- `public/evidence/evidence-passport-873.json` contains raw logs, calldata, addresses, hashes and retrieval gaps. `scripts/collect_primary_evidence.py` repeats read-only verification.
- Historical registration/create/acceptance/assignment/policy/budget/approval/funding hashes remain unrecovered: PublicNode pruned history; BNB seed RPC rejected log ranges; explorer HTTP 403. Current state does not substitute for independently checking a historical acceptance signature.
- Production frontend, gateway health, TermiX PDF and hire inventory returned HTTP 200. Provider health/readiness/card/capability/manifest returned 200. No dashboard deploy-ID re-verification was performed; HTTP readiness alone does not establish a specific deployed commit.

## Fixes and tests

- Provider `_receipt_hashes` accepts valid legacy prefixless hashes, deduplicates and still rejects malformed data. It never rewrites a hash-bound manifest. Regression tests prove original stored text is unchanged. After deployment, production capability reports the bounded provider action and provider ERC-8183 submission receipts.
- Historical Open Mandate links load without a browser-local draft, use the onchain brief, show actual job status and settled/funded escrow state, and avoid directing completed jobs to fund again.
- Evidence page leads with #873 and distinguishes it from the three TermiX hires. Submission HTML wraps long wallet addresses on mobile.
- Rejected publication shows a concise rejection notice. No real wallet was connected during QA.
- `npm run lint`: passed. `npm run build`: passed. Python `pytest tests -q`: **33 passed**, including provider regression tests; one existing websockets deprecation warning.
- Fresh clone at `D:/mandate-final-qa-20260906`: cloned tracked baseline, overlaid the reviewed local changes without environment files, ran `npm ci` successfully and then lint/build. Build log: `D:/mandate-final-build.log`. This is a fresh dependency install, not reuse of workspace node_modules. Backend tests used the existing isolated Python environment; a fresh Python dependency install was not performed.
- npm audit: **8 moderate, 0 high, 0 critical**. The reported chain is uuid buffer bounds checking through MetaMask/wagmi dependencies. No forced major upgrade applied; no exploitability claim made. Full output: `D:/mandate-audit.json`.

## Browser QA

Browser plugin not available; used bundled Playwright with a separate headless Chrome, never the user's active browser.

Flow: create mandate -> saved confirmation -> marketplace; fresh browser -> Job #873 -> completed history; disconnected commerce -> signing locked; mocked wrong-network wallet -> switch control; mocked rejected `eth_sendTransaction` -> failure UI and no publication.

- Fresh-browser Job #873 renders COMPLETED and settled without local draft; no false “not funded” or “waiting for proposals”.
- 375, 768 and 1440 px: builder, results, historical job, Evidence and submission package render without horizontal overflow.
- Yield request loading, injected HTTP 503 error and retry re-entry explicitly passed. The local benchmark API-unavailable fallback remained readable with report links.
- No page-level JavaScript errors in the main smoke pass. Request failures intentionally injected or caused by an absent local gateway are not counted as successful live capability runs.
- Screenshots outside repository: `D:/mandate-qa-completed.png`, `D:/mandate-qa-mobile.png`, `D:/mandate-qa-rejected.png`. Main observations: `D:/mandate-qa-results.json`; targeted loading/error test: `D:/mandate-qa-loading.cjs`.
- Actual extension signing, mobile wallet QR return, a new funded hire and organizer-side hiring were not exercised. Those require human-controlled signatures and are not inferred from mock tests.

## Publish handoff

1. GitHub commit `9b1aac2e6ea62acadcb45fe19ce6fddbdbdacbe6`, Vercel artifacts and the Render provider are public. Production capability lists both verified receipt hashes.
2. Public #873 passport, original manifest hash, public HTML copy and completed-job route have been reverified. Run `python scripts/sync_submission.py` whenever editing the submission HTML source.
3. User records the 165-second script and uploads the video; insert and test the public URL.
4. Review current official form fields, obtain final submission approval, then preserve the form confirmation. Form submission and video upload are still pending.

Remaining competition limitations: unequal category execution depth, no two independent providers in every category, no realized Grid trading record, three-task/one-human benchmark, testnet-only execution and compromised #2054 wallet permanently restricted to testnet. The official form states the build period closes September 9, 2026 at 12:00 UTC (20:00 Malaysia time).
