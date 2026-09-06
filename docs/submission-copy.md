# MANDATE submission copy

## Project name

MANDATE

## Tagline

Set the outcome. Cap the risk. Hire the proof.

## One-line description

An outcome-first BNB Chain agent marketplace that converts financial goals into enforceable limits, proves agent advantage, and settles verifiable work through ERC-8183.

## Project description

BNB Chain has a rapidly growing agent ecosystem, but a directory of agent cards does not answer the question that matters: which agent can safely deliver a user's financial outcome? Users must compare inconsistent claims, infer hidden risk and trust that an agent will stay inside its authority.

MANDATE starts with the outcome. A user describes the goal, capital, risk ceiling, leverage, action frequency and allowed protocols in natural language. MANDATE converts that request into visible, individually editable permissions, then ranks or rejects agents across LP rebalancing, grid trading, yield optimisation and health-factor monitoring. Every rejection includes the violated constraint.

Before any wallet action, live capability verification reads public BSC data and produces hash-verifiable, read-only evidence without requesting a signature or moving funds. The TermiX Evidence Lab separately compares each hired agent with a frozen no-agent baseline. When the user chooses to hire, the permission review preserves the exact parsed limits in the ERC-8183 description. A separate evaluator/client wallet creates and funds the job, the registered provider alone submits the deliverable, and settlement becomes permissionless after the optimistic window.

Agent #2054 / Job #873 is the primary independent-provider proof: an Open Mandate was assigned to a separate provider wallet, funded with 0.1 test U, executed by that provider, submitted by that provider and settled permissionlessly by a third wallet. The verified action is ERC-20 approve(Commerce, 1 base unit of test U); it is not a swap, liquidity routing, realized yield or a profitability record.

The four reference agents #1804-#1807 still share one legacy provider and offer read-only analysis. Independent Yield provider #2054 adds one provider-owned bounded BSC Testnet call. Rebalancing, Grid and Health do not yet have equivalent asset-execution depth. Two independent providers in every category and a real Grid trading track record remain incomplete. A distinct wallet proves wallet separation, not independent business ownership.

For the TermiX challenge, MANDATE gates each qualifying agent run behind a verified funded ERC-8183 job with separate client/provider wallets and a matching task category. Three independent hire-backed task pairs are complete: YieldRoute Job #642, GridPilot Job #644, and LiqShield Job #666. Their verified outputs, timings, service costs and quality scores are paired with the original browser-timed human baselines in the final Agent Advantage Report. The older direct-API outputs remain archived reproducibility data and are not counted as marketplace hires.

## What makes it different

- Outcome-first discovery rather than keyword search.
- Hard-limit rejection, not merely recommendation ranking.
- Four category-specific decision and evidence models.
- Live-data reports and completed-job receipts are separated from comparison fixtures, whose unverified historical metrics are withheld from marketplace ranking.
- Measured same-input agent-vs-human evidence.
- ERC-8004 identity plus a complete ERC-8183 job and settlement trail.
- Evaluator-wallet hiring with an explicit client-to-provider handoff and shareable job URL.
- Exact token approvals and zero residual allowance after settlement.
- External registry records are actionable when a public HTTPS endpoint returns a provider-signed acceptance for the exact mandate; otherwise MANDATE keeps the requirement unfunded and unassigned instead of pretending an invite is a hire.

## Links

- Live app: <https://mandate-bnb-agent.vercel.app>
- Primary passport (pending publication of this update): <https://mandate-bnb-agent.vercel.app/evidence/evidence-passport-873.json>
- Primary public manifest: <https://mandate-provider-yield.onrender.com/mandate/deliverables/873.json>
- Job #873 settlement: <https://testnet.bscscan.com/tx/0x413a64410246ae228b573ecd0900819ef9f9fadbcd866a3fc7e9848a41fc3b21>
- Job #506 settlement: <https://testnet.bscscan.com/tx/0xf423d6403c8e7926ea0e125c3b216226b95856fc836293645ef14c8ae531f043>
- Agent Advantage Report: <https://mandate-bnb-agent.vercel.app/evidence/MANDATE-Agent-Advantage-Report.pdf>
- Hire inventory: <https://mandate-bnb-agent.vercel.app/evidence/termix/onchain-hires.json>
- Submission wallet: `0xD30BbB80c863c9B94622EF92337AaD65148D2EC3`
- Source code: <https://github.com/KaiVenn52/mandate-bnb-agent>
- Demo video: `[ADD VIDEO URL AFTER RECORDING AND OWNER APPROVAL]`

## Track positioning

- Main track: outcome-first marketplace journey; equal execution depth across four categories remains a scoring weakness.
- Partner bounty: TermiX Challenge.
- MANDATE is not claiming Altana eligibility or PancakeSwap bounty eligibility in this submission package.

## Team

Kai Venn - solo builder; product, design and engineering.

## Truthful limitations

- BSC Testnet only for state-changing evidence.
- The four reference agents #1804-#1807 still share one legacy provider and offer read-only analysis. Independent Yield provider #2054 adds one provider-owned bounded BSC Testnet call. Rebalancing, Grid and Health do not yet have equivalent asset-execution depth. Two independent providers in every category and a real Grid trading track record remain incomplete. A distinct wallet proves wallet separation, not independent business ownership.
- Job #506 is a historical same-wallet mechanics proof; Jobs #642/#644/#666 remain the separate-client/provider TermiX task pairs, not three independent provider businesses.
- Provider #2054 is compromised and permanently testnet-only. Historical acceptance/assignment transaction evidence is not yet recovered by this audit; current job state and execution/submit/settlement receipts are independently verified.
- Candidate historical metrics without public receipts are withheld from hiring and ranking; a point-in-time live quote is not presented as performance history.
- The Agent Advantage sample contains three tasks and one human operator; it is not a universal productivity or profitability estimate.
