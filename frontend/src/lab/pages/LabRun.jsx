import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react'
import AgentOrbitScene from '../three/AgentOrbit'
import {
  fetchBlueprintDetail,
  fetchRunTrace,
  getBlueprintDownloadUrl,
  startBlueprintJob,
  subscribeRunStream,
} from '../../services/api'

const AGENT_ORDER = [
  { id: 'scout', label: 'Scout — ingest', backendAliases: ['advocate', 'advocate_iteration'] },
  { id: 'skeptic', label: 'Skeptic — audit', backendAliases: ['skeptic', 'skeptic_iteration'] },
  { id: 'coroner', label: 'Coroner — dissect', backendAliases: ['parallel_evidence', 'evidence_curator', 'evidence_iteration'] },
  { id: 'defibrillator', label: 'Defibrillator — lift', backendAliases: ['assessment', 'assessment_iteration', 'judge', 'hitl_router'] },
  { id: 'trial_strategist', label: 'Strategist — blueprint', backendAliases: ['trial_strategist'] },
]

const TICKER_MESSAGES = [
  '[trace] mechanism graph bootstrapped · PMID corpus cached',
  '[coroner] binding affinity delta > 3σ on sub-cohort',
  '[defib] 2M-window ingest of FDA briefing · 412 pages',
  '[skeptic] pressure test · confound vector rejected',
  '[strategist] Phase IIa protocol synthesized',
]

