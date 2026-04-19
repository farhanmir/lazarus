import { motion } from 'framer-motion'
import { ArrowUpRight, FlaskConical, ShieldAlert, Sparkles } from 'lucide-react'

function formatPct(value) {
  if (typeof value !== 'number') return '—'
  return `${((value <= 1 ? value : value / 100) * 100).toFixed(0)}%`
}

function formatRank(value) {
  if (typeof value !== 'number') return '—'
  return value.toFixed(2)
}

function scoreTone(value) {
  if (typeof value !== 'number') return 'var(--text-dim)'
  if (value >= 0.7) return '#1f7a52'
  if (value >= 0.45) return '#9a6c12'
  return '#9b3d3d'
}

function PortfolioRankingPanel({ ranking, loading, error, onSelectAsset }) {
  if (loading) {
    return (
      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Portfolio Ranking</span>
        </div>
        <div className="term-panel-body" style={{ color: 'var(--text-dim)' }}>
          Building portfolio board…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Portfolio Ranking</span>
        </div>
        <div className="term-panel-body" style={{ color: 'var(--red)' }}>
          {error}
        </div>
      </div>
    )
  }

  const items = ranking?.items ?? []
  const top = items[0]
  const avgReadiness =
    items.length > 0
      ? items.reduce((sum, item) => sum + (item.investment_readiness_score ?? 0), 0) / items.length
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Ranked Assets</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-bright)]">{items.length}</div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Top Candidate</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-bright)]">
            {top ? `${top.asset_code} → ${top.proposed_indication ?? 'Awaiting analysis'}` : 'No ranked assets'}
          </div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Mean Readiness</div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: scoreTone(avgReadiness) }}>
            {formatPct(avgReadiness)}
          </div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Open Reviews</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-bright)]">
            {items.reduce((sum, item) => sum + (item.open_review_count ?? 0), 0)}
          </div>
        </div>
      </div>

      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Investment Queue</span>
          <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
            rank score blends confidence, impact, effort, risk, and HITL drag
          </span>
        </div>
        <div className="term-panel-body" style={{ padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.7fr 0.7fr 0.8fr 0.7fr 92px' }}>
            {['Asset', 'Proposed Indication', 'Confidence', 'Readiness', 'Risk', 'Reviews', 'Action'].map((label) => (
              <div
                key={label}
                style={{
                  padding: '10px 14px',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                  borderBottom: '1px solid var(--border-soft)',
                  background: 'rgba(20,23,26,0.02)',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {items.map((item, index) => (
            <motion.div
              key={item.asset_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 0.7fr 0.7fr 0.8fr 0.7fr 92px',
                borderBottom: '1px solid var(--border-soft)',
                alignItems: 'stretch',
              }}
            >
              <div style={{ padding: '14px' }}>
                <div style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{item.asset_code}</div>
                <div style={{ color: 'var(--text-base)', fontSize: '13px' }}>{item.internal_name}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{item.original_indication}</div>
              </div>
              <div style={{ padding: '14px', color: 'var(--text-base)', fontSize: '13px' }}>
                <div>{item.proposed_indication ?? 'No candidate yet'}</div>
                <div style={{ color: 'var(--text-dim)', marginTop: 4 }}>{item.final_recommendation ?? 'Awaiting final recommendation'}</div>
              </div>
              <div style={{ padding: '14px', color: scoreTone(item.final_confidence), fontWeight: 600 }}>
                {formatPct(item.final_confidence)}
                <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: 4 }}>rank {formatRank(item.portfolio_rank_score)}</div>
              </div>
              <div style={{ padding: '14px', color: scoreTone(item.investment_readiness_score), fontWeight: 600 }}>
                {formatPct(item.investment_readiness_score)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: 'var(--text-dim)', fontSize: '12px' }}>
                  <Sparkles size={12} />
                  impact {formatPct(item.impact_score)}
                </div>
              </div>
              <div style={{ padding: '14px', color: 'var(--text-base)', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={14} color={item.requires_hitl ? '#9b3d3d' : '#1f7a52'} />
                  {item.risk_level ?? 'Pending'}
                </div>
                <div style={{ color: 'var(--text-dim)', marginTop: 6 }}>{item.priority_level ?? 'No priority set'}</div>
              </div>
              <div style={{ padding: '14px', color: 'var(--text-base)', fontSize: '13px' }}>
                {item.open_review_count}
                <div style={{ color: 'var(--text-dim)', marginTop: 6 }}>{item.requires_hitl ? 'HITL required' : 'Auto-clear'}</div>
              </div>
              <div style={{ padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button type="button" onClick={() => onSelectAsset?.(item.asset_id)} className="term-btn term-btn-ghost" style={{ padding: '8px 12px' }}>
                  Open
                </button>
              </div>
            </motion.div>
          ))}

          {!items.length && (
            <div style={{ padding: '18px 14px', color: 'var(--text-dim)' }}>
              Run a few assets first and Lazarus will start ranking the portfolio.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="nexus-glass-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-bright)]">
            <FlaskConical size={15} />
            Portfolio Mode
          </div>
          <div className="text-sm text-[var(--text-base)]">
            Surfaces which shelved programs deserve capital first, instead of forcing one-by-one analysis decisions.
          </div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-bright)]">
            <ShieldAlert size={15} />
            Review Pressure
          </div>
          <div className="text-sm text-[var(--text-base)]">
            HITL gates and unresolved reviews reduce rank, which keeps risky assets from floating to the top prematurely.
          </div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-bright)]">
            <ArrowUpRight size={15} />
            Investment Signal
          </div>
          <div className="text-sm text-[var(--text-base)]">
            Rank combines confidence, impact, effort, and risk into one board-ready queue for portfolio triage.
          </div>
        </div>
      </div>
    </div>
  )
}

export default PortfolioRankingPanel
