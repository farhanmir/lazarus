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
  effort_estimator:   { color: '#496a3d', tag: '[EFFORT]' },
  impact_predictor:   { color: '#2f4f66', tag: '[IMPACT]' },
}

const IDLE_LOG = [
  { color: '#1f3a2e', tag: '[SYSTEM]', text: 'Lazarus Nexus initialized. Awaiting command.' },
  { color: '#1f3a2e', tag: '[SYSTEM]', text: 'Reasoning cluster online · 3 agents standing by.' },
  { color: '#6d7278', tag: '[SYSTEM]', text: 'Select an asset and execute to begin analysis.' },
]

const PHASE_LABELS = {
  initial: 'Initial Pass',
  iterative: 'Iterative Review',
  final: 'Final Decision',
}

function phaseForStep(step) {
  const name = step.agent_name || ''
  if (name.includes('_iteration')) return 'iterative'
  if (['judge', 'trial_strategist', 'hitl_router', 'effort_estimator', 'impact_predictor'].includes(name)) {
    return 'final'
  }
  return 'initial'
}

function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return `${(value <= 1 ? value * 100 : value).toFixed(0)}%`
}

function formatNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function humanizeText(value) {
  if (!value || typeof value !== 'string') return ''
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

function summarizeEvidenceBranches(payload) {
  const branchKeys = ['mechanism', 'safety', 'trial', 'business']
  const summaries = branchKeys
    .map((key) => payload[key]?.summary || payload[key]?.evidence_summary)
    .filter(Boolean)
  if (summaries.length > 0) return humanizeText(summaries[0])
  if (payload.evidence_summary) return humanizeText(payload.evidence_summary)
  return 'Evidence branches merged across mechanism, safety, trial, and business.'
}

function extractText(step) {
  const raw = step.output_summary || step.input_summary || ''
  if (!raw) return `${step.agent_name} — ${step.status}`
  try {
    const p = JSON.parse(raw)
    if (p.proposed_disease && p.confidence != null) {
      return `Proposed: ${p.proposed_disease} · conf ${formatPercent(p.confidence)}`
    }
    if (p.risk_level) {
      const parts = [`Risk: ${humanizeText(p.risk_level)}`]
      if (p.conflict_summary) parts.push(humanizeText(p.conflict_summary))
      else if (p.verdict) parts.push(humanizeText(p.verdict))
      return parts.join(' · ')
    }
    if (p.mechanism || p.safety || p.trial || p.business) {
      return `Evidence: ${summarizeEvidenceBranches(p)}`
    }
    if (p.evidence_summary) {
      return humanizeText(p.evidence_summary)
    }
    if (p.disagreement_score != null || p.evidence_coverage_score != null) {
      const parts = ['Assessment']
      const disagreement = formatPercent(p.disagreement_score)
      const coverage = formatPercent(p.evidence_coverage_score)
      if (disagreement) parts.push(`disagreement ${disagreement}`)
      if (coverage) parts.push(`coverage ${coverage}`)
      if (Array.isArray(p.unresolved_gaps) && p.unresolved_gaps.length > 0) {
        parts.push(`${p.unresolved_gaps.length} open gap${p.unresolved_gaps.length === 1 ? '' : 's'}`)
      } else {
        parts.push('no unresolved gaps')
      }
      return parts.join(' · ')
    }
    if (p.final_decision && p.final_confidence != null) {
      return `Verdict: ${p.final_decision} · conf ${formatPercent(p.final_confidence)}`
    }
    if (p.recommended_action) {
      const target = p.target_cohort ? ` · target ${humanizeText(p.target_cohort)}` : ''
      return `Action: ${p.recommended_action}${target}`
    }
    if (typeof p.required === 'boolean' && p.review_type) {
      const state = p.required ? 'required' : 'not required'
      const reason = p.reason ? ` · ${humanizeText(p.reason)}` : ''
      return `HITL: ${humanizeText(p.review_type)} review ${state}${reason}`
    }
    if (p.estimated_cost_usd != null || p.estimated_time_months != null) {
      const parts = ['Effort']
      const cost = formatNumber(p.estimated_cost_usd)
      if (cost) parts.push(`$${cost}`)
      if (p.estimated_time_months != null) parts.push(`${p.estimated_time_months} months`)
      if (p.trial_complexity) parts.push(`${humanizeText(p.trial_complexity)} complexity`)
      return parts.join(' · ')
    }
    if (p.patient_population_size != null || p.expected_breakthrough_score != null || p.commercial_score != null) {
      const parts = ['Impact']
      const population = formatNumber(p.patient_population_size)
      if (population) parts.push(`${population} patients`)
      const breakthrough = formatPercent(p.expected_breakthrough_score)
      if (breakthrough) parts.push(`breakthrough ${breakthrough}`)
      const commercial = formatPercent(p.commercial_score)
      if (commercial) parts.push(`commercial ${commercial}`)
      return parts.join(' · ')
    }
    return humanizeText(raw)
  } catch {
    return humanizeText(raw)
  }
}

export function AgentLogFeed({ steps = [], isRunning = false }) {
  const feedRef = useRef()

  const entries = useMemo(() => {
    const active = [...(steps || [])]
      .filter((s) => s.status === 'completed' || s.status === 'running')
      .sort((a, b) => {
        const orderDelta = (a.step_order ?? 0) - (b.step_order ?? 0)
        if (orderDelta !== 0) return orderDelta
        const aTime = a.completed_at || a.created_at || a.started_at || ''
        const bTime = b.completed_at || b.created_at || b.started_at || ''
        return String(aTime).localeCompare(String(bTime))
      })
    if (active.length === 0) return IDLE_LOG

    const grouped = []
    let lastPhase = null

    active.forEach((step) => {
      const phase = phaseForStep(step)
      if (phase !== lastPhase) {
        grouped.push({
          kind: 'phase',
          phase,
          color: '#6d7278',
          tag: '[PHASE]',
          text: PHASE_LABELS[phase] ?? 'Workflow',
        })
        lastPhase = phase
      }

      const meta = AGENT_META[step.agent_name] ?? { color: '#1f3a2e', tag: `[${step.agent_name.toUpperCase()}]` }
      grouped.push({
        kind: 'step',
        color: meta.color,
        tag: meta.tag,
        text: extractText(step),
      })
    })

    return grouped
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
            key={`${entry.kind ?? 'step'}-${i}`}
            className="log-entry"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={
              entry.kind === 'phase'
                ? {
                    marginTop: i === 0 ? 0 : 8,
                    paddingTop: 8,
                    borderTop: '1px solid rgba(20,23,26,0.08)',
                    fontSize: '9px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }
                : undefined
            }
          >
            <span className="log-tag" style={{ color: entry.color }}>
              {entry.kind === 'phase' ? entry.text : entry.tag}
            </span>
            <span className="log-text" style={entry.kind === 'phase' ? { color: '#6d7278' } : undefined}>
              {entry.kind === 'phase' ? 'Chronological phase grouping' : entry.text}
            </span>
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
