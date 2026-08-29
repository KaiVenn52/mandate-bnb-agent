# MANDATE onchain runbook

## Public submission wallet

- Address: `0xD30BbB80c863c9B94622EF92337AaD65148D2EC3`
- Network: BSC Testnet
- Chain ID: `97`
- Explorer: https://testnet.bscscan.com/address/0xD30BbB80c863c9B94622EF92337AaD65148D2EC3
- Read-only check on 2026-08-12: `0 tBNB`, nonce `0`, no deployed bytecode

This repository never needs the wallet's seed phrase or private key. Signing must happen in the owner's wallet or through a locally encrypted BNB Agent SDK keystore controlled by the owner.

## Step 1: obtain test gas

Official instructions: https://docs.bnbchain.org/bnb-smart-chain/developers/faucet/

Request tBNB for the public address above through the official faucet, BNB Chain Discord, or the official Telegram support bot. The BNB Chain documentation currently states a limit of up to `0.3 tBNB` per user per day. Third-party faucets may impose extra eligibility requirements.

## Step 2: verify readiness

Before any write:

1. Confirm the connected wallet exactly matches the submission address.
2. Confirm the active network is BSC Testnet, chain ID `97`.
3. Confirm a non-zero tBNB balance.
4. Keep `MANDATE_LIVE_TRANSACTIONS=false` while preparing metadata and previewing requests.

## Step 3: register reference agents

Use `bnbagent.ERC8004Agent` with the encrypted SDK wallet to generate an EIP-8004 agent URI and register each reference identity. Record for every agent:

- agent name and category
- owner address
- agent ID
- transaction hash
- exact agent URI and service endpoint
- BscScan and 8004scan links

Registration names must correspond to the four product categories. Do not replace sample badges until the associated chain records can be opened by a reviewer.

## Step 4: execute ERC-8183 proof

Allowlist only registered provider addresses. Enable live mode for one bounded test job, then record the `create`, `register`, `set-budget`, and `fund` transaction results returned by the gateway. Never enable live mode with a broad or empty policy on a public deployment.

## Step 5: TermiX A/B evidence

Run all three predefined tasks from identical snapshots. Preserve raw outputs, UTC timestamps, total costs, evaluator rubric, transaction links, failures, and manual interventions. Only then replace the draft values in the Agent Advantage Report.

Current evidence status: this runbook's three qualifying hires are complete—YieldRoute Job #642, GridPilot Job #644, and LiqShield Job #666. Their raw outputs, job metadata, timings, costs and rubric results are published in `public/evidence/termix`, and the final hire-backed report is `public/evidence/MANDATE-Agent-Advantage-Report.pdf`. Any new benchmark run must preserve the same independent-hire and frozen-input rules rather than overwrite this evidence silently.
