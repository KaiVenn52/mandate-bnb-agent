# MANDATE final demo — 2 minutes 45 seconds

Record the deployed product and already-completed evidence. No new signature or transaction is needed. Demo video URL: **PENDING USER RECORDING / UPLOAD**.

This cut is optimized for the Main Track first: outcome-first UX, four first-class categories, live decision data and activation without dead ends. Job #873 proves the independent-provider execution architecture; it is not presented as a yield trade. The final section proves TermiX qualification.

| Time | Exact screen/click sequence | English narration |
|---|---|---|
| 0:00–0:15 | Start on the deployed app `/`, with the outcome box visible. | “BNB Chain has a large agent registry. The hard problem is deciding which agent can deliver your financial outcome without exceeding its authority.” |
| 0:15–0:38 | Enter `Earn on 5,000 USDT. No leverage. Low risk. Max 3 actions per week. Allowed protocols: Venus, Lista.` Show the live preview, edit one limit, click **Create mandate**, then **Search marketplace**. | “MANDATE starts with the requirement, not an agent card. Natural language becomes editable limits for capital, risk, leverage, activity and allowed protocols. The mandate exists before provider selection.” |
| 0:38–1:18 | Sweep through all four category tabs. On each, point to the data source, category-specific decision and risk gate: LP/PancakeSwap; Grid/BNB-USDT plus drawdown cap; Yield/DefiLlama plus allowlist; Health/Venus pinned-block check. Show one excluded candidate and its reason. | “All four categories use different evidence. LP rebalancing checks live PancakeSwap conditions and gas drag. Grid evaluates the live BNB-USDT market against drawdown and action caps. Yield compares current pools and rejects leverage or unapproved protocols. Health monitoring reads Venus at a pinned block and never increases debt. An agent that violates a hard limit is excluded, not merely ranked lower.” |
| 1:18–1:37 | Open an external registry result. Show identity, callable-service checks and the signed-acceptance requirement; briefly point to the Open Mandate fallback. | “Live ERC-8004 discovery is separate from verified supply. Identity alone cannot unlock funding. The provider must expose a callable service and sign the exact mandate; otherwise MANDATE preserves the requirement as an unfunded Open Mandate instead of forcing a bad match.” |
| 1:37–2:03 | Open `/open-mandate?category=yield&jobId=873`, then the Evidence Passport. Highlight separate client/provider, COMPLETED, provider execution/submission, manifest match and third-wallet settlement. | “Job 873 proves that external activation path on BSC Testnet. A separate provider executed a bounded call, submitted its own hash-bound deliverable, and a third wallet settled the job after the dispute window. The action was a one-base-unit token approval: proof of the execution handoff, not a yield route or profitability claim.” |
| 2:03–2:30 | Open `/evidence`, show Jobs #642/#644/#666, then the Agent Advantage Report summary and raw-output links. | “For TermiX, three funded hires are paired with identical no-agent tasks and pre-committed rubrics. The report exposes time, service cost, quality and raw outputs for yield, trading safety and liquidation-risk work. It measures service advantage; it does not invent trading returns.” |
| 2:30–2:45 | Return to the submission package category matrix and tagline. | “MANDATE gives every user the same sequence: define the outcome, inspect category-specific evidence, cap authority, activate a provider and keep the receipt. Set the outcome. Cap the risk. Hire the proof.” |

## Tabs to preload, in order

1. App `/` with a clean browser profile.
2. `/results?category=yield` only as a recovery tab; demonstrate navigation from the builder in the recording.
3. `/open-mandate?category=yield&jobId=873`.
4. [Job #873 Evidence Passport](https://mandate-bnb-agent.vercel.app/evidence/evidence-passport-873.json).
5. [Original manifest](https://mandate-provider-yield.onrender.com/mandate/deliverables/873.json).
6. [Execution](https://testnet.bscscan.com/tx/0x0d0ec0d8e1368639f1037adb36b004fabbda8f84523d61e7bec6c4b5d064ca44), [provider submit](https://testnet.bscscan.com/tx/0x7088528bbaf86c916f8279da98a9ecd3d902efe3f4dcd142e2ca71b448692c3b) and [permissionless settlement](https://testnet.bscscan.com/tx/0x413a64410246ae228b573ecd0900819ef9f9fadbcd866a3fc7e9848a41fc3b21) as backup tabs. Use the passport in the main cut so explorer loading does not consume time.
7. `/evidence` and the [TermiX PDF](https://mandate-bnb-agent.vercel.app/evidence/MANDATE-Agent-Advantage-Report.pdf).
8. `/evidence/submission-package.html` for the close.

## Recording checklist

- [ ] 1080p browser, clean profile, bookmarks and personal tabs hidden.
- [ ] Keep the final edit between 160 and 175 seconds; cut every loading wait.
- [ ] Show all four category tabs and one exact exclusion reason before Job #873.
- [ ] Use completed history; do not pretend a new hire or wallet signature occurred during recording.
- [ ] If BscScan is slow or blocked, use the RPC-verified passport in the main cut and keep explorer tabs only as optional proof.
- [ ] Do not call Job #873 a yield transaction, or claim four-category asset execution, realized APY/PnL, mainnet safety or a real Grid trading record.
- [ ] Confirm the Agent Advantage Report and every public link load in a logged-out browser.
- [ ] User uploads the video and supplies a public view URL. Insert that URL into the submission copy/package only if there is enough time to deploy and reverify before the deadline.
