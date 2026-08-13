import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Box,
  CheckCircle2,
  Crosshair,
  Gauge,
  LockKeyhole,
  Pencil,
  Check,
  X,
  Repeat2,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react'
import { categories, categoryOrder } from '../catalog'
import type { CategoryId } from '../catalog'
import { editMandateField, loadMandateDraft, parseMandate, saveMandateDraft, type EditableMandateField } from '../services/mandateDraft'

const fieldIcons = [Crosshair, Banknote, ShieldCheck, Gauge, Repeat2, Box]

export function BuilderScreen() {
  const navigate = useNavigate()
  const savedDraft = useMemo(() => loadMandateDraft(), [])
  const [categoryId, setCategoryId] = useState<CategoryId>(savedDraft?.categoryId ?? 'yield')
  const category = categories[categoryId]
  const [prompt, setPrompt] = useState(savedDraft?.prompt ?? category.prompt)
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState<EditableMandateField | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const parsed = useMemo(() => parseMandate(prompt, categoryId), [prompt, categoryId])

  const startFieldEdit = (label: EditableMandateField, value: string) => {
    const editableValue = label === 'Risk'
      ? parsed.constraints.riskMax
      : label === 'Leverage'
        ? parsed.constraints.leverageMax === 0 ? 'none' : `${parsed.constraints.leverageMax}x`
        : label === 'Max actions'
          ? `${parsed.constraints.actionCap} per ${parsed.constraints.actionPeriod}`
          : label === 'Allowed protocols'
            ? parsed.constraints.protocols.join(', ') || 'none'
            : value
    setEditingField(label)
    setEditValue(editableValue)
    setEditError('')
  }

  const commitFieldEdit = () => {
    if (!editingField) return
    try {
      const nextPrompt = editMandateField(parsed, editingField, editValue)
      setPrompt(nextPrompt)
      setCategoryId(parseMandate(nextPrompt, categoryId).categoryId)
      setEditingField(null)
      setEditError('')
      setError('')
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : 'Enter a valid value.')
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (prompt.trim().length < 24) {
      setError('Add an outcome and at least one risk limit.')
      return
    }
    setError('')
    setIsBuilding(true)
    saveMandateDraft(parsed)
    window.setTimeout(() => navigate(`/results?category=${parsed.categoryId}`), 700)
  }

  return (
    <section className="builder-screen page-gutter">
      <div className="builder-grid">
        <div className="builder-intro">
          <div className="builder-eyebrow">OUTCOME-FIRST AGENT MARKETPLACE · BSC TESTNET</div>
          <h1>What do you want<br />your money to do?</h1>
          <p className="display-support">Set the outcome. Cap the risk. Hire the proof.</p>

          <form onSubmit={submit} className="mandate-form" noValidate>
            <label htmlFor="mandate-prompt">Describe your outcome and limits</label>
            <div className={`prompt-field ${error ? 'has-error' : ''}`}>
              <textarea
                id="mandate-prompt"
                ref={promptRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'mandate-error' : 'mandate-hint'}
                maxLength={500}
                spellCheck="true"
              />
              <span className="character-count mono">{prompt.length} / 500</span>
            </div>
            <div className="field-meta">
              <p id={error ? 'mandate-error' : 'mandate-hint'} className={error ? 'field-error' : 'field-hint'}>
                {error || 'Include capital, time horizon, risk limits, and forbidden actions.'}
              </p>
            </div>
            <button className="button button-primary build-button" type="submit" disabled={isBuilding} aria-busy={isBuilding}>
              {isBuilding ? 'Building mandate…' : 'Build mandate'}
              {!isBuilding && <ArrowRight size={19} aria-hidden="true" />}
            </button>
          </form>

          <div className="quick-routes" aria-label="Example mandates">
            {categoryOrder.map((id) => (
              <button
                className={categoryId === id ? 'is-active' : ''}
                key={id}
                type="button"
                onClick={() => {
                  setCategoryId(id)
                  setPrompt(categories[id].prompt)
                  setError('')
                }}
              >
                {categories[id].shortLabel}<ArrowRight size={15} aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="builder-proof-strip" aria-label="MANDATE safeguards">
            <span><LockKeyhole size={14} aria-hidden="true" /> Hard limits first</span>
            <span><ScanSearch size={14} aria-hidden="true" /> Simulate before signing</span>
            <span><ShieldCheck size={14} aria-hidden="true" /> Onchain receipts</span>
          </div>
        </div>

        <aside className="mandate-preview" aria-label="Live mandate preview">
          <div className="section-heading">
            <div>
              <h2>Live mandate preview</h2>
              <p>Natural language becomes bounded permissions.</p>
            </div>
          </div>
          <div className="preview-fields">
            {parsed.fields.map(({ label, value, support }, index) => {
              const Icon = fieldIcons[index]
              const isEditing = editingField === label
              return (
              <div className={`preview-row ${isEditing ? 'is-editing' : ''}`} key={label}>
                <Icon size={19} aria-hidden="true" />
                <span className="preview-label">{label}</span>
                {isEditing ? (
                  <div className="preview-editor">
                    {label === 'Risk' ? (
                      <select aria-label="Risk value" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus>
                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                      </select>
                    ) : (
                      <input
                        aria-label={`${label} value`}
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commitFieldEdit()
                          if (event.key === 'Escape') setEditingField(null)
                        }}
                        autoFocus
                      />
                    )}
                    {editError ? <small className="preview-edit-error">{editError}</small> : null}
                  </div>
                ) : (
                  <span className="preview-value mono">
                    {value}
                    {support && <small><span className="success-dot" />{support}</small>}
                  </span>
                )}
                {isEditing ? (
                  <span className="preview-edit-actions">
                    <button type="button" className="icon-button save" aria-label={`Save ${label}`} onClick={commitFieldEdit}><Check size={15} /></button>
                    <button type="button" className="icon-button" aria-label={`Cancel ${label}`} onClick={() => { setEditingField(null); setEditError('') }}><X size={15} /></button>
                  </span>
                ) : (
                  <button type="button" className="icon-button" aria-label={`Edit ${label}`} onClick={() => startFieldEdit(label as EditableMandateField, value)}>
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              )
            })}
          </div>
          <div className="bounded-note">
            <CheckCircle2 size={19} aria-hidden="true" />
            <div>
              <strong>Bounded permissions</strong>
              <p>Any action outside these limits requires your approval.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="evidence-ticker" aria-label="Example evidence record">
        <ShieldCheck size={18} aria-hidden="true" />
        <strong>Evidence record preview</strong>
        <span className="verified-label">Sample</span>
        <span className="mono muted">0x8f3a…c1d2</span>
        <span>Example: adjusted position on Venus</span>
        <span className="mono">Capital: 2,500 USDT</span>
        <span className="mono muted">2h ago</span>
      </div>

      <div className="next-preview" aria-hidden="true">
        <div>
          <h2>Next: Review {categories[parsed.categoryId].label} agents</h2>
          <p>{categories[parsed.categoryId].description}</p>
        </div>
        <span>Fit</span><span>Track record</span><span>Risk-adjusted return</span>
      </div>
    </section>
  )
}
