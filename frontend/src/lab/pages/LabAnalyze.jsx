import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { fetchAssets, startAnalysisJob } from '../../services/api'

export default function LabAnalyze() {
  const [assets, setAssets] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchAssets()
      .then((data) => {
        setAssets(data)
        if (data.length) setSelected(data[0].id)
      })
      .catch(() => setError('Unable to reach Lazarus backend. Is the API running on :8000?'))
  }, [])

  const handleBegin = async () => {
    if (!selected || loading) return
    setLoading(true)
    setError('')
    try {
      const job = await startAnalysisJob(selected, 'manual')
      navigate(`/lab/run/${job.run.id}`, {
        state: { assetId: selected, assetCode: job.asset_code },
      })
    } catch (err) {
      setError(err?.response?.data?.detail ?? err.message ?? 'Failed to start analysis.')
      setLoading(false)
    }
  }

  return (
    <div className="lab-analyze">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="lab-eyebrow">Step 01 · Asset selection</span>
        <h1 className="lab-hero-title" style={{ fontSize: 'clamp(48px, 7vw, 104px)', marginTop: 18 }}>
          Choose a <em>shelved</em> compound.
        </h1>
        <p className="lab-hero-sub" style={{ marginTop: 24 }}>
          The swarm will dissect it in real time. Expect a biological thinking trace,
          sub-population lift analysis, adversarial review, and a signature-ready blueprint.
        </p>
      </motion.div>

      {error && <div className="lab-err">{error}</div>}

      <AnimatePresence>
        {assets.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: 60, display: 'flex', alignItems: 'center', gap: 12, color: '#6d7278' }}
          >
            <Loader2 size={16} className="lab-mono" style={{ animation: 'spin 1s linear infinite' }} />
            <span className="lab-mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Loading asset registry…
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lab-asset-list">
        {assets.map((a, idx) => (
          <motion.div
            key={a.id}
            className="lab-asset-card"
            data-selected={selected === a.id}
            onClick={() => setSelected(a.id)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lab-asset-code">{a.asset_code}</div>
            <div className="lab-asset-name">{a.internal_name}</div>
            <div className="lab-asset-indication">{a.original_indication}</div>
            <div className="lab-asset-meta">
              {a.failure_phase ? `Failed · ${a.failure_phase}` : 'Shelved'}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ marginTop: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}
      >
        <div className="lab-mono" style={{ fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#6d7278' }}>
          {selected ? `Target locked · ${assets.find((a) => a.id === selected)?.asset_code}` : 'No asset selected'}
        </div>

        <button
          className="lab-cta"
          disabled={!selected || loading}
          onClick={handleBegin}
        >
          {loading ? 'Initiating swarm…' : 'Initiate swarm'}
          {!loading && <ArrowRight size={14} strokeWidth={2.5} />}
          {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
        </button>
      </motion.div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
