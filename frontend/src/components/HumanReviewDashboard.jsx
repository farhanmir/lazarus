import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

function HumanReviewDashboard({ dashboard, loading, error, onResolve }) {
  const [pendingResolveId, setPendingResolveId] = useState(null)

  if (loading) {
    return (
      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Human Review Dashboard</span>
        </div>
        <div className="term-panel-body" style={{ color: 'var(--text-dim)' }}>
          Loading review queue…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Human Review Dashboard</span>
        </div>
        <div className="term-panel-body" style={{ color: 'var(--red)' }}>
          {error}
        </div>
      </div>
    )
  }

  const items = dashboard?.items ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Open Reviews</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-bright)]">{dashboard?.pending ?? 0}</div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Resolved</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-bright)]">{dashboard?.resolved ?? 0}</div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Safety Board</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-bright)]">{dashboard?.safety_board ?? 0}</div>
        </div>
        <div className="nexus-glass-card p-4">
          <div className="text-xs text-[var(--text-dim)]">Portfolio Committee</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-bright)]">{dashboard?.portfolio_committee ?? 0}</div>
        </div>
      </div>

      <div className="term-panel">
        <div className="term-panel-header">
          <span className="term-panel-title">Review Queue</span>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            human escalation is triggered when disagreement or safety pressure crosses policy thresholds
          </span>
        </div>
        <div className="term-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items.map((item, index) => {
            const resolving = pendingResolveId === item.id
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="nexus-glass-card"
                style={{ padding: '16px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{item.asset_code}</span>
                      <span style={{ color: 'var(--text-base)' }}>{item.asset_name}</span>
                      <span style={{ fontSize: '11px', color: item.status === 'pending' ? 'var(--score-caution)' : 'var(--score-good)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {item.status}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, color: 'var(--text-dim)', fontSize: '12px' }}>
                      {item.review_type.replace('_', ' ')} · {item.original_indication} · run {item.run_id.slice(0, 8)}
                    </div>
                    <div style={{ marginTop: 10, color: 'var(--text-base)', lineHeight: 1.6 }}>{item.reason}</div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 18, flexWrap: 'wrap', color: 'var(--text-dim)', fontSize: '12px' }}>
                      <span>Reviewer: {item.recommended_reviewer ?? 'Unassigned'}</span>
                      <span>Run status: {item.run_status ?? 'unknown'}</span>
                      <span>Opened: {new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
                    {item.status === 'pending' ? (
                      <button
                        type="button"
                        className="term-btn"
                        disabled={resolving}
                        onClick={async () => {
                          setPendingResolveId(item.id)
                          try {
                            await onResolve?.(item.id)
                          } finally {
                            setPendingResolveId(null)
                          }
                        }}
                      >
                        {resolving ? 'Resolving…' : 'Resolve Review'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--score-good)', fontSize: '13px' }}>
                        <CheckCircle2 size={16} />
                        Resolved
                      </div>
                    )}

                    <div style={{ color: 'var(--text-dim)', fontSize: '12px', lineHeight: 1.5 }}>
                      {item.review_type === 'safety_board'
                        ? 'Requires formal safety sign-off before clinical commitment.'
                        : 'Needs portfolio committee alignment before capital is released.'}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}

          {!items.length && (
            <div style={{ color: 'var(--text-dim)' }}>
              No HITL escalations are waiting right now.
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default HumanReviewDashboard
