import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchCandidates, getApiBase, runRescuePipeline } from '../services/api'
import '../pages/rescue-home.css'

function stageClass(status) {
  if (status === 'complete') return 'rescue-stage--ok'
  if (status === 'error') return 'rescue-stage--err'
  return 'rescue-stage--skip'
}

function pct(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const v = Number(n) <= 1 ? Number(n) * 100 : Number(n)
  return `${Math.round(v)}%`
}

export default function RescuePipelinePanel() {
  const [disease, setDisease] = useState('')
  const [recipient, setRecipient] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const [candidates, setCandidates] = useState([])
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [candidateError, setCandidateError] = useState('')

  const apiBase = useMemo(() => getApiBase(), [])

  useEffect(() => {
    const q = disease.trim()
    if (q.length < 2) {
      setCandidates([])
      setCandidateError('')
      setCandidateLoading(false)
      return
    }

    setCandidateError('')
    const timer = setTimeout(async () => {
      const query = disease.trim()
      if (query.length < 2) return
      setCandidateLoading(true)
      try {
        const data = await fetchCandidates(query, 8)
        if (disease.trim() !== query) return
        setCandidates(Array.isArray(data?.candidates) ? data.candidates : [])
      } catch (err) {
        if (disease.trim() !== query) return
        const network =
          err?.code === 'ERR_NETWORK' ||
          err?.message === 'Network Error' ||
          String(err?.message || '').toLowerCase().includes('network')
        setCandidateError(
          err?.response?.data?.detail ||
            (network ? 'Cannot reach candidates API (same fix as pipeline: proxy / backend).' : null) ||
            err?.message ||
            'Candidate search failed.',
        )
        setCandidates([])
      } finally {
        if (disease.trim() === query) setCandidateLoading(false)
      }
    }, 380)

    return () => clearTimeout(timer)
  }, [disease])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    const q = disease.trim()
    if (q.length < 2) {
      setError('Give us at least two characters of disease to haunt.')
      return
    }
    setLoading(true)
    try {
      const data = await runRescuePipeline({
        disease: q,
        recipient: recipient.trim() || undefined,
      })
      setResult(data)
    } catch (err) {
      const network =
        err?.code === 'ERR_NETWORK' ||
        err?.message === 'Network Error' ||
        String(err?.message || '').toLowerCase().includes('network')
      setError(
        err?.response?.data?.detail ||
          (network
            ? 'Cannot reach the API. Start uvicorn on port 8000, then restart `npm run dev` (Vite proxies /api to the backend). If you set VITE_API_BASE_URL, it must match a running server and CORS.'
            : null) ||
          err?.message ||
          'Pipeline tripped. Is the backend awake?',
      )
    } finally {
      setLoading(false)
    }
  }

  const blueprintHref =
    result?.blueprint_download_path != null
      ? apiBase
        ? `${apiBase.replace(/\/$/, '')}${result.blueprint_download_path}`
        : `${typeof globalThis.window !== 'undefined' ? globalThis.window.location.origin : ''}${result.blueprint_download_path}`
      : null

  return (
    <div className="rescue-root rescue-root--embedded">
      <header className="rescue-header">
        <h1>Trial rescue</h1>
        <p className="rescue-tagline">
          Same URL as the operator shell — portfolio match + CT.gov pipeline in one place.
        </p>
      </header>

      <form className="rescue-form" onSubmit={onSubmit}>
        <label className="rescue-label" htmlFor="rescue-disease">
          Disease to rescue
        </label>
        <input
          id="rescue-disease"
          className="rescue-input"
          placeholder="e.g. Glioblastoma"
          value={disease}
          onChange={(e) => setDisease(e.target.value)}
          autoComplete="off"
        />

        {disease.trim().length >= 2 ? (
          <div className="rescue-search-panel" aria-live="polite">
            <div className="rescue-search-head">
              <span className="rescue-search-title">Portfolio matches</span>
              {candidateLoading ? (
                <span className="rescue-search-meta">Searching shelved assets…</span>
              ) : null}
            </div>
            <p className="rescue-search-hint">
              Same `/api/candidates` search as the header workflow — ranked shelved assets for this disease. Rescue
              run below is trial-registry autopsy.
            </p>
            {candidateError ? <p className="rescue-search-error">{candidateError}</p> : null}
            {!candidateLoading && !candidateError && candidates.length === 0 ? (
              <p className="rescue-search-empty">
                No portfolio hits for this wording yet. You can still run the pipeline — it pulls terminated trials
                from ClinicalTrials.gov.
              </p>
            ) : null}
            {candidates.length > 0 ? (
              <ul className="rescue-candidate-list">
                {candidates.map((c) => (
                  <li key={c.asset_id} className="rescue-candidate-card">
                    <div className="rescue-candidate-top">
                      <span className="rescue-candidate-drug">{c.drug_name || '—'}</span>
                      <span className="rescue-candidate-code">{c.asset_code}</span>
                      <span className="rescue-candidate-score" title="Scientific confidence">
                        {pct(c.scientific_confidence_score)}
                      </span>
                    </div>
                    {c.match_reason ? <p className="rescue-candidate-reason">{c.match_reason}</p> : null}
                    {c.proposed_disease ? (
                      <p className="rescue-candidate-meta">Pivot read: {c.proposed_disease}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <label className="rescue-label rescue-label--muted" htmlFor="rescue-recipient">
          Photon recipient (optional)
        </label>
        <input
          id="rescue-recipient"
          className="rescue-input rescue-input--sm"
          placeholder="Spectrum handle or +1… (else we only draft the text)"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="rescue-submit" disabled={loading}>
          {loading ? 'Séance in progress…' : 'Run rescue pipeline'}
        </button>
      </form>

      {error ? <p className="rescue-error">{error}</p> : null}

      {loading ? (
        <motion.p
          className="rescue-loading"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.9 }}
        >
          Negotiating with registries. The trial ghost is a tough negotiator.
        </motion.p>
      ) : null}

      {result ? (
        <section className="rescue-timeline-wrap">
          <h2 className="rescue-h2">Pipeline</h2>
          <ol className="rescue-timeline">
            {result.stages?.map((st) => (
              <li key={st.id} className={`rescue-stage ${stageClass(st.status)}`}>
                <div className="rescue-stage-head">
                  <span className="rescue-stage-dot" aria-hidden />
                  <div>
                    <div className="rescue-stage-title">{st.label}</div>
                    <div className="rescue-stage-status">{st.status}</div>
                    {st.humor ? <div className="rescue-stage-humor">{st.humor}</div> : null}
                  </div>
                </div>
                <details className="rescue-details">
                  <summary>Payload</summary>
                  <pre className="rescue-pre">{JSON.stringify(st.data, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ol>

          {blueprintHref ? (
            <p className="rescue-blueprint">
              <a href={blueprintHref} target="_blank" rel="noreferrer">
                Download rescue blueprint (PDF)
              </a>
            </p>
          ) : null}

          {result.footnote ? <p className="rescue-footnote">{result.footnote}</p> : null}
        </section>
      ) : null}

      <nav className="rescue-nav">
        <Link to="/dashboard">Dashboard tab (agents / graph)</Link>
        <span className="rescue-nav-sep">·</span>
        <Link to="/welcome">Marketing splash</Link>
      </nav>
    </div>
  )
}
