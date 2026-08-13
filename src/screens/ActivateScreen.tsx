import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { getCategory } from '../catalog'
import { fetchGatewayHealth, previewJob } from '../services/jobGateway'
import { loadMandateDraft } from '../services/mandateDraft'

type ActivationState = 'review' | 'signing' | 'active' | 'revoked'

const timeline = [
  ['CREATED', 'Mandate created', '14:32:11', '0x9c1d…e4b7f2'],
  ['FUNDED', 'Capital reserved', '14:32:28', '0x3a7b…9d1c2e'],
  ['DELIVERED', 'Yield route delivered', '21:48:57', '0x7f2e…a8b4c3'],
  ['SETTLED', 'Results settled', '21:49:12', '0x1d4a…c9e8f0'],
]

export function ActivateScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const category = getCategory(searchParams.get('category'))
  const agent = category.agents.find((item) => item.id === searchParams.get('agent')) ?? category.agents[0]
  const auth = category.authorization
  const draft = loadMandateDraft()
  const mandatePrompt = draft?.categoryId === category.id ? draft.prompt : category.prompt
  const [state, setState] = useState<ActivationState>('review')
  const [copied, setCopied] = useState('')
  const [gatewayMessage, setGatewayMessage] = useState('')
  const gateway = useQuery({
    queryKey: ['mandate-gateway-health'],
    queryFn: ({ signal }) => fetchGatewayHealth(signal),
    retry: 0,
    staleTime: 30_000,
  })

  const copyValue = async (value: string) => {
    await navigator.clipboard?.writeText(value)
    setCopied(value)
    window.setTimeout(() => setCopied(''), 1500)
  }

  const activate = async () => {
    setState('signing')
    setGatewayMessage('')
    if (gateway.data?.ok) {
      try {
        const previewProvider = agent.providerAddress ?? '0x0000000000000000000000000000000000000000'
        const result = await previewJob({
          provider: previewProvider,
          description: mandatePrompt,
          budgetWei: 100_000_000_000_000_000,
          durationSeconds: category.id === 'grid' ? 259_200 : 604_800,
        })
        setGatewayMessage(
          agent.providerAddress
            ? `Gateway validated ${result.lifecycle.length} ERC-8183 steps on ${result.network}.`
            : `Gateway validated ${result.lifecycle.length} ERC-8183 steps on ${result.network}; the sample provider remains unassigned.`,
        )
        setState('active')
      } catch (error) {
        setGatewayMessage(error instanceof Error ? error.message : 'Gateway preview failed.')
        setState('review')
      }
      return
    }
    window.setTimeout(() => {
      setGatewayMessage('Local permission preview prepared. Start the gateway to validate the ERC-8183 request shape.')
      setState('active')
    }, 900)
  }

  const agentReference = agent.providerAddress ?? `sample:${category.id}:${agent.id}`
  const monogram = agent.name.replace(/[^A-Z]/g, '').slice(0, 2) || agent.name.slice(0, 2).toUpperCase()

  return (
    <section className="activate-screen page-gutter">
      <div className="preview-banner" role="status">
        <ShieldCheck size={16} />
        <strong>PREVIEW MODE</strong>
        <span>
          No transaction is broadcast. Gateway:{' '}
          {gateway.isPending ? 'checking…' : gateway.data?.ok ? `${gateway.data.network} ready` : 'offline'}.
        </span>
      </div>
      <div className="activate-heading">
        <div>
          <h1>Review and activate</h1>
          <p>Grant one agent a bounded onchain mandate. Every permission remains visible.</p>
        </div>
        {state === 'active' && <span className="live-status"><span className="network-dot" /> PREVIEW ACTIVE · WITHIN LIMITS</span>}
        {state === 'revoked' && <span className="revoked-status">REVOKED</span>}
      </div>

      <div className="activation-grid">
        <section className="authorization-contract" aria-labelledby="contract-title">
          <div className="selected-agent">
            <div className="agent-monogram" aria-hidden="true">{monogram}</div>
            <div><small>Selected agent</small><h2>{agent.name}</h2><span>{category.label} agent</span></div>
            <span className="identity-verified"><ShieldCheck size={17} /> {agent.providerAddress ? 'BSC identity' : 'Identity sample'}</span>
            <button className="icon-button" type="button" aria-label="Copy agent ID" onClick={() => copyValue(agentReference)}>
              {copied === agentReference ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>

          <div className="contract-body">
            <h3 id="contract-title">Your mandate</h3>
            <div className="contract-terms">
              <dl>
                <div><dt>Goal</dt><dd>{auth.goal}</dd></div>
                <div><dt>Asset</dt><dd className="mono">{auth.asset}</dd></div>
                <div><dt>Maximum capital</dt><dd className="mono">{auth.capital}</dd></div>
                <div><dt>Maximum spend</dt><dd className="mono">{auth.maxSpend}</dd></div>
                <div><dt>Duration</dt><dd className="mono">{auth.duration}</dd></div>
              </dl>
              <dl>
                <div><dt>Allowed protocols</dt><dd>{auth.protocols}</dd></div>
                <div><dt>Allowed actions</dt><dd>{auth.actions}</dd></div>
                <div><dt>Expiry</dt><dd className="mono">{auth.expiry}</dd></div>
                <div><dt>Control</dt><dd>Revoke anytime</dd></div>
              </dl>
            </div>

            <div className="permission-columns">
              <div>
                <h4>This agent may</h4>
                {auth.may.map((item) => <p key={item}><CheckCircle2 size={16} />{item}</p>)}
              </div>
              <div>
                <h4>This agent may not</h4>
                {auth.mayNot.map((item) => <p key={item}><X size={16} />{item}</p>)}
              </div>
            </div>
          </div>
          <div className="contract-actions">
            <button className="button button-secondary" type="button" onClick={() => navigate(`/results?category=${category.id}`)}><ArrowLeft size={16} /> Back to comparison</button>
            {state === 'review' && (
              <button className="button button-primary" type="button" onClick={activate}>Preview activation <ArrowRight size={17} /></button>
            )}
            {state === 'signing' && <button className="button button-primary" type="button" disabled aria-busy="true">Preparing ERC-8183 job…</button>}
            {state === 'active' && <span className="activation-confirmed"><CheckCircle2 size={17} /> Preview prepared</span>}
            {state === 'revoked' && <span className="muted">No agent permissions remain.</span>}
          </div>
          {gatewayMessage ? <div className="gateway-result" role="status">{gatewayMessage}</div> : null}
        </section>

        <aside className="transaction-simulation">
          <div className="simulation-heading"><h2>Transaction simulation</h2><span className="safe-label">PREVIEW</span></div>
          <dl>
            <div><dt>Network</dt><dd>BNB Chain Testnet</dd></div>
            <div><dt>Contract</dt><dd className="mono">ERC-8183 gateway</dd></div>
            <div><dt>Function</dt><dd className="mono">prepareJob(…)</dd></div>
            <div><dt>Gas estimate</dt><dd className="mono">132,416</dd></div>
            <div><dt>Total cost (max)</dt><dd className="mono">$0.03</dd></div>
          </dl>
          <div className="simulation-separator" />
          <h3>Wallet & network confirmation</h3>
          <dl>
            <div><dt>Network</dt><dd>Chain ID 97 <CheckCircle2 size={15} /></dd></div>
            <div><dt>Allowance check</dt><dd>Not checked</dd></div>
            <div><dt>Daily spend headroom</dt><dd className="mono">$50.00</dd></div>
          </dl>
          <div className="simulation-note"><ShieldCheck size={18} /><p>The agent cannot exceed these encoded limits. This preview never asks you to sign blind.</p></div>
        </aside>
      </div>

      {(state === 'active' || state === 'revoked') && (
        <section className={`live-mandate ${state}`} aria-labelledby="live-title">
          <div className="live-heading">
              <div><h2 id="live-title">Mandate preview overview</h2><span className="live-status"><span className="network-dot" /> {state === 'active' ? 'PREVIEW · WITHIN LIMITS' : 'REVOKED'}</span></div>
            {state === 'active' && <button className="button button-danger compact-button" type="button" onClick={() => setState('revoked')}><Trash2 size={16} /> Revoke mandate</button>}
          </div>
          <div className="live-metrics">
            {[
              ['Capital ceiling', auth.capital, auth.asset],
              [category.primaryMetricLabel, agent.shadow.primary, category.primaryMetricSupport],
              ['Baseline', agent.shadow.baseline, 'Same input snapshot'],
              ['Agent advantage', agent.shadow.advantage, 'vs baseline'],
              ['Execution cost', agent.shadow.cost, `Limit ${auth.maxSpend}`],
              ['Expires', auth.duration, auth.expiry],
            ].map(([label, value, support]) => (
              <div key={label}><small>{label}</small><strong className={`mono ${label === 'Agent advantage' ? 'positive' : ''}`}>{value}</strong><span>{support}</span></div>
            ))}
          </div>

          <div className="execution-grid">
            <div className="job-timeline">
              <h3>Job timeline (ERC-8183)</h3>
              <div className="timeline-head"><span>Step</span><span>Status</span><span>Timestamp</span><span>Tx hash</span><span>Verification</span></div>
              {timeline.map(([step, status, time, hash], index) => (
                <div className="timeline-row" key={step}>
                  <span><i>{index + 1}</i><strong>{step}</strong></span>
                  <span>{status}</span><span className="mono">{time}</span>
                  <button type="button" className="copy-hash mono" onClick={() => copyValue(hash)}>{hash} {copied === hash ? <Check size={13} /> : <Copy size={13} />}</button>
                  <span className="muted"><Check size={14} /> Preview</span>
                </div>
              ))}
            </div>

            <aside className="proof-receipt">
              <div className="receipt-heading"><h3>MANDATE PREVIEW #004821</h3><span>NOT BROADCAST</span></div>
              <dl>
                <div><dt>Agent</dt><dd>{agent.name} · {agent.id}</dd></div>
                <div><dt>Result</dt><dd className="mono">{agent.shadow.primary}</dd></div>
                <div><dt>Baseline</dt><dd className="mono">{agent.shadow.baseline}</dd></div>
                <div><dt>Agent Advantage</dt><dd className="mono positive">{agent.shadow.advantage}</dd></div>
                <div><dt>Cost</dt><dd className="mono">{agent.shadow.cost}</dd></div>
                <div><dt>Jobs</dt><dd className="mono">ERC-8183 #4821</dd></div>
                <div><dt>Evidence</dt><dd>3 transactions</dd></div>
              </dl>
              <div className="receipt-actions">
                <a className="button button-outline" href="https://testnet.bscscan.com" target="_blank" rel="noreferrer">Open BSC explorer <ExternalLink size={15} /></a>
                <button className="button button-secondary" type="button" onClick={() => navigate('/evidence')}><FileCheck2 size={15} /> View evidence</button>
              </div>
            </aside>
          </div>
        </section>
      )}
    </section>
  )
}
