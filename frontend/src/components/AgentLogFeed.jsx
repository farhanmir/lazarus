import { useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const AGENT_META = {
  advocate:           { color: '#6b50a8', tag: '[ADVOCATE]' },
  advocate_iteration: { color: '#6b50a8', tag: '[ADVOCATE]' },
  skeptic:            { color: '#9b3d3d', tag: '[SKEPTIC]' },
  skeptic_iteration:  { color: '#9b3d3d', tag: '[SKEPTIC]' },
  parallel_evidence:  { color: '#2e5a6e', tag: '[EVIDENCE]' },
  evidence_curator:   { color: '#2e5a6e', tag: '[CURATOR]' },
  evidence_iteration: { color: '#2e5a6e', tag: '[EVIDENCE]' },
  assessment:         { color: '#1f3a2e', tag: '[ASSESS]' },
  assessment_iteration: { color: '#1f3a2e', tag: '[ASSESS]' },
  judge:              { color: '#8a6e1e', tag: '[JUDGE]' },
  trial_strategist:   { color: '#1f3a2e', tag: '[STRATEGY]' },
  hitl_router:        { color: '#1f3a2e', tag: '[HITL]' },
}

const IDLE_LOG = [
  { color: '#1f3a2e', tag: '[SYSTEM]', text: 'Lazarus Nexus initialized. Awaiting command.' },
  { color: '#1f3a2e', tag: '[SYSTEM]', text: 'Dedalus cluster online · 3 agents standing by.' },
  { color: '#6d7278', tag: '[SYSTEM]', text: 'Select an asset and execute to begin analysis.' },
]

function extractText(step) {
  const raw = step.output_summary || step.input_summary || ''
  if (!raw) return `${step.agent_name} — ${step.status}`
  try {
    const p = JSON.parse(raw)
    if (p.proposed_disease && p.confidence != null)
      return `Proposed: ${p.proposed_disease} · conf ${(p.confidence * 100).toFixed(0)}%`
    if (p.risk_level)
      return `Risk: ${p.risk_level}${p.verdict ? ' · ' + p.verdict : ''}`
    if (p.final_decision && p.final_confidence != null)
      return `Verdict: ${p.final_decision} · conf ${(p.final_confidence * 100).toFixed(0)}%`
    if (p.recommended_action)
      return `Action: ${p.recommended_action}`
    if (p.evidence_summary)
      return p.evidence_summary.slice(0, 80)
    return raw.slice(0, 80)
  } catch {
    return raw.slice(0, 80)
  }
}

export function AgentLogFeed({ steps = [], isRunning = false }) {
  const feedRef = useRef()

  const entries = useMemo(() => {
    const active = (steps || []).filter(s => s.status === 'completed' || s.status === 'running')
    if (active.length === 0) return IDLE_LOG
    return active.map(step => {
      const meta = AGENT_META[step.agent_name] ?? { color: '#1f3a2e', tag: `[${step.agent_name.toUpperCase()}]` }
      return { color: meta.color, tag: meta.tag, text: extractText(step) }
    })
  }, [steps])

  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  return (
    <div ref={feedRef} className="agent-log-feed">
      <AnimatePresence initial={false}>
        {entries.map((entry, i) => (
          <motion.div
            key={i}
            className="log-entry"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <span className="log-tag" style={{ color: entry.color }}>{entry.tag}</span>
            <span className="log-text">{entry.text}</span>
          </motion.div>
        ))}

        {isRunning && (
          <motion.div
            key="cursor"
            className="log-cursor"
            style={{ paddingLeft: '12px', fontSize: '9px' }}
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          >
            <span style={{ color: '#1f3a2e' }}>█</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
