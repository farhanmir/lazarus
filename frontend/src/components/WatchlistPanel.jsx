import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  createWatchlist,
  fetchWatchlists,
  fetchActiveAlerts,
  dismissAlert,
} from '../services/api'

export default function WatchlistPanel() {
  const [diseaseQuery, setDiseaseQuery] = useState('')
  const [watchlists, setWatchlists] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [newAlertFlash, setNewAlertFlash] = useState(null)
  const prevAlertCount = useRef(0)

  const load = useCallback(async () => {
    try {
      const [wl, al] = await Promise.all([fetchWatchlists(), fetchActiveAlerts()])
      setWatchlists(wl)
      setAlerts(al)

      // Flash new alerts
      if (al.length > prevAlertCount.current && prevAlertCount.current > 0) {
        const newest = al[0]
        setNewAlertFlash(newest)
        setTimeout(() => setNewAlertFlash(null), 8000)
      }
      prevAlertCount.current = al.length
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000) // Poll every 5s for new alerts
    return () => clearInterval(interval)
  }, [load])

  const handleSubmit = async () => {
    const q = diseaseQuery.trim()
    if (!q) return
    setSubmitting(true)
    setError('')
    try {
      await createWatchlist(q)
      setDiseaseQuery('')
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create watchlist')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = async (alertId) => {
    try {
      await dismissAlert(alertId)
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch {
      // silent
    }
  }

  const anyActive = watchlists?.active_count > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Alert Pop-up */}
      <AnimatePresence>
        {newAlertFlash && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: 24, right: 24, zIndex: 9999,
              background: 'linear-gradient(135deg, #1a2f25 0%, #0d1a14 100%)',
              border: '1px solid #2e5a47',
              borderRadius: 16, padding: 20, maxWidth: 420,
              boxShadow: '0 8px 32px rgba(46,90,71,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#2e5a47', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Drug Match Found!
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {newAlertFlash.drug_name} ({newAlertFlash.asset_code})
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              {newAlertFlash.summary}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12 }}>
              <span style={{ color: '#2e5a47', fontWeight: 600 }}>
                Confidence: {(newAlertFlash.final_confidence * 100).toFixed(1)}%
              </span>
              <span style={{ textTransform: 'uppercase', opacity: 0.6 }}>
                Risk: {newAlertFlash.risk_level}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: anyActive ? '#c9a24b' : '#2e5a47',
          boxShadow: anyActive ? '0 0 8px #c9a24b' : 'none',
          animation: anyActive ? 'pulse 2s infinite' : 'none',
        }} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '0.04em' }}>
          Disease Watchlist
        </h2>
        {anyActive && (
          <span style={{ fontSize: 11, opacity: 0.6, fontStyle: 'italic' }}>
            scanning in background...
          </span>
        )}
      </div>

      {/* Input */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 16,
      }}>
        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 6, display: 'block' }}>
          I need a drug for...
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={diseaseQuery}
            onChange={(e) => setDiseaseQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. cancer, pulmonary fibrosis, lupus..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'inherit', fontSize: 14,
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!diseaseQuery.trim() || submitting}
            style={{
              padding: '10px 20px', borderRadius: 10,
              background: submitting ? 'rgba(201,162,75,0.2)' : 'rgba(46,90,71,0.25)',
              border: `1px solid ${submitting ? '#c9a24b' : '#2e5a47'}`,
              color: 'inherit', cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            {submitting ? 'Creating...' : 'Watch'}
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>
          The system will scan all drugs in the background and alert you if a match is found.
        </div>
        {error && <div style={{ color: '#9b3d3d', fontSize: 12, marginTop: 4 }}>{error}</div>}
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>
            🔔 Active Alerts ({alerts.length})
          </h3>
          <AnimatePresence>
            {alerts.map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  background: 'rgba(46,90,71,0.1)',
                  border: '1px solid rgba(46,90,71,0.25)',
                  borderRadius: 12, padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>
                        {alert.drug_name}
                      </span>
                      <span style={{ fontSize: 12, opacity: 0.6 }}>
                        {alert.asset_code}
                      </span>
                      <span style={{
                        padding: '1px 8px', borderRadius: 10, fontSize: 10,
                        fontWeight: 600, textTransform: 'uppercase',
                        background: alert.risk_level.toLowerCase() === 'low' ? '#2e5a47' : alert.risk_level.toLowerCase() === 'high' ? '#9b3d3d' : '#c9a24b',
                        color: '#fff',
                      }}>
                        {alert.risk_level}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                      {alert.summary}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 12, opacity: 0.6 }}>
                      <span>Originally: {alert.original_indication}</span>
                      <span>→ {alert.matched_disease}</span>
                      <span style={{ fontWeight: 600, color: '#2e5a47' }}>
                        {(alert.final_confidence * 100).toFixed(1)}% confidence
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    style={{
                      padding: '4px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'inherit', cursor: 'pointer', fontSize: 11, flexShrink: 0,
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Watchlist History */}
      {watchlists && watchlists.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>
            Watchlist History
          </h3>
          {watchlists.items.map((wl) => (
            <div
              key={wl.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>"{wl.disease_query}"</span>
                <span style={{
                  marginLeft: 10, padding: '1px 8px', borderRadius: 8, fontSize: 10,
                  fontWeight: 600, textTransform: 'uppercase',
                  background: wl.status === 'active' ? 'rgba(201,162,75,0.2)' : 'rgba(46,90,71,0.15)',
                  border: `1px solid ${wl.status === 'active' ? '#c9a24b' : '#2e5a47'}44`,
                }}>
                  {wl.status}
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>
                {wl.alerts.length} alert{wl.alerts.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
