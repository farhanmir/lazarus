import { motion } from 'framer-motion'
import { GitCompareArrows, ShieldCheck, Target } from 'lucide-react'

function formatPct(value) {
  if (typeof value !== 'number') return '—'
  return `${((value <= 1 ? value : value / 100) * 100).toFixed(0)}%`
}

function scoreColor(value) {
  if (typeof value !== 'number') return 'var(--text-dim)'
  if (value >= 0.7) return '#1f7a52'
  if (value >= 0.45) return '#9a6c12'
  return '#9b3d3d'
}

function HypothesisComparisonPanel({ comparison, loading, error }) {
  if (!comparison && !loading && !error) {
    return (
      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Hypothesis Comparison</span>
        </div>
        <div className="term-panel-body" style={{ color: 'var(--text-dim)' }}>
          Select an asset and run multiple reviews to compare competing hypotheses.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Hypothesis Comparison</span>
        </div>
        <div className="term-panel-body" style={{ color: 'var(--text-dim)' }}>
          Comparing hypotheses…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Hypothesis Comparison</span>
        </div>
        <div className="term-panel-body" style={{ color: 'var(--red)' }}>
          {error}
        </div>
      </div>
    )
  }

  const items = comparison?.items ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Asset</div>
          <div className="mt-1 text-lg font-semibold text-[var(--text-bright)]">{comparison?.asset_code ?? '—'}</div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Compared Hypotheses</div>
          <div className="mt-1 text-lg font-semibold text-[var(--text-bright)]">{items.length}</div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Best Current Bet</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-bright)]">
            {items[0] ? `${items[0].target_disease} · ${formatPct(items[0].final_confidence)}` : 'No stored hypotheses'}
          </div>
        </div>
      </div>

      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Competing Indications</span>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            compare competing indications by confidence, disagreement, readiness, and next action
          </span>
        </div>
        <div className="term-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items.map((item, index) => (
            <motion.div
              key={item.hypothesis_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="nexus-glass-card"
              style={{ padding: '16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 360px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                      {item.source_disease} → {item.target_disease}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      run {item.run_id.slice(0, 8)}
                    </span>
                  </div>
                  <div style={{ marginTop: 10, color: 'var(--text-base)', lineHeight: 1.65 }}>
                    {item.summary}
                  </div>
                  <div style={{ marginTop: 10, color: 'var(--text-dim)', fontSize: '12px' }}>
                    Action: {item.recommended_action ?? 'Awaiting strategy'}
                  </div>
                </div>

                <div style={{ flex: '0 1 360px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confidence</div>
                    <div style={{ color: scoreColor(item.final_confidence), fontWeight: 700, marginTop: 4 }}>{formatPct(item.final_confidence)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Readiness</div>
                    <div style={{ color: scoreColor(item.investment_readiness_score), fontWeight: 700, marginTop: 4 }}>{formatPct(item.investment_readiness_score)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Disagreement</div>
                    <div style={{ color: scoreColor(1 - (item.disagreement_score ?? 0)), fontWeight: 700, marginTop: 4 }}>{formatPct(item.disagreement_score)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coverage</div>
                    <div style={{ color: scoreColor(item.evidence_coverage_score), fontWeight: 700, marginTop: 4 }}>{formatPct(item.evidence_coverage_score)}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap', color: 'var(--text-dim)', fontSize: '12px' }}>
                <span>Priority: {item.priority_level ?? 'unset'}</span>
                <span>Effort: {formatPct(item.effort_score)}</span>
                <span>Impact: {formatPct(item.impact_score)}</span>
                <span>{item.requires_hitl ? 'HITL required' : 'No HITL required'}</span>
                <span>Created: {new Date(item.created_at).toLocaleString()}</span>
              </div>
            </motion.div>
          ))}

          {!items.length && (
            <div style={{ color: 'var(--text-dim)' }}>
              No hypotheses exist for this asset yet.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="nexus-glass-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-bright)]">
            <GitCompareArrows size={15} />
            Compare Side-by-Side
          </div>
          <div className="text-sm text-[var(--text-base)]">
            Lets a reviewer see whether the same asset points to one strong indication or several weak ones.
          </div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-bright)]">
            <ShieldCheck size={15} />
            Risk vs Readiness
          </div>
          <div className="text-sm text-[var(--text-base)]">
            Confidence alone is not enough; the comparison also shows disagreement, coverage, and HITL drag.
          </div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-bright)]">
            <Target size={15} />
            Portfolio Decision
          </div>
          <div className="text-sm text-[var(--text-base)]">
            This turns Lazarus from one-answer reasoning into a portfolio decision surface with competing bets.
          </div>
        </div>
      </div>
    </div>
  )
}

export default HypothesisComparisonPanel
