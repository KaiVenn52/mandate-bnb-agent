import { useState } from 'react'
import { Activity, CheckCircle2, Download, ExternalLink, Radar, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { runVenusRiskAgent, type VenusRiskEvidence } from '../services/venusRisk'

const submissionWallet = import.meta.env.VITE_SUBMISSION_WALLET_ADDRESS ?? '0xD30BbB80c863c9B94622EF92337AaD65148D2EC3'

function downloadEvidence(evidence: VenusRiskEvidence) {
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `mandate-venus-risk-${evidence.source.block_number}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function LiveVenusAgent({ onVerified, displayAgentId, displayAgentName }: { onVerified?: (verified: boolean) => void; displayAgentId?: string; displayAgentName?: string }) {
  const { address } = useAccount()
  const [account, setAccount] = useState(address ?? submissionWallet)
  const [minimumBuffer, setMinimumBuffer] = useState('1000')
  const [evidence, setEvidence] = useState<VenusRiskEvidence | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const agentIdLabel = displayAgentId ?? '1807'
  const agentNameLabel = displayAgentName ?? 'LiqShield'

  async function run() {
    onVerified?.(false)
    setError('')
    setEvidence(null)
    if (!isAddress(account)) {
      setError('Enter a valid EVM wallet address.')
      return
    }
    const buffer = Number(minimumBuffer)
    if (!Number.isFinite(buffer) || buffer < 0) {
      setError('Minimum buffer must be zero or greater.')
      return
    }
    setRunning(true)
    try {
      setEvidence(await runVenusRiskAgent(account, buffer))
      onVerified?.(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Live agent run failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="live-agent" aria-labelledby="live-agent-title">
      <header className="live-agent-heading">
        <div>
          <span className="section-kicker">LIVE CAPABILITY · BNB CHAIN MAINNET DATA · READ ONLY</span>
          <h2 id="live-agent-title">{agentNameLabel} · Venus liquidation-buffer agent</h2>
          <p>Reads the official Venus Comptroller at one pinned block, applies your risk mandate, and produces a hash-verifiable deliverable. It cannot move funds.</p>
        </div>
        <span className="live-agent-badge"><Radar size={15} /> AGENT #{agentIdLabel}</span>
      </header>

      <div className="live-agent-console">
        <div className="live-agent-form">
          <label>Wallet to inspect<input value={account} onChange={(event) => setAccount(event.target.value)} spellCheck={false} /></label>
          <label>Minimum liquidation buffer (USD)<input type="number" min="0" step="100" value={minimumBuffer} onChange={(event) => setMinimumBuffer(event.target.value)} /></label>
          <button className="button button-primary" type="button" disabled={running} onClick={run}>
            <Activity size={16} /> {running ? 'Reading pinned block…' : 'Run live risk agent'}
          </button>
          <small>No signature · no approval · no transaction</small>
        </div>

        <div className="live-agent-output" aria-live="polite">
          {!evidence && !error && <div className="live-agent-idle"><Radar size={28} /><strong>Ready to inspect a public wallet address</strong><span>The result will include the exact block, Comptroller, observations and SHA-256 evidence hash.</span></div>}
          {error && <div className="live-agent-error"><ShieldAlert size={20} /><span><strong>Agent could not complete the live read</strong>{error}</span></div>}
          {evidence && (
            <>
              <div className={`live-agent-decision ${evidence.decision.severity}`}>
                <CheckCircle2 size={21} />
                <span><small>Decision</small><strong>{evidence.decision.status.replaceAll('_', ' ')}</strong></span>
                <span><small>Liquidation buffer</small><strong className="mono">${evidence.observation.liquidity_buffer_usd}</strong></span>
                <span><small>Shortfall</small><strong className="mono">${evidence.observation.shortfall_usd}</strong></span>
              </div>
              <p className="live-agent-recommendation">{evidence.decision.recommendation}</p>
              <dl className="live-agent-proof">
                <div><dt>Source block</dt><dd><a href={`https://bscscan.com/block/${evidence.source.block_number}`} target="_blank" rel="noreferrer" className="mono">{evidence.source.block_number} <ExternalLink size={12} /></a></dd></div>
                <div><dt>Entered markets</dt><dd className="mono">{evidence.observation.entered_market_count}</dd></div>
                <div><dt>Evidence SHA-256</dt><dd className="mono">{evidence.evidence_sha256}</dd></div>
              </dl>
              <div className="yield-evidence-actions"><div><button className="button button-outline compact-button" type="button" onClick={() => downloadEvidence(evidence)}><Download size={15} /> Download deliverable</button><Link className="button button-primary compact-button" to={`/activate?category=health&agent=${agentIdLabel}`}>Start bounded testnet hire</Link></div><small>Pinned-block analysis; ERC-8183 service hire requires explicit wallet signatures.</small></div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
