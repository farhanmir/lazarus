import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchRunTrace } from '../services/api'

const AGENT_LABELS = {
  advocate: 'Advocate',
  skeptic: 'Skeptic',
  judge: 'Judge',
  evidence_curator: 'Evidence Curator',
  effort_estimator: 'Effort Estimator',
  impact_predictor: 'Impact Predictor',
  follow_up_assistant: 'Follow-up Assistant',
}

function prettyAgentName(raw) {
  if (!raw) return 'Unknown Agent'
  if (AGENT_LABELS[raw]) return AGENT_LABELS[raw]
  return raw
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function readableOutput(raw) {
  if (!raw) return '—'
  try {
    const p = JSON.parse(raw)
    const lines = []
    const priority = [
      'proposed_disease', 'target_disease', 'confidence', 'final_confidence',
      'risk_level', 'verdict', 'final_decision', 'recommended_action',
      'evidence_summary', 'rationale', 'reasoning', 'summary',
    ]
    for (const key of priority) {
      if (p[key] == null) continue
      const label = key.replace(/_/g, ' ')
      const val = typeof p[key] === 'number'
        ? (key.includes('confidence') ? `${(p[key] * 100).toFixed(1)}%` : p[key].toFixed(3))
        : String(p[key])
      lines.push(`${label}: ${val}`)
    }
    for (const [key, val] of Object.entries(p)) {
      if (priority.includes(key)) continue
      if (typeof val !== 'string' || !val) continue
      lines.push(`${key.replace(/_/g, ' ')}: ${val}`)
    }
    return lines.length > 0 ? lines.join('\n') : raw
  } catch {
    return raw
  }
}

function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export default function AgentTrace() {
  const { runId } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trace, setTrace] = useState(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!runId) {
        setError('Run ID missing from route.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const payload = await fetchRunTrace(runId)
        if (!mounted) return
        setTrace(payload)
      } catch (error_) {
        if (!mounted) return
        const message = error_?.response?.data?.detail || error_?.message || 'Unable to load agent trace.'
        setError(message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [runId])

  const orderedSteps = useMemo(() => {
    const steps = trace?.steps || []
    return [...steps].sort((a, b) => (a.step_order || 0) - (b.step_order || 0))
  }, [trace])

  return (
    <main className="trace-root">
      <div className="trace-shell">
        <header className="trace-header">
          <div>
            <p className="trace-kicker">Lazarus Agent Trace</p>
            <h1>Run {runId}</h1>
            <p className="trace-subcopy">
              Inspect each agent call, output summary, status, timestamps, and score.
            </p>
          </div>
          <Link className="trace-back" to="/dashboard">Back to Dashboard</Link>
        </header>

        {loading && <p className="trace-info">Loading trace...</p>}
        {error && <p className="trace-error">{error}</p>}

        {!loading && !error && (
          <>
            <section className="trace-run-meta">
              <article>
                <h2>Asset</h2>
                <p>{trace?.asset_code || '—'}</p>
              </article>
              <article>
                <h2>Status</h2>
                <p>{trace?.run?.status || '—'}</p>
              </article>
              <article>
                <h2>Started</h2>
                <p>{formatTimestamp(trace?.run?.started_at)}</p>
              </article>
              <article>
                <h2>Completed</h2>
                <p>{formatTimestamp(trace?.run?.completed_at)}</p>
              </article>
            </section>

            <section className="trace-steps" aria-label="Agent step outputs">
              {orderedSteps.length === 0 && <p className="trace-info">No steps returned for this run yet.</p>}

              {orderedSteps.map((step) => (
                <article className={`trace-step ${step.status || 'idle'}`} key={step.id}>
                  <div className="trace-step-head">
                    <h3>
                      Step {step.step_order}: {prettyAgentName(step.agent_name)}
                    </h3>
                    <span className="trace-chip">{step.status || 'unknown'}</span>
                  </div>

                  <div className="trace-grid">
                    <div>
                      <h4>Input Summary</h4>
                      <p style={{ whiteSpace: 'pre-line' }}>{readableOutput(step.input_summary)}</p>
                    </div>
                    <div>
                      <h4>Output Summary</h4>
                      <p style={{ whiteSpace: 'pre-line' }}>{readableOutput(step.output_summary)}</p>
                    </div>
                    <div>
                      <h4>Score</h4>
                      <p>{typeof step.score === 'number' ? step.score.toFixed(2) : '—'}</p>
                    </div>
                    <div>
                      <h4>Updated</h4>
                      <p>{formatTimestamp(step.completed_at || step.started_at || step.created_at)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