export default function LabRun() {
  const { runId } = useParams()
  const { state: navState } = useLocation()
  const [trace, setTrace] = useState(null)
  const [error, setError] = useState('')
  const [bpLoading, setBpLoading] = useState(false)
  const [bpResult, setBpResult] = useState(null)
  const [tickerIndex, setTickerIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  /* ── Live stream subscription ── */
  useEffect(() => {
    if (!runId) return
    let closed = false
    const sub = subscribeRunStream(runId, {
      onMessage: (payload) => {
        if (closed) return
        if (payload?.error) {
          setError(payload.error)
          return
        }
        setTrace(payload)
      },
      onError: () => {
        if (!closed) setError('Real-time stream disconnected.')
      },
    })
    // fetch once too, in case websocket never opens
    fetchRunTrace(runId).then((p) => !closed && setTrace((cur) => cur ?? p)).catch(() => {})
    return () => {
      closed = true
      sub.close()
    }
  }, [runId])

  /* ── Elapsed clock ── */
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100)
    return () => clearInterval(id)
  }, [])

  /* ── Ticker rotator ── */
  useEffect(() => {
    const id = setInterval(() => {
      setTickerIndex((i) => (i + 1) % TICKER_MESSAGES.length)
    }, 2400)
    return () => clearInterval(id)
  }, [])

  const steps = trace?.steps ?? []
  const running = trace?.run?.status === 'running' || !trace?.run?.status
  const done = trace?.run?.status === 'completed'
  const failed = trace?.run?.status === 'failed'
  const hypothesisId = trace?.hypothesis?.id

  const confidence = trace?.run?.final_confidence
  const formattedConfidence =
    typeof confidence === 'number'
      ? `${(confidence <= 1 ? confidence * 100 : confidence).toFixed(1)}%`
      : '—'

  const recommendation = trace?.run?.final_recommendation ?? 'In progress'

  const stepByAgent = useMemo(() => {
    const m = {}
    // Map each frontend agent ID to the first matching backend step
    AGENT_ORDER.forEach((a) => {
      const aliases = a.backendAliases || [a.id]
      for (const alias of aliases) {
        const match = steps.find((s) => s.agent_name === alias && s.status === 'completed')
        if (match) { m[a.id] = match; break }
      }
      // If no completed match, check for any status (running, failed)
      if (!m[a.id]) {
        for (const alias of aliases) {
          const match = steps.find((s) => s.agent_name === alias)
          if (match) { m[a.id] = match; break }
        }
      }
    })
    return m
  }, [steps])

  const stageStates = useMemo(
    () =>
      AGENT_ORDER.map((agent) => {
        const step = stepByAgent[agent.id]
        return {
          id: agent.id,
          label: agent.label,
          status: step?.status ?? 'pending',
        }
      }),
    [stepByAgent],
  )

  const completed = stageStates.filter((stage) => stage.status === 'completed').length
  const progress = Math.round((completed / AGENT_ORDER.length) * 100)

  /* ── Blueprint generation ── */
  const handleBlueprint = async () => {
    if (!hypothesisId || bpLoading) return
    setBpLoading(true)
    try {
      const job = await startBlueprintJob(hypothesisId)
      let detail = null
      while (!detail || detail.blueprint.generation_status === 'pending') {
        await new Promise((r) => setTimeout(r, 1200))
        detail = await fetchBlueprintDetail(job.blueprint.id)
        setBpResult(detail)
      }
      if (detail.blueprint.generation_status === 'failed') {
        setError('Blueprint generation failed.')
      }
    } catch (err) {
      setError(err?.response?.data?.detail ?? err.message ?? 'Blueprint failed.')
    } finally {
      setBpLoading(false)
    }
  }

  // auto-kick-off blueprint once we have a hypothesis + run done
  useEffect(() => {
    if (done && hypothesisId && !bpResult && !bpLoading) {
      handleBlueprint()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, hypothesisId])

  const elapsedLabel = `${(elapsed / 1000).toFixed(1)}s`

  return (
    <div className="lab-run-root">
      {/* ── 3D scene ── */}
      <div className="lab-run-canvas">
        <AgentOrbitScene steps={steps} running={running} />
      </div>

      {/* ── HUD overlay ── */}
      <div className="lab-run-hud">
        {/* TOP */}
        <div className="lab-run-top">
          <div>
            <Link to="/lab/analyze" className="lab-back-link">
              <ArrowLeft size={12} /> Back to assets
            </Link>
            <h1 className="lab-run-title" style={{ marginTop: 8 }}>
              {navState?.assetCode ?? trace?.asset_code ?? 'Analysis'} · live dissection
            </h1>
            <div className="lab-run-id">RUN {runId?.slice(0, 8)} · {running ? 'STREAMING' : done ? 'CONVERGED' : failed ? 'HALTED' : 'INIT'}</div>
          </div>

          <motion.div
            className="lab-run-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="lab-run-panel-title">Agent pipeline</div>
            {stageStates.map((a) => {
              const status = a.status
              return (
                <div className="lab-agent-row" key={a.id}>
                  <span className="lab-agent-dot" data-status={status} />
                  <span style={{ flex: 1 }}>{a.label}</span>
                  <span className="lab-mono" style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6d7278' }}>
                    {status}
                  </span>
                </div>
              )
            })}
          </motion.div>
        </div>

        {/* CENTER CROSSHAIR */}
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 220, height: 220,
            border: '1px dashed rgba(20,23,26,0.18)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 360, height: 360,
            border: '1px dashed rgba(20,23,26,0.08)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />
        </div>

        {/* BOTTOM */}
        <div className="lab-run-bottom">
          <div style={{ maxWidth: '60%' }}>
            <div className="lab-run-stats">
              <div className="lab-run-stat">
                <div className="lab-run-stat-label">Elapsed</div>
                <div className="lab-run-stat-value">{elapsedLabel}</div>
              </div>
              <div className="lab-run-stat">
                <div className="lab-run-stat-label">Stages</div>
                <div className="lab-run-stat-value">{completed}<span style={{ color: '#6d7278', fontSize: 20 }}> /5</span></div>
              </div>
              <div className="lab-run-stat">
                <div className="lab-run-stat-label">Confidence</div>
                <div className="lab-run-stat-value">{formattedConfidence}</div>
              </div>
            </div>
            <div className="lab-progress-track" style={{ marginTop: 16, width: '100%' }}>
              <div className="lab-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={tickerIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="lab-ticker"
                style={{ marginTop: 14 }}
              >
                <span>{TICKER_MESSAGES[tickerIndex]}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="lab-run-panel" style={{ minWidth: 320 }}>
            <div className="lab-run-panel-title">Verdict</div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, lineHeight: 1.25, fontWeight: 500 }}>
              {recommendation}
            </div>
            {trace?.hypothesis && (
              <div className="lab-mono" style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6d7278', marginTop: 10 }}>
                {trace.hypothesis.source_disease} → {trace.hypothesis.target_disease}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
        }}>
          <div className="lab-err">{error}</div>
        </div>
      )}

      {/* ── Blueprint reveal ── */}
      <AnimatePresence>
        {done && (bpResult?.blueprint?.generation_status === 'completed' || bpLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lab-blueprint-sheet"
          >
            <span className="lab-eyebrow">Deliverable</span>
            <h3 style={{ fontFamily: 'Fraunces, serif', marginTop: 10 }}>
              {bpLoading ? 'Drafting blueprint…' : 'Phase II Blueprint'}
            </h3>
            {bpLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6d7278', marginTop: 18 }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span className="lab-mono" style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  Strategist synthesizing…
                </span>
              </div>
            )}
            {!bpLoading && bpResult?.blueprint && (
              <>
                <section>
                  <h4>Asset</h4>
                  <p>{bpResult.blueprint.asset_code ?? navState?.assetCode ?? trace?.asset_code}</p>
                </section>
                {bpResult.payload?.executive_summary && (
                  <section>
                    <h4>Executive Summary</h4>
                    <p>{bpResult.payload.executive_summary}</p>
                  </section>
                )}
                {bpResult.payload?.target_subpopulation && (
                  <section>
                    <h4>Target Sub-population</h4>
                    <p>{bpResult.payload.target_subpopulation}</p>
                  </section>
                )}
                {bpResult.payload?.recommended_design && (
                  <section>
                    <h4>Recommended Design</h4>
                    <p>{bpResult.payload.recommended_design}</p>
                  </section>
                )}
                <section style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <a
                    href={getBlueprintDownloadUrl(bpResult.blueprint.id)}
                    className="lab-cta"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download size={14} /> Download PDF
                  </a>
                  <Link to="/lab/analyze" className="lab-cta lab-cta-ghost">
                    <FileText size={14} /> New analysis
                  </Link>
                </section>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
