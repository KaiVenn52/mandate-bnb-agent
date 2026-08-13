import { Download, ExternalLink, FileCheck2, ShieldCheck, Timer, WalletCards } from 'lucide-react'
import { formatEther } from 'viem'
import { useAccount, useBalance } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { Link } from 'react-router-dom'
import { advantageTasks } from '../data'
import { BenchmarkLab } from '../components/BenchmarkLab'
import { LiveVenusAgent } from '../components/LiveVenusAgent'

const configuredWallet = (
  import.meta.env.VITE_SUBMISSION_WALLET_ADDRESS ?? '0xD30BbB80c863c9B94622EF92337AaD65148D2EC3'
) as `0x${string}`
const walletExplorerUrl = configuredWallet
  ? `https://testnet.bscscan.com/address/${configuredWallet}`
  : 'https://testnet.bscscan.com'

export function EvidenceScreen() {
  const { address: connectedAddress, chainId, isConnected } = useAccount()
  const walletBalance = useBalance({
    address: configuredWallet,
    chainId: bscTestnet.id,
    query: { enabled: Boolean(configuredWallet) },
  })
  const isExpectedWallet = Boolean(
    configuredWallet && connectedAddress && configuredWallet.toLowerCase() === connectedAddress.toLowerCase(),
  )
  const balanceLabel = walletBalance.data
    ? `${Number(formatEther(walletBalance.data.value)).toFixed(4)} tBNB`
    : walletBalance.isPending
      ? 'Checking…'
      : 'Unavailable'

  return (
    <section className="evidence-screen page-gutter">
      <div className="report-heading">
        <div>
          <span className="section-kicker">VERIFIED PAIRED RUNS · 12 AUG 2026</span>
          <h1>Agent Advantage Report</h1>
          <p>Measured agent performance against the same task completed without an agent.</p>
        </div>
        <div className="report-actions">
          <a className="button button-outline" href="/evidence/agent-advantage-report.html" target="_blank" rel="noreferrer"><Download size={16} /> Open verified report</a>
          <a className="button button-outline" href="/evidence/MANDATE-Agent-Advantage-Report.pdf" target="_blank" rel="noreferrer">PDF</a>
        </div>
      </div>

      <section className="yield-proof-source" aria-label="Completed ERC-8183 evidence">
        <FileCheck2 size={20} />
        <div>
          <strong>YieldRoute ERC-8183 Job #506 - COMPLETED</strong>
          <p>Seven successful BSC Testnet writes, exact 0.1 test U escrow returned, zero residual allowance, and a public SHA-256-bound deliverable.</p>
        </div>
        <a href="/evidence/evidence-passport-506.json" target="_blank" rel="noreferrer">Open Evidence Passport <ExternalLink size={13} /></a>
        <code>Settlement: 0xf423d6403c8e7926ea0e125c3b216226b95856fc836293645ef14c8ae531f043</code>
      </section>

      <section className="wallet-readiness" aria-labelledby="wallet-readiness-title">
        <div>
          <small>Submission wallet</small>
          <h2 id="wallet-readiness-title" className="mono">{configuredWallet ?? 'Not configured'}</h2>
          <div className="wallet-links">
            <a href={walletExplorerUrl} target="_blank" rel="noreferrer">Open BSC Testnet explorer <ExternalLink size={13} /></a>
            <Link to="/register">Register ERC-8004 identities</Link>
          </div>
        </div>
        <dl>
          <div><dt>Network</dt><dd>BSC Testnet · 97</dd></div>
          <div><dt>Gas balance</dt><dd className={walletBalance.data?.value === 0n ? 'danger' : ''}>{balanceLabel}</dd></div>
          <div><dt>Connected signer</dt><dd>{!isConnected ? 'Not connected' : isExpectedWallet && chainId === bscTestnet.id ? 'Ready' : 'Wrong wallet or network'}</dd></div>
        </dl>
      </section>

      <div className="report-meta">
        <div><small>Report</small><strong className="mono">AAR-2026-0812</strong></div>
        <div><small>Evaluation window</small><strong>12 Aug 2026 · completed</strong></div>
        <div><small>Recorded A/B tasks</small><strong className="mono">3 / 3</strong></div>
        <div><small>High-stakes categories</small><strong>Trading + security</strong></div>
        <span className="report-verified"><ShieldCheck size={17} /> Raw pairs hash-verified</span>
      </div>

      <div className="report-summary">
        <div><Timer size={18} /><span><small>Median paired speedup</small><strong className="mono">866.7×</strong></span></div>
        <div><WalletCards size={18} /><span><small>Observed cash-cost difference</small><strong className="mono">$0.00</strong></span></div>
        <div><FileCheck2 size={18} /><span><small>Recorded evidence bundles</small><strong className="mono">3 / 3</strong></span></div>
      </div>

      <LiveVenusAgent />

      <BenchmarkLab />

      <section className="ab-report" aria-labelledby="ab-title">
        <div className="ab-header">
          <div><h2 id="ab-title">Recorded A/B task results</h2><p>Identical frozen input and pre-committed 10-point rubric on both paths.</p></div>
          <span className="mono muted">TermiX evidence · 3 paired tasks complete</span>
        </div>
        <div className="ab-table-head" aria-hidden="true">
          <span>Task</span><span>Agent path</span><span>Human path</span><span>Quality rubric</span><span>Evidence</span>
        </div>
        {advantageTasks.map((task, index) => (
          <article className="ab-row" key={task.id}>
            <div className="ab-task"><small className="mono">{task.id}</small><strong>{task.task}</strong><span>{task.category}</span></div>
            <div><small>Marketplace agent</small><strong className="mono">{task.agentTime}</strong><span>{task.agentCost}</span></div>
            <div><small>Human, no agent</small><strong className="mono">{task.baselineTime}</strong><span>{task.baselineCost}</span></div>
            <div><strong>{task.qualityDelta}</strong><span>Same locked 10-point rubric</span></div>
            <div><span>{task.evidence}</span><a href="#benchmark-lab-title">Re-run evidence lab</a></div>
            <span className="ab-index mono">0{index + 1}</span>
          </article>
        ))}
      </section>

      <section className="methodology">
        <div><h2>Methodology</h2><p>Each pair used the same frozen JSON input and SHA-256 digest. Human time ran from task start to submitted answer; agent time is the browser-observed production API round trip. Quality used a category-specific rubric locked before either path ran.</p></div>
        <div><h2>Evidence policy</h2><p>Onchain facts link to transactions. Derived metrics expose their inputs. Self-reported claims are labelled and excluded from the verified advantage calculation.</p></div>
      </section>
    </section>
  )
}
