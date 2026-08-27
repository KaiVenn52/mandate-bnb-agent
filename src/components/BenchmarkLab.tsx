import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Play, RefreshCw, UserRound } from 'lucide-react'
import {
  loadBenchmarks,
  runBenchmarkAgent,
  scoreHumanBaseline,
  type BenchmarkRun,
  type BenchmarkTask,
} from '../services/benchmarks'

type BaselineDraft = {
  startedAt: number
  decision: string
  metric: string
  rejected: string[]
  recommendation: string
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function BenchmarkLab() {
  const [tasks, setTasks] = useState<BenchmarkTask[]>([])
  const [agentRuns, setAgentRuns] = useState<Record<string, BenchmarkRun>>({})
  const [baselineRuns, setBaselineRuns] = useState<Record<string, BenchmarkRun>>({})
  const [drafts, setDrafts] = useState<Record<string, BaselineDraft>>({})
  const [busy, setBusy] = useState<string>()
  const [jobIds, setJobIds] = useState<Record<string, string>>({ 'A-01': '642', 'A-02': '644', 'A-03': '666' })
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void refreshTasks()
  }, [])

  async function refreshTasks() {
    setLoading(true)
    setError(undefined)
    try {
      setTasks(await loadBenchmarks())
    } catch {
      setError('The live benchmark API is unavailable. The verified report and recorded results remain available below.')
    } finally {
      setLoading(false)
    }
  }

  async function runAgent(task: BenchmarkTask) {
    setBusy(`agent-${task.id}`)
    setError(undefined)
    try {
      const jobId = Number(jobIds[task.id])
      if (!Number.isSafeInteger(jobId) || jobId <= 0) throw new Error('Enter the funded ERC-8183 Job ID used to hire this separate provider.')
      const result = await runBenchmarkAgent(task.id, jobId)
      setAgentRuns((current) => ({ ...current, [task.id]: result }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Agent run failed')
    } finally {
      setBusy(undefined)
    }
  }

  function startBaseline(task: BenchmarkTask) {
    setDrafts((current) => ({
      ...current,
      [task.id]: { startedAt: performance.now(), decision: '', metric: '', rejected: [], recommendation: '' },
    }))
  }

  function updateDraft(taskId: string, patch: Partial<BaselineDraft>) {
    setDrafts((current) => ({ ...current, [taskId]: { ...current[taskId], ...patch } }))
  }

  async function finishBaseline(task: BenchmarkTask) {
    const draft = drafts[task.id]
    if (!draft || !draft.decision || !draft.metric || draft.recommendation.trim().length < 20) return
    setBusy(`baseline-${task.id}`)
    setError(undefined)
    try {
      const result = await scoreHumanBaseline(task.id, {
        decision: draft.decision,
        metric: Number(draft.metric),
        rejected: draft.rejected,
        recommendation: draft.recommendation,
        elapsed_ms: Math.round(performance.now() - draft.startedAt),
      })
      setBaselineRuns((current) => ({ ...current, [task.id]: result }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Baseline scoring failed')
    } finally {
      setBusy(undefined)
    }
  }

  if (loading) {
    return <div className="benchmark-loading" aria-label="Loading evidence lab"><span /><span /><span /></div>
  }

  if (!tasks.length && error) {
    return (
      <div className="benchmark-unavailable" role="status">
        <AlertCircle size={19} aria-hidden="true" />
        <div><strong>Evidence lab temporarily unavailable</strong><p>{error}</p></div>
        <button className="button button-secondary compact-button" type="button" onClick={refreshTasks}><RefreshCw size={15} /> Retry</button>
      </div>
    )
  }

  return (
    <section className="benchmark-lab" aria-labelledby="benchmark-lab-title">
      <div className="benchmark-lab-heading">
        <div>
          <span className="section-kicker">TERMIX · REPRODUCIBLE EVIDENCE LAB</span>
          <h2 id="benchmark-lab-title">Run the same frozen task both ways</h2>
          <p>Agent output unlocks only after the API verifies a funded ERC-8183 job with a separate provider and the matching task category. The baseline timer starts when a human opens the worksheet.</p>
        </div>
        <span className="mono">3 / 3 VERIFIED HIRES</span>
      </div>
      {error && <div className="benchmark-error">{error}</div>}
      <div className="benchmark-task-list">
        {tasks.map((task) => {
          const agent = agentRuns[task.id]
          const baseline = baselineRuns[task.id]
          const draft = drafts[task.id]
          return (
            <article className="benchmark-task" key={task.id}>
              <header>
                <div><small className="mono">{task.id} · {task.category}</small><h3>{task.title}</h3></div>
                <span className={task.high_stakes ? 'benchmark-high-stakes' : 'benchmark-standard'}>{task.high_stakes ? 'HIGH-STAKES' : 'STANDARD'}</span>
              </header>
              <div className="benchmark-hash"><small>Frozen input SHA-256</small><code>{task.input_sha256}</code></div>
              <details><summary>Inspect identical input and pre-committed rubric</summary><pre>{JSON.stringify({ mandate: task.mandate, position: task.position, candidates: task.candidates, rubric: task.rubric }, null, 2)}</pre></details>
              <div className="benchmark-paths">
                <section>
                  <small>PATH A · MARKETPLACE AGENT</small>
                  {!agent ? (
                    <div className="baseline-form"><label>Funded ERC-8183 Job ID<input inputMode="numeric" placeholder="Separate client and provider required" value={jobIds[task.id] ?? ''} onChange={(event) => setJobIds((current) => ({ ...current, [task.id]: event.target.value.replace(/\D/g, '') }))} /></label><button className="button button-primary" disabled={Boolean(busy) || !jobIds[task.id]} onClick={() => runAgent(task)}><Play size={15} /> {busy === `agent-${task.id}` ? 'Verifying hire…' : 'Verify hire & run agent'}</button></div>
                  ) : (
                    <div className="benchmark-result"><CheckCircle2 size={17} /><div><strong>{agent.quality_score} / {agent.quality_max} quality · Job #{agent.marketplace_hire?.job_id}</strong><span>{agent.client_roundtrip_ms} ms browser round trip · {agent.server_compute_ms} ms compute · separate provider verified</span></div><button className="icon-button" aria-label="Download agent output" onClick={() => downloadJson(`${task.id}-agent.json`, agent)}><Download size={15} /></button></div>
                  )}
                </section>
                <section>
                  <small>PATH B · HUMAN, NO AGENT</small>
                  {!draft ? (
                    <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => startBaseline(task)}><UserRound size={15} /> Start human timer</button>
                  ) : baseline ? (
                    <div className="benchmark-result"><CheckCircle2 size={17} /><div><strong>{baseline.quality_score} / {baseline.quality_max} quality</strong><span>{Math.round((baseline.elapsed_ms ?? 0) / 1000)} sec · browser timed</span></div><button className="icon-button" aria-label="Download baseline output" onClick={() => downloadJson(`${task.id}-baseline.json`, baseline)}><Download size={15} /></button></div>
                  ) : (
                    <div className="baseline-form">
                      <label>Decision<select value={draft.decision} onChange={(event) => updateDraft(task.id, { decision: event.target.value })}><option value="">Choose…</option>{task.candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.id}</option>)}</select></label>
                      <label>Required metric<input inputMode="decimal" value={draft.metric} onChange={(event) => updateDraft(task.id, { metric: event.target.value })} /></label>
                      <fieldset><legend>Reject as non-compliant</legend>{task.candidates.map((candidate) => <label key={candidate.id}><input type="checkbox" checked={draft.rejected.includes(candidate.id)} onChange={(event) => updateDraft(task.id, { rejected: event.target.checked ? [...draft.rejected, candidate.id] : draft.rejected.filter((id) => id !== candidate.id) })} />{candidate.id}</label>)}</fieldset>
                      <label>Recommendation and reasons<textarea value={draft.recommendation} onChange={(event) => updateDraft(task.id, { recommendation: event.target.value })} /></label>
                      <button className="button button-primary" disabled={Boolean(busy) || !draft.decision || !draft.metric || draft.recommendation.trim().length < 20} onClick={() => finishBaseline(task)}>{busy === `baseline-${task.id}` ? 'Scoring…' : 'Stop timer & score'}</button>
                    </div>
                  )}
                </section>
              </div>
            </article>
          )
        })}
      </div>
      <p className="benchmark-disclaimer">The prefilled IDs are the three completed independent ERC-8183 hires used in the final report. Re-running verifies each job on BSC Testnet before executing the frozen task. Human timings are browser-measured and self-attested; agent timings are production round trips and include any cold start.</p>
    </section>
  )
}
