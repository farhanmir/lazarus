import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { runRescuePipeline } from '../services/api'
import './rescue-home.css'

function stageClass(status) {
  if (status === 'complete') return 'rescue-stage--ok'
  if (status === 'error') return 'rescue-stage--err'
  return 'rescue-stage--skip'
}

export default function RescueHome() {
  const [disease, setDisease] = useState('')
  const [recipient, setRecipient] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const apiBase = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
    [],
  )

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
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Pipeline tripped. Is the backend awake?',
      )
    } finally {
      setLoading(false)
    }
  }

  const blueprintHref =
    result?.blueprint_download_path != null
      ? `${apiBase.replace(/\/$/, '')}${result.blueprint_download_path}`
      : null

  return (
    <div className="rescue-root">
      <header className="rescue-header">
        <h1>Lazarus</h1>
        <p className="rescue-tagline">Enter a disease to rescue. We read the obituaries so you do not have to.</p>
      </header>

      <form className="rescue-form" onSubmit={onSubmit}>
        <label className="rescue-label" htmlFor="disease">
          Disease to rescue
        </label>
        <input
          id="disease"
          className="rescue-input"
          placeholder="e.g. Glioblastoma"
          value={disease}
          onChange={(e) => setDisease(e.target.value)}
          autoComplete="off"
        />
        <label className="rescue-label rescue-label--muted" htmlFor="recipient">
          Photon recipient (optional)
        </label>
        <input
          id="recipient"
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
        <Link to="/dashboard">Advanced dashboard</Link>
        <span className="rescue-nav-sep">·</span>
        <Link to="/lab">Lab</Link>
        <span className="rescue-nav-sep">·</span>
        <Link to="/welcome">Splash / story</Link>
      </nav>
    </div>
  )
}
