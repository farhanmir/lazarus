import React, { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const AGENT_COLORS = {
  advocate:            '#6b50a8',
  advocate_iteration:  '#6b50a8',
  skeptic:             '#9b3d3d',
  skeptic_iteration:   '#9b3d3d',
  parallel_evidence:   '#2e5a6e',
  evidence_curator:    '#2e5a6e',
  evidence_iteration:  '#2e5a6e',
  assessment:          '#1f3a2e',
  assessment_iteration:'#1f3a2e',
  judge:               '#8a6e1e',
  trial_strategist:    '#1f3a2e',
  hitl_router:         '#1f3a2e',
}

const AGENT_LABELS = {
  advocate:            'ADVOCATE',
  advocate_iteration:  'ADVOCATE',
  skeptic:             'SKEPTIC',
  skeptic_iteration:   'SKEPTIC',
  parallel_evidence:   'EVIDENCE',
  evidence_curator:    'CURATOR',
  evidence_iteration:  'EVIDENCE',
  assessment:          'ASSESS',
  assessment_iteration:'ASSESS',
  judge:               'JUDGE',
  trial_strategist:    'STRATEGY',
  hitl_router:         'HITL',
}

function statusSymbol(status) {
  if (status === 'completed') return { sym: '[✓]', color: '#2e5a47' }
  if (status === 'failed')    return { sym: '[✗]', color: '#9b3d3d' }
  if (status === 'running')   return { sym: '[›]', color: '#8a6e1e' }
  return { sym: '[·]', color: '#6d7278' }
}

function formatStepTitle(step) {
  const score = step.score != null ? ` · ${step.score.toFixed(2)}` : ''
  const names = {
    advocate:         `ADVOCATE${score}`,
    advocate_iteration:`ADVOCATE${score}`,
    skeptic:          `SKEPTIC${score}`,
    skeptic_iteration:`SKEPTIC${score}`,
    evidence_curator: 'CURATOR · EVIDENCE COMPILED',
    parallel_evidence:'EVIDENCE · COMPILED',
    judge:            `JUDGE${score}`,
    trial_strategist: 'STRATEGY · ACTION PLAN',
    hitl_router:      'HITL · ROUTING',
    assessment:       `ASSESS${score}`,
    assessment_iteration: `ASSESS${score}`,
  }
  return names[step.agent_name] ?? step.agent_name.toUpperCase()
}

function formatDuration(step) {
  if (!step.started_at || !step.completed_at) return 'LIVE'
  const ms = new Date(step.completed_at) - new Date(step.started_at)
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function parseOutput(step) {
  try { return JSON.parse(step.output_summary) } catch { return null }
}

function AgentTimeline({ steps = [] }) {
  const [expandedId, setExpandedId] = useState(null)

  const normalizedSteps = useMemo(
    () => steps.map(s => ({ ...s, parsedOutput: parseOutput(s) })),
    [steps],
  )

  return (
    <div className="term-panel">
      <div className="term-panel-header">
        <span className="term-panel-title">AGENT TIMELINE</span>
        <span style={{ fontSize: '7.5px', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
          {steps.filter(s => s.status === 'completed').length}/{steps.length} COMPLETE
        </span>
      </div>

      {normalizedSteps.length === 0 ? (
        <div style={{
          padding: 'var(--space-6) var(--space-4)',
          fontSize: '9px',
          color: 'var(--text-dim)',
          letterSpacing: '0.16em',
        }}>
          &gt; AWAITING RUN · NO STEPS LOGGED
        </div>
      ) : (
        <div className="timeline-list" style={{ padding: 'var(--space-3)' }}>
          {normalizedSteps.map((step) => {
            const color  = AGENT_COLORS[step.agent_name] ?? '#1f3a2e'
            const label  = AGENT_LABELS[step.agent_name] ?? step.agent_name.toUpperCase()
            const { sym, color: symColor } = statusSymbol(step.status)
            const isExpanded = expandedId === step.id

            return (
              <motion.div key={step.id} layout>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : step.id)}
                  className={`timeline-step${isExpanded ? ' expanded' : ''}`}
                  style={{ width: '100%', textAlign: 'left' }}
                  aria-expanded={isExpanded}
                >
                  <div className="step-agent-tag">
                    <span
                      className="agent-badge"
                      style={{
                        color,
                        background: `${color}18`,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {label}
                    </span>
                  </div>

                  <div className="step-info">
                    <div className="step-title">
                      <span style={{ color: symColor, marginRight: 8, fontWeight: 700 }}>{sym}</span>
                      {formatStepTitle(step)}
                    </div>

                    <div className="step-meta">
                      <span>STATUS: {step.status.toUpperCase()}</span>
                      {step.score != null && (
                        <span>SCORE: {step.score.toFixed(2)}</span>
                      )}
                      <span>RUNTIME: {formatDuration(step)}</span>
                      {step.completed_at && (
                        <span>
                          AT: {new Date(step.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {step.input_summary && (
                      <div style={{
                        fontSize: '8.5px',
                        color: 'var(--text-base)',
                        letterSpacing: '0.02em',
                        marginTop: 2,
                        lineHeight: 1.5,
                      }}>
                        {step.input_summary.slice(0, 120)}{step.input_summary.length > 120 ? '…' : ''}
                      </div>
                    )}

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <pre className="step-output">
                            {step.parsedOutput
                              ? JSON.stringify(step.parsedOutput, null, 2)
                              : step.output_summary ?? '—'}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(AgentTimeline)
