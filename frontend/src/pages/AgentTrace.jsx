import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchRunTrace } from '../services/api'
import './agent-trace.css'

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

function stepLane(agentName) {
  const n = (agentName || '').toLowerCase()
  if (n === 'advocate') return 'advocate'
  if (n === 'skeptic') return 'skeptic'
  return 'neutral'
}

function laneTitle(lane) {
  if (lane === 'advocate') return 'Advocate lane · structured rescue brief'
  if (lane === 'skeptic') return 'Skeptic lane · adversarial validation'
  return 'Swarm step'
}

function parseCitationsJson(raw) {
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function readableOutput(raw) {
  if (!raw) return '—'
  try {
    const p = JSON.parse(raw)
    const lines = []
    const priority = [
      'proposed_disease',
      'target_disease',
      'confidence',
      'final_confidence',
      'risk_level',
      'verdict',
      'final_decision',
      'recommended_action',
      'evidence_summary',
      'rationale',
      'reasoning',
      'summary',
    ]
    for (const key of priority) {
      if (p[key] == null) continue
      const label = key.replace(/_/g, ' ')
      const val =
        typeof p[key] === 'number'
          ? key.includes('confidence')
            ? `${(p[key] * 100).toFixed(1)}%`
            : p[key].toFixed(3)
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
              Two models argue in the open: one pushes a rescue, the other tries to break it. You watch every
              move.
            </p>
            <p className="trace-wow">
              <strong>Five-second version:</strong> Lazarus raids dead trials, runs an adversarial court on the
              biology, then can text you the verdict. This page is the courtroom replay.
            </p>
          </div>
          <Link className="trace-back" to="/dashboard">
            Back to Dashboard
          </Link>
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

              {orderedSteps.map((step, index) => {
                const lane = stepLane(step.agent_name)
                const citations = parseCitationsJson(step.citations_json)
                const modelHint = citations?.model_used
                  ? `model: ${citations.model_used}`
                  : lane === 'skeptic' && citations?.mode
                    ? `skeptic: ${citations.mode}`
                    : ''

                return (
                  <motion.article
                    key={step.id}
                    className={`trace-step trace-step--${lane} ${step.status || 'idle'}`}
                    layout
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: index * 0.11,
                      duration: 0.38,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <div className="trace-lane-bar" aria-hidden />
                    <div style={{ padding: '1rem 1.1rem 1.1rem' }}>
                      <div className="trace-step-head">
                        <h3>
                          Step {step.step_order}: {prettyAgentName(step.agent_name)}
                        </h3>
                        <span className="trace-chip">{step.status || 'unknown'}</span>
                      </div>
                      <div className="trace-lane-label">{laneTitle(lane)}</div>
                      {modelHint ? (
                        <div className="trace-meta-row">
                          <span>{modelHint}</span>
                          {citations?.mode && lane !== 'skeptic' ? <span>mode: {citations.mode}</span> : null}
                        </div>
                      ) : null}

                      <div className="trace-grid" style={{ marginTop: '0.75rem' }}>
                        <div>
                          <h4>Input Summary</h4>
                          <pre className="trace-terminal">{readableOutput(step.input_summary)}</pre>
                        </div>
                        <div>
                          <h4>Output Summary</h4>
                          <pre className="trace-terminal">{readableOutput(step.output_summary)}</pre>
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
                    </div>
                  </motion.article>
                )
              })}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
