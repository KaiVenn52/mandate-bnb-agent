import { Download, ExternalLink, FileCheck2, ShieldCheck, Timer, WalletCards } from 'lucide-react'
import { formatEther } from 'viem'
import { useAccount, useBalance } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { Link } from 'react-router-dom'
import { advantageTasks } from '../data'
import { BenchmarkLab } from '../components/BenchmarkLab'
import { LiveVenusAgent } from '../components/LiveVenusAgent'

const configuredWallet = (import.meta.env.VITE_SUBMISSION_WALLET_ADDRESS ?? '0xD30BbB80c863c9B94622EF92337AaD65148D2EC3') as `0x${string}`
const providerWallet = '0x34ABe1790E6d67E25c7616799C2C6B7336932c7e'
const hires = [
  { task: 'A-01', job: 642, agent: 1806, category: 'Yield', tx: '0x65075a013ca176bf1e4c6abedd4de61bf94140ad227ca9cd100c298aa98b19df' },
  { task: 'A-02', job: 644, agent: 1805, category: 'Trading', tx: '0x110a45c0e374ab9297143a0dd428850141e29732bca5c7f678dbe0af9d88f1a9' },
  { task: 'A-03', job: 666, agent: 1807, category: 'Security', tx: '0xc939266cea840943359333fe83d99db50c91799bc9c64e2acbef297a083a13d1' },
]

export function EvidenceScreen() {
  const { address: connectedAddress, chainId, isConnected } = useAccount()
  const walletBalance = useBalance({ address: configuredWallet, chainId: bscTestnet.id, query: { enabled: true } })
  const isExpectedWallet = Boolean(connectedAddress && configuredWallet.toLowerCase() === connectedAddress.toLowerCase())
  const balanceLabel = walletBalance.data ? `${Number(formatEther(walletBalance.data.value)).toFixed(4)} tBNB` : walletBalance.isPending ? 'Checking…' : 'Unavailable'

  return (
    <section className="evidence-screen page-gutter">
      <div className="report-heading">
        <div><span className="section-kicker">TERMIX QUALIFIED EVIDENCE · THREE INDEPENDENT ERC-8183 HIRES</span><h1>Agent Advantage Evidence Lab</h1><p>Three frozen tasks were completed by independently hired marketplace agents and compared with the original browser-timed human path. Every agent result is bound to a completed BSC Testnet job.</p></div>
        <div className="report-actions"><a className="button button-primary" href="/evidence/MANDATE-Agent-Advantage-Report.pdf" target="_blank" rel="noreferrer"><Download size={16} /> Download final report</a></div>
      </div>

      <section className="hire-proof-grid" aria-label="Independent ERC-8183 hire evidence">
        {hires.map((hire) => <article className="hire-proof-card" key={hire.job}><div><span className="mono">{hire.task} · {hire.category}</span><strong>Job #{hire.job} · Agent #{hire.agent}</strong></div><p>COMPLETED · 0.1 test U · separate provider</p><div><a href={`/api/benchmarks/${hire.task}/hire-deliverable/${hire.job}`} target="_blank" rel="noreferrer">Deliverable <ExternalLink size={12} /></a><a href={`https://testnet.bscscan.com/tx/${hire.tx}`} target="_blank" rel="noreferrer">Onchain proof <ExternalLink size={12} /></a></div></article>)}
      </section>

      <section className="wallet-readiness" aria-labelledby="wallet-readiness-title">
        <div><small>Submission wallet</small><h2 id="wallet-readiness-title" className="mono">{configuredWallet}</h2><div className="wallet-links"><a href={`https://testnet.bscscan.com/address/${configuredWallet}`} target="_blank" rel="noreferrer">Client on explorer <ExternalLink size={13} /></a><a href={`https://testnet.bscscan.com/address/${providerWallet}`} target="_blank" rel="noreferrer">Provider on explorer <ExternalLink size={13} /></a><Link to="/register">ERC-8004 identities</Link></div></div>
        <dl><div><dt>Network</dt><dd>BSC Testnet · 97</dd></div><div><dt>Gas balance</dt><dd className={walletBalance.data?.value === 0n ? 'danger' : ''}>{balanceLabel}</dd></div><div><dt>Connected signer</dt><dd>{!isConnected ? 'Not connected' : isExpectedWallet && chainId === bscTestnet.id ? 'Ready' : 'Wrong wallet or network'}</dd></div></dl>
      </section>

      <div className="report-meta"><div><small>Final report</small><strong className="mono">AAR-2026-0827</strong></div><div><small>Qualification status</small><strong>3 / 3 independent hires</strong></div><div><small>Completed jobs</small><strong className="mono">#642 · #644 · #666</strong></div><div><small>High-stakes categories</small><strong>Trading + security</strong></div><span className="report-verified"><ShieldCheck size={17} /> Onchain + raw pairs verified</span></div>
      <div className="report-summary"><div><Timer size={18} /><span><small>Median paired speedup</small><strong className="mono">474.5×</strong></span></div><div><WalletCards size={18} /><span><small>Marketplace service cost</small><strong className="mono">0.1 test U / task</strong></span></div><div><FileCheck2 size={18} /><span><small>Qualified evidence bundles</small><strong className="mono">3 / 3</strong></span></div></div>

      <LiveVenusAgent />
      <BenchmarkLab />

      <section className="ab-report" aria-labelledby="ab-title">
        <div className="ab-header"><div><h2 id="ab-title">Hire-backed A/B task results</h2><p>Identical frozen input and pre-committed 10-point rubric on both paths.</p></div><span className="mono muted">Recorded 26 Aug 2026 · BSC Testnet</span></div>
        <div className="ab-table-head" aria-hidden="true"><span>Task</span><span>Agent path</span><span>Human path</span><span>Quality rubric</span><span>Evidence</span></div>
        {advantageTasks.map((task, index) => <article className="ab-row" key={task.id}><div className="ab-task"><small className="mono">{task.id}</small><strong>{task.task}</strong><span>{task.category}</span></div><div><small>Independent marketplace hire</small><strong className="mono">{task.agentTime}</strong><span>{task.agentCost}</span></div><div><small>Human, no agent</small><strong className="mono">{task.baselineTime}</strong><span>{task.baselineCost}</span></div><div><strong>{task.qualityDelta}</strong><span>Same locked 10-point rubric</span></div><div><span>{task.evidence}</span><a href="#benchmark-lab-title">Verify and re-run</a></div><span className="ab-index mono">0{index + 1}</span></article>)}
      </section>

      <section className="methodology"><div><h2>Methodology</h2><p>Human time runs from worksheet start to submitted answer. Agent time is the measured production API round trip after onchain hire verification; A-01's 2.99-second cold start is retained. Quality uses a task-specific rubric locked before either path ran.</p></div><div><h2>Evidence policy</h2><p>Each result exposes raw JSON, job ID, different client/provider addresses, budget and public deliverable. Test U and tBNB have no claimed fiat value; complete lifecycle gas was not aggregated, and no profitability claim is made.</p></div></section>
    </section>
  )
}
