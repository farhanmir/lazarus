import React, { memo, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { emailBlueprint } from '../services/api'

function BlueprintViewer({ blueprintResult, downloadUrl, blueprintLoading }) {
  const blueprint = blueprintResult?.blueprint
  const payload = blueprintResult?.payload

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [emailError, setEmailError] = useState('')

  const handleDownloadClick = useCallback(() => {
    if (downloadUrl) {
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = ''
      a.click()
    }
    setShowEmailModal(true)
    setRecipientEmail('')
    setEmailStatus(null)
    setEmailError('')
  }, [downloadUrl])

  const handleSendEmail = useCallback(async () => {
    if (!recipientEmail.trim() || !blueprint?.id) return
    setEmailStatus('sending')
    setEmailError('')
    try {
      await emailBlueprint(blueprint.id, recipientEmail.trim())
      setEmailStatus('sent')
    } catch (err) {
      setEmailStatus('error')
      setEmailError(err?.response?.data?.detail || 'Failed to send email. Check Gmail configuration.')
    }
  }, [recipientEmail, blueprint?.id])

  const confidenceDisplay = typeof payload?.confidence_score === 'number'
    ? `${(payload.confidence_score <= 1 ? payload.confidence_score * 100 : payload.confidence_score).toFixed(1)}%`
    : '—'

  return (
    <div className="term-panel">
      {/* Panel header */}
      <div className="term-panel-header">
        <span className="term-panel-title">Clinical Trial Blueprint</span>
        {blueprint && (
          <button
            type="button"
            onClick={handleDownloadClick}
            className="term-btn term-btn-execute"
            style={{ padding: '4px 10px' }}
          >
            Download PDF
          </button>
        )}
      </div>

      {/* Email modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="reset-overlay"
            onClick={() => setShowEmailModal(false)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.97 }}
              className="reset-dialog"
              style={{ maxWidth: 400, width: '100%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="reset-title">Send Blueprint</div>
              <div className="reset-msg">PDF downloaded. Send a copy via email?</div>

              {emailStatus === 'sent' ? (
                <div style={{ padding: 'var(--space-3)', color: 'var(--accent)', fontSize: '13px', fontFamily: 'var(--font-body)' }}>
                  Sent to {recipientEmail}
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
                    placeholder="colleague@company.com"
                    autoFocus
                    className="bp-email-input"
                  />
                  {emailStatus === 'error' && (
                    <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: 'var(--space-3)' }}>
                      {emailError}
                    </div>
                  )}
                  <div className="reset-actions">
                    <button type="button" onClick={() => setShowEmailModal(false)} className="term-btn term-btn-ghost">
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={!recipientEmail.trim() || emailStatus === 'sending'}
                      className="term-btn term-btn-execute"
                    >
                      {emailStatus === 'sending' ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        {blueprintLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bp-loading-state">
              <span className="bp-loading-dot" />
              <span>Packaging evidence, risk, and next-step strategy into a shareable artifact…</span>
            </div>
          </motion.div>

        ) : blueprint ? (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {/* ── Document hero header ── */}
            <div className="bp-hero">
              <div className="bp-hero-left">
                <div className="bp-hero-kicker">Drug Candidate</div>
                <div className="bp-hero-name">
                  {payload?.drug_name ?? '—'}
                  {payload?.asset_code && (
                    <span className="bp-hero-code">{payload.asset_code}</span>
                  )}
                </div>
              </div>
              <div className="bp-hero-divider" />
              <div className="bp-hero-right">
                <div className="bp-hero-kicker">Target Indication</div>
                <div className="bp-hero-disease">{payload?.proposed_indication ?? '—'}</div>
              </div>
            </div>

            {/* ── Key metrics strip ── */}
            <div className="bp-metrics">
              <div className="bp-metric">
                <span className="bp-metric-lbl">Confidence</span>
                <span className="bp-metric-val bp-metric-val--accent">{confidenceDisplay}</span>
              </div>
              <div className="bp-metric-sep" />
              <div className="bp-metric">
                <span className="bp-metric-lbl">Recommendation</span>
                <span className="bp-metric-val">{payload?.recommendation ?? '—'}</span>
              </div>
              <div className="bp-metric-sep" />
              <div className="bp-metric">
                <span className="bp-metric-lbl">Priority</span>
                <span className="bp-metric-val">{payload?.priority_level ?? '—'}</span>
              </div>
            </div>

            {/* ── Executive Summary ── */}
            <div className="bp-section">
              <div className="bp-section-label">Executive Summary</div>
              <p className="bp-summary-text">
                {blueprint.executive_summary ?? 'Blueprint content is still being assembled.'}
              </p>
            </div>

            {/* ── Detail grid ── */}
            <div className="bp-detail-grid">
              <div className="bp-detail-cell">
                <div className="bp-detail-label">Trial Focus</div>
                <p className="bp-detail-text">{payload?.trial_focus ?? '—'}</p>
              </div>
              <div className="bp-detail-cell">
                <div className="bp-detail-label">Business Rationale</div>
                <p className="bp-detail-text">{payload?.business_rationale ?? '—'}</p>
              </div>
              <div className="bp-detail-cell">
                <div className="bp-detail-label">Recommended Action</div>
                <p className="bp-detail-text bp-detail-text--strong">{payload?.recommended_action ?? '—'}</p>
              </div>
              <div className="bp-detail-cell">
                <div className="bp-detail-label">Suggested Cohort</div>
                <p className="bp-detail-text">{payload?.suggested_patient_cohort ?? '—'}</p>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="bp-footer">
              <span>Generated by Lazarus · Lazarus Bio-R&amp;D Swarm</span>
              {blueprint.id && (
                <span className="bp-footer-id">ID {blueprint.id.slice(0, 8)}</span>
              )}
            </div>
          </motion.div>

        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bp-empty-state">
              <div className="bp-empty-icon">⬡</div>
              <div className="bp-empty-title">No blueprint generated yet</div>
              <p className="bp-empty-desc">
                Run an analysis, then click <strong>Blueprint</strong> in the toolbar to generate a downloadable clinical trial dossier — including executive summary, trial strategy, cohort selection, and business rationale.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default memo(BlueprintViewer)
