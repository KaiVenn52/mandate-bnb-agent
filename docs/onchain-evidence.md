# MANDATE onchain identity evidence

Verified independently against BSC Testnet RPC on 2026-08-12.

## Shared facts

- Chain ID: `97`
- Identity Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Owner: `0xD30BbB80c863c9B94622EF92337AaD65148D2EC3`
- Public service: `https://mandate-bnb-agent.vercel.app/api/health`
- Agent URI format: EIP-8004 registration-v1 base64 data URI
- SDK attribution metadata: `https://github.com/bnb-chain/bnbagent-sdk#v0.4.2`

## Registrations

| Category | Agent | Agent ID | Block | Transaction |
|---|---|---:|---:|---|
| LP Rebalancing | RangeGuard | 1804 | 124491196 | [0x634789…96d60](https://testnet.bscscan.com/tx/0x6347892a3647919efde0b145698771678b42b24c8d717df7f2b8588919f96d60) |
| Grid Trading | GridPilot | 1805 | 124491358 | [0x9aff5b…d4542](https://testnet.bscscan.com/tx/0x9aff5b7f4ef4ad2236d4c1b3821f4cd63882de540c476a7ffe13c33e1d8d4542) |
| Yield Optimisation | YieldRoute | 1806 | 124491457 | [0xe00a95…a8198](https://testnet.bscscan.com/tx/0xe00a95305b3b28637d6de96b31b6cf0e87d84acac49a31d7b4a1f2add44a8198) |
| Health Factor Monitoring | LiqShield | 1807 | 124491531 | [0x27237d…61100](https://testnet.bscscan.com/tx/0x27237dab5509726b660be6e2d13d13296cc34a2c33312b01f1f8cd1f69261100) |

Candidate performance metrics remain demo data until separate ERC-8183 jobs and TermiX A/B runs generate execution evidence. The real identity status must not be interpreted as verification of those performance claims.

## ERC-8183 YieldRoute proof - Job #506

Verified independently through BSC Testnet RPC on 2026-08-13.

- Commerce: `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`
- Router: `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`
- Optimistic policy: `0xd6a4217588f6b1f5657a92a3e94e6422ad771cea`
- Test U token: `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`
- Client/provider: submission wallet above
- Agent: YieldRoute ERC-8004 Agent #1806
- Budget and escrow: exactly `0.1 test U`
- Deliverable hash: `0xd860391e80df0dec17e851d3ad8e12ef0e20044411aba687da7e366948f0f999`
- Evidence SHA-256: `be4e4264f3b5d106ec9f8517c4ddf9292b8b107b92e871243d8702c9302d6d3c`
- Public manifest: `https://mandate-bnb-agent.vercel.app/api/erc8183/yield-deliverable/506`
- Public evidence: `https://mandate-bnb-agent.vercel.app/evidence/yield-route-reference.json`
- Final job status: `COMPLETED (3)`
- Final U allowance: `0 U`
- Final wallet U balance: `10 U` (escrow returned at settlement)

| Step | UTC | Block | Transaction |
|---|---|---:|---|
| Create YieldRoute proof job | 2026-08-13 12:34:29 | 124840213 | [0x354c0d...2fd9d](https://testnet.bscscan.com/tx/0x354c0df6629eec36cb463d32a17b5a907af6f6691bd3630e0ae0b85c2922fd9d) |
| Bind current optimistic policy | 2026-08-13 12:34:37 | 124840230 | [0x2bc1a3...ee04e](https://testnet.bscscan.com/tx/0x2bc1a33338a898eb67cdf789ef543a267922f4817149934bbdd5d42e388ee04e) |
| Set exact 0.1 U budget | 2026-08-13 12:34:41 | 124840240 | [0xa6441a...fa22c](https://testnet.bscscan.com/tx/0xa6441a3dde0295099d3193683199e76f03aaced1f266f6b536fadb766bdfa22c) |
| Approve exactly 0.1 U | 2026-08-13 12:34:47 | 124840254 | [0xd003e7...f0a89](https://testnet.bscscan.com/tx/0xd003e7bdeedd9cb052ec46513d8b6ea7b8dad6bbc0a3c689fdbe2667158f0a89) |
| Fund escrow; allowance clears | 2026-08-13 12:34:53 | 124840266 | [0xc56089...88061](https://testnet.bscscan.com/tx/0xc560894d243e963531dc6848a99c18bffb9571970f06abdb308dc13c2b088061) |
| Submit hash-verifiable YieldRoute deliverable | 2026-08-13 12:34:58 | 124840277 | [0x73f98a...eff1](https://testnet.bscscan.com/tx/0x73f98a37fa2277e543e468d5ca28ebc737acf687baed4b2fc1380d0519d8eff1) |
| Settle after optimistic dispute window | 2026-08-13 14:26:33 | 124855156 | [0xf423d6...f043](https://testnet.bscscan.com/tx/0xf423d6403c8e7926ea0e125c3b216226b95856fc836293645ef14c8ae531f043) |

Job #506 is the primary submission proof because its deliverable is the public YieldRoute live-data report shown in the marketplace. The longer wall-clock lifecycle includes the mandatory optimistic window and user-paced wallet confirmations; it is not presented as agent execution speed.

## ERC-8183 controlled pilot — Job #478

Verified independently through BSC Testnet RPC logs on 2026-08-12.

- Commerce: `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`
- Router: `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`
- Optimistic policy: `0xd6a4217588f6b1f5657a92a3e94e6422ad771cea`
- Test U token: `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`
- Client/provider: submission wallet above
- Budget and escrow: exactly `0.1 U`
- Deliverable hash: `0x7cd7a5dadc52b9eaf16510db2eb68e7a46d9419e796d692dd078a1dee14d43a4`
- Public manifest: `https://mandate-bnb-agent.vercel.app/api/erc8183/deliverable/478`
- Final job status: `COMPLETED (3)`
- Final U allowance: `0 U`
- Final wallet U balance: `10 U` (escrow returned at settlement)

| Step | UTC | Block | Transaction |
|---|---|---:|---|
| Create pilot job | 2026-08-11 18:14:47 | 124501590 | [0x004e7a…5404](https://testnet.bscscan.com/tx/0x004e7a0168201b2b7ec2aa9ca2923d26d5719058b452e65589ae9c36330a5404) |
| Bind current optimistic policy | 2026-08-11 18:43:04 | 124505361 | [0xd1ba80…d27a](https://testnet.bscscan.com/tx/0xd1ba806dd1ba3ffa25ceb2bbdfdca26f38fd4a911a2b752fcbac8b4de94ad27a) |
| Set exact 0.1 U budget | 2026-08-11 18:44:17 | 124505522 | [0x775449…ba50](https://testnet.bscscan.com/tx/0x77544909d6cc2700e4de534232944d0ead71f14a62e77a0960bb0eafdaf3ba50) |
| Approve exactly 0.1 U | 2026-08-11 18:52:14 | 124506582 | [0x192040…0564](https://testnet.bscscan.com/tx/0x1920401baed7f0d7f1a84aae47b97f159bc65efaf333b8fa31aff99939b90564) |
| Fund escrow; allowance clears | 2026-08-11 18:54:44 | 124506917 | [0x1d76b9…5525](https://testnet.bscscan.com/tx/0x1d76b97a604108775b8e7fdfb26d9d67ad9728d7185e8a102f1cdff0dd465525) |
| Submit SDK-compatible deliverable | 2026-08-11 18:57:05 | 124507230 | [0xb362b3…6eea](https://testnet.bscscan.com/tx/0xb362b3f21cd4481bcd4deaf20a003f6383e30b410c1e61659ba4555b97666eea) |
| Settle after 15-minute dispute window | 2026-08-11 19:18:09 | 124510039 | [0xb6c512…4f1e](https://testnet.bscscan.com/tx/0xb6c5121ff9d1af2562efa2cd6dafe87b42ec2927fcaff820658adae364df4f1e) |

The full user-paced lifecycle took 63 minutes 22 seconds from creation to settlement. This duration includes wallet handoffs, troubleshooting, and the mandatory optimistic dispute window; it is protocol evidence, not an agent-speed claim.

### SDK deployment-registry drift

`bnbagent` 0.4.2 still contained a retired policy address (`0x4F4678…`). The current upstream apex-contracts deployment registry uses `0xd6a421…`, which the Router whitelist confirmed. MANDATE pins the current upstream address explicitly until the SDK preset catches up. The initially reverted registration was not broadcast beyond the confirmed prior step and is excluded from the successful lifecycle table.
