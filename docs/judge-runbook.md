# Judge runbook - MANDATE

## Fast path (about 2 minutes, no wallet required)

1. Open <https://mandate-bnb-agent.vercel.app>.
2. Enter: `Earn on 5,000 USDT. No leverage. Low risk. Max 3 actions per week. Allowed protocols: Venus, Lista.`
3. Edit one field from the right-hand mandate preview and confirm the natural-language mandate updates.
4. Select **Build mandate** and confirm the page stays in the builder with a **Mandate built** receipt. Then select **Search marketplace**.
5. Confirm SteadyPath is eligible while riskier or leveraged candidates show explicit rejection reasons.
6. Run live YieldRoute. This is read-only and requests no wallet signature.
7. Run Shadow Mode, open Review permissions and confirm that capital, risk, leverage, protocol, activity and service-spend limits match the original mandate.
8. Continue to the onchain hire page. Without signing, inspect the separate client/provider roles and seven-step ERC-8183 lifecycle.
9. Open Evidence and inspect the Agent Advantage Report.

## Hard no-match path (about 1 minute, no wallet required)

1. Enter: `Earn on 5,000 USDT. No leverage. Low risk. Max 1 action per month. Allowed protocols: Aster. Spend no more than $0.01 total.`
2. Build the mandate, then search the marketplace.
3. Confirm all disclosed candidates are **Excluded**, with exact rejection reasons and no recommended agent.
4. Select **Publish open mandate**. Confirm the brief is unchanged, Provider is **UNASSIGNED**, escrow is **0 U**, and publication requires only a BSC Testnet `createJob` signature.
5. Do not sign during the fast demo. This screen is the inspectable proof that a user specification is independent from provider discovery; a confirmed publication creates a real unfunded ERC-8183 job.

## Proof path (pre-completed; no transaction required)

- Evidence Passport: <https://mandate-bnb-agent.vercel.app/evidence/evidence-passport-506.json>
- ERC-8183 Job #506 settlement: <https://testnet.bscscan.com/tx/0xf423d6403c8e7926ea0e125c3b216226b95856fc836293645ef14c8ae531f043>
- Public manifest: <https://mandate-bnb-agent.vercel.app/api/erc8183/yield-deliverable/506>
- Yield evidence snapshot: <https://mandate-bnb-agent.vercel.app/evidence/yield-route-reference.json>
- TermiX Agent Advantage Report: <https://mandate-bnb-agent.vercel.app/evidence/MANDATE-Agent-Advantage-Report.pdf>

## What is real

- Four ERC-8004 identities on BSC Testnet.
- Live public registry context.
- Live read-only YieldRoute and Venus data retrieval.
- Three measured Agent Advantage task pairs and their raw outputs.
- Seven successful Job #506 transactions, exact 0.1 test U escrow, completed settlement and zero residual allowance.

## What is intentionally labelled sample

- Historical candidate mandates, capital observed and profitability-like card metrics outside the verified benchmark.
- MANDATE does not claim mainnet execution, guaranteed yield or a profitable trading record.
