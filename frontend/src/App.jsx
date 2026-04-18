import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AgentProgressBar from './components/AgentProgressBar'
import AgentTimeline from './components/AgentTimeline'
import BlueprintProgress from './components/BlueprintProgress'
import BlueprintViewer from './components/BlueprintViewer'
import ConfidenceGauge from './components/ConfidenceGauge'
import EffortImpactChart from './components/EffortImpactChart'
import InteractiveGraph from './components/InteractiveGraph'
import MessagingPanel from './components/MessagingPanel'
import MetricsBar from './components/MetricsBar'
import NodeDetailsPanel from './components/NodeDetailsPanel'
import RiskBadge from './components/RiskBadge'
import { GlobeScene } from './components/GlobeScene'
import { AgentLogFeed } from './components/AgentLogFeed'
import { useGraphData } from './hooks/useGraphData'
import { useRunStatus } from './hooks/useRunStatus'
import {
  fetchAssets,
  fetchBlueprintDetail,
  fetchGraph,
  getBlueprintDownloadUrl,
  startAnalysisJob,
  startBlueprintJob,
  subscribeRunStream,
} from './services/api'

const emptyGraph = { nodes: [], links: [] }

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'graph',     label: 'Graph' },
  { id: 'agents',    label: 'Agents' },
  { id: 'strategy',  label: 'Strategy' },
  { id: 'messages',  label: 'Messages' },
  { id: 'blueprint', label: 'Blueprint' },
]

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
}

function App() {
  const [assets, setAssets]               = useState([])
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [graphData, setGraphData]         = useState(emptyGraph)
  const [selectedNode, setSelectedNode]   = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [blueprintLoading, setBlueprintLoading] = useState(false)
  const [errorMessage, setErrorMessage]   = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [runTrace, setRunTrace]           = useState(null)
  const [blueprintResult, setBlueprintResult] = useState(null)
  const [activeTab, setActiveTab]         = useState('dashboard')
  const [query, setQuery]                 = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const deferredGraphData    = useDeferredValue(graphData)
  const deferredSelectedNode = useDeferredValue(selectedNode)
  const runStatus = useRunStatus(analysisResult?.run, { analysisLoading, errorMessage })
  const { details: nodeDetails, legendItems } = useGraphData(deferredGraphData, deferredSelectedNode)

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return assets
    return assets.filter((asset) =>
      `${asset.asset_code} ${asset.original_indication} ${asset.internal_name}`.toLowerCase().includes(normalized),
    )
  }, [assets, query])

  const metrics = useMemo(() => {
    const skepticStep    = runTrace?.steps?.find((s) => s.agent_name === 'skeptic')
    const strategistStep = runTrace?.steps?.find((s) => s.agent_name === 'trial_strategist')
    let riskLevel     = 'Awaiting review'
    let priorityLevel = analysisResult?.hypothesis?.priority_level ?? 'Awaiting strategy'

    try {
      const p = skepticStep?.output_summary ? JSON.parse(skepticStep.output_summary) : null
      if (p?.risk_level) riskLevel = p.risk_level
    } catch { /* non-JSON payload */ }

    try {
      const p = strategistStep?.output_summary ? JSON.parse(strategistStep.output_summary) : null
      if (p?.priority_level) priorityLevel = p.priority_level
    } catch { /* non-JSON payload */ }

    const confidence = analysisResult?.run?.final_confidence
    const formattedConfidence =
      typeof confidence === 'number'
        ? `${(confidence <= 1 ? confidence * 100 : confidence).toFixed(1)}%`
        : 'Awaiting score'

    return [
      {
        key:  'hypothesis',
        value: analysisResult?.hypothesis
          ? `${analysisResult.hypothesis.source_disease} → ${analysisResult.hypothesis.target_disease}`
          : 'Awaiting analysis',
        caption: 'Active mechanistic repurposing candidate',
      },
      {
        key:  'confidence',
        value: formattedConfidence,
        caption: analysisResult?.run?.final_recommendation ?? 'No decision yet',
      },
      {
        key:  'risk',
        value: riskLevel,
        caption: 'Derived from skeptical review and safety pressure tests',
      },
      {
        key:  'priority',
        value: priorityLevel,
        caption: 'Trial strategist recommendation for next-stage focus',
      },
    ]
  }, [
    analysisResult?.hypothesis,
    analysisResult?.run?.final_confidence,
    analysisResult?.run?.final_recommendation,
    runTrace?.steps,
  ])

  const liveInsight = useMemo(() => {
    const skepticStep    = runTrace?.steps?.find((s) => s.agent_name.includes('skeptic'))
    const strategistStep = runTrace?.steps?.find((s) => s.agent_name === 'trial_strategist')
    let riskLevel     = 'Unknown'
    let priorityLevel = analysisResult?.hypothesis?.priority_level ?? 'Pending'

    try {
      const p = skepticStep?.output_summary ? JSON.parse(skepticStep.output_summary) : null
      if (p?.risk_level) riskLevel = p.risk_level
    } catch { /* ignore */ }

    try {
      const p = strategistStep?.output_summary ? JSON.parse(strategistStep.output_summary) : null
      if (p?.priority_level) priorityLevel = p.priority_level
    } catch { /* ignore */ }

    const runtimeMs =
      analysisResult?.run?.started_at && analysisResult?.run?.completed_at
        ? new Date(analysisResult.run.completed_at) - new Date(analysisResult.run.started_at)
        : null

    return {
      riskLevel,
      priorityLevel,
      runtimeLabel: runtimeMs !== null ? `${(runtimeMs / 1000).toFixed(1)}s` : 'LIVE',
    }
  }, [
    analysisResult?.hypothesis?.priority_level,
    analysisResult?.run?.completed_at,
    analysisResult?.run?.started_at,
    runTrace?.steps,
  ])

  useEffect(() => {
    fetchAssets()
      .then((data) => {
        setAssets(data)
        if (data.length) setSelectedAssetId(data[0].id)
      })
      .catch(() => setErrorMessage('Unable to load assets from the Lazarus backend.'))
  }, [])

  const resetGraph = () => {
    setGraphData(emptyGraph)
    setSelectedNode(null)
    setAnalysisResult(null)
    setRunTrace(null)
    setBlueprintResult(null)
    setErrorMessage('')
  }

  const handleRunAnalysis = async () => {
    if (!selectedAssetId) return
    setActiveTab('dashboard')
    setAnalysisLoading(true)
    setErrorMessage('')
    setAnalysisResult(null)
    setRunTrace(null)
    setBlueprintResult(null)
    setGraphData(emptyGraph)
    setSelectedNode(null)
    try {
      const job = await startAnalysisJob(selectedAssetId, 'manual')
      setAnalysisResult({ run: job.run, asset_code: job.asset_code, hypothesis: null })
      const graph = await fetchGraph(selectedAssetId)
      startTransition(() => {
        setGraphData(graph)
        setSelectedNode(graph.nodes.find((n) => n.highlight) ?? graph.nodes[0] ?? null)
      })

      await new Promise((resolve, reject) => {
        const subscription = subscribeRunStream(job.run.id, {
          onMessage: (payload) => {
            if (payload?.error) { subscription.close(); reject(new Error(payload.error)); return }
            setAnalysisResult((cur) => ({
              ...cur,
              run:       payload.run,
              asset_code: payload.asset_code ?? cur?.asset_code ?? job.asset_code,
              hypothesis: payload.hypothesis ?? null,
            }))
            setRunTrace(payload)
            if (payload.run?.status === 'failed') {
              subscription.close()
              reject(new Error(payload.run.error_message || 'Analysis failed to complete.'))
            }
            if (payload.run?.status === 'completed') { subscription.close(); resolve(payload) }
          },
          onError: () => reject(new Error('Real-time run stream disconnected unexpectedly.')),
        })
      })
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail ?? error.message ?? 'Analysis failed to complete.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const handleGenerateBlueprint = async () => {
    const hypothesisId = analysisResult?.hypothesis?.id
    if (!hypothesisId) return
    setActiveTab('blueprint')
    setBlueprintLoading(true)
    setErrorMessage('')
    setBlueprintResult(null)
    try {
      const job = await startBlueprintJob(hypothesisId)
      setBlueprintResult({ blueprint: job.blueprint, payload: null })
      let detail = null
      while (!detail || detail.blueprint.generation_status === 'pending') {
        await sleep(1200)
        detail = await fetchBlueprintDetail(job.blueprint.id)
        setBlueprintResult(detail)
      }
      if (detail.blueprint.generation_status === 'failed') throw new Error('Blueprint generation failed.')
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail ?? error.message ?? 'Blueprint generation failed.')
    } finally {
      setBlueprintLoading(false)
    }
  }

  const completedSteps = runTrace?.steps?.filter((s) => s.status === 'completed').length ?? 0
  const totalSteps = 5

  // Derive status dot class
  const dotClass =
    runStatus.tone === 'green' ? 'status-dot-strip dot-done' :
    runStatus.tone === 'blue'  ? 'status-dot-strip dot-running' :
    runStatus.tone === 'red'   ? 'status-dot-strip dot-error' :
    'status-dot-strip dot-idle'

  return (
    <>
      <div className="lazarus-shell">
        {/* ══════════════ LEFT PANEL ══════════════ */}
        <aside className="nexus-left">
          {/* Brand header */}
          <Link to="/" className="nexus-brand" style={{ textDecoration: 'none', display: 'block' }}>
            <span className="brand-title">Lazarus</span>
            <span className="brand-sub">Bio-R&amp;D Swarm · Dedalus Cluster</span>
          </Link>

          {/* Globe */}
          <div className="globe-wrap">
            <GlobeScene isRunning={analysisLoading} />
            <div className="globe-status">
              <span className={`globe-status-dot${analysisLoading ? ' running' : ''}`} />
              <span>{analysisLoading ? 'PROCESSING' : 'STANDBY'}</span>
            </div>
          </div>

          {/* Agent log feed */}
          <div className="agent-log-panel">
            <div className="panel-label">Agent Stream</div>
            <AgentLogFeed steps={runTrace?.steps ?? []} isRunning={analysisLoading} />
          </div>
        </aside>

        {/* ══════════════ RIGHT PANEL ══════════════ */}
        <div className="nexus-right">
          {/* Header */}
          <header className="nexus-header">
            <div className="header-left">
              <div className="system-status">
                <span className="status-blink" />
                <span style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--accent)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                  Online
                </span>
              </div>
              <div className="hud-services">
                {['Postgres', 'Neo4j', 'Dedalus', 'K2 Think', 'Spectrum'].map((s) => (
                  <span key={s} className="hud-service">{s}</span>
                ))}
              </div>
            </div>

            <div className="header-right">
              {/* Search */}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search compounds…"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-bright)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.06em',
                  padding: '5px 8px',
                  outline: 'none',
                  borderRadius: '2px',
                  width: '130px',
                }}
              />

              {/* Asset selector */}
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="term-select"
              >
                <option value="">— SELECT ASSET —</option>
                {filteredAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.asset_code} · {asset.internal_name}
                  </option>
                ))}
              </select>

              {/* Execute */}
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={!selectedAssetId || analysisLoading}
                className={`term-btn term-btn-execute${analysisLoading ? ' running' : ''}`}
              >
                {analysisLoading ? 'Running…' : 'Run Analysis'}
              </button>

              {/* Blueprint */}
              <button
                type="button"
                onClick={handleGenerateBlueprint}
                disabled={!analysisResult?.hypothesis?.id || blueprintLoading}
                className="term-btn"
              >
                {blueprintLoading ? 'Generating…' : 'Blueprint'}
              </button>

              {/* Reset */}
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="term-btn term-btn-ghost"
              >
                Reset
              </button>

              {/* Run ID chip */}
              {analysisResult?.run && (
                <div className="run-id-chip">
                  <span style={{ color: 'var(--accent)', fontSize: '8px' }}>●</span>
                  <span>{analysisResult.run.id?.slice(0, 8)}</span>
                </div>
              )}
            </div>
          </header>

          {/* Tab nav */}
          <nav className="nexus-tabnav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Error banner */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="error-banner"
              >
                ⚠ {errorMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status strip */}
          <div className="nexus-status-strip">
            <div className="status-info">
              <span className={dotClass} />
              <span className="status-label">{runStatus.label}</span>
              <span style={{ color: 'var(--text-dim)' }}>·</span>
              <span className="status-desc">{runStatus.description}</span>
            </div>
            <div className="progress-track">
              <motion.div
                className="progress-fill"
                animate={{ width: `${runStatus.progress}%` }}
                transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
              />
            </div>
          </div>

          {/* Content area */}
          <div className="nexus-content">
            <AnimatePresence mode="wait">
              {/* ═══ DASHBOARD ═══ */}
              {activeTab === 'dashboard' && (
                <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <AgentProgressBar steps={runTrace?.steps ?? []} runStatus={analysisResult?.run?.status ?? 'idle'} />
                    <MetricsBar metrics={metrics} />

                    {/* Decision feed + confidence row */}
                    <div className="dash-grid">
                      <div className="dash-main">
                        <div className="term-panel">
                          <div className="term-panel-header">
                            <span className="term-panel-title">Live Decision</span>
                            <span style={{ fontSize: '7.5px', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
                              {liveInsight.runtimeLabel}
                              {analysisResult?.run?.status === 'running' ? ' · STREAMING' : ''}
                            </span>
                          </div>
                          <div className="decision-feed">
                            {analysisResult?.run?.final_recommendation ? (
                              <>
                                <div className="decision-line">
                                  <span className="decision-highlight">VERDICT · </span>
                                  {analysisResult.run.final_recommendation}
                                </div>
                                <div className="decision-line" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <RiskBadge label={liveInsight.riskLevel} />
                                  <RiskBadge label={liveInsight.priorityLevel} prefix="Priority" />
                                </div>
                              </>
                            ) : (
                              <div className="decision-empty">
                                &gt; AWAITING FINAL RECOMMENDATION
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Mini pipeline progress dots */}
                        <div className="term-panel" style={{ marginTop: 'var(--space-4)' }}>
                          <div className="term-panel-header">
                            <span className="term-panel-title">Pipeline Progress</span>
                            <span style={{ fontSize: '7.5px', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
                              {completedSteps}/{totalSteps}
                            </span>
                          </div>
                          <div style={{ padding: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
                            {Array.from({ length: totalSteps }, (_, i) => (
                              <motion.div
                                key={i}
                                style={{
                                  height: 3,
                                  flex: 1,
                                  borderRadius: 2,
                                  background: i < completedSteps ? 'var(--accent)' : 'rgba(20,23,26,0.1)',
                                  boxShadow: 'none',
                                }}
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 0.3, delay: i * 0.07 }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="dash-side">
                        <ConfidenceGauge value={analysisResult?.run?.final_confidence} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══ GRAPH ═══ */}
              {activeTab === 'graph' && (
                <motion.div key="graph" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(280px,0.6fr)', gap: 'var(--space-4)' }}>
                    <InteractiveGraph
                      graphData={deferredGraphData}
                      selectedNode={selectedNode}
                      setSelectedNode={setSelectedNode}
                      steps={runTrace?.steps ?? []}
                      runStatus={analysisResult?.run?.status ?? 'idle'}
                      legendItems={legendItems}
                    />
                    <NodeDetailsPanel details={nodeDetails} />
                  </div>
                </motion.div>
              )}

              {/* ═══ AGENTS ═══ */}
              {activeTab === 'agents' && (
                <motion.div key="agents" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <AgentTimeline steps={runTrace?.steps ?? []} />
                </motion.div>
              )}

              {/* ═══ STRATEGY ═══ */}
              {activeTab === 'strategy' && (
                <motion.div key="strategy" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <EffortImpactChart runId={analysisResult?.run?.id} />
                </motion.div>
              )}

              {/* ═══ MESSAGES ═══ */}
              {activeTab === 'messages' && (
                <motion.div key="messages" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <MessagingPanel runId={analysisResult?.run?.id} />
                </motion.div>
              )}

              {/* ═══ BLUEPRINT ═══ */}
              {activeTab === 'blueprint' && (
                <motion.div key="blueprint" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <BlueprintProgress loading={blueprintLoading} ready={Boolean(blueprintResult?.blueprint?.id)} />
                    <BlueprintViewer
                      blueprintResult={blueprintResult}
                      blueprintLoading={blueprintLoading}
                      downloadUrl={blueprintResult?.blueprint?.id ? getBlueprintDownloadUrl(blueprintResult.blueprint.id) : undefined}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ══════════════ RESET CONFIRM ══════════════ */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="reset-overlay"
          >
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.97 }}
              className="reset-dialog"
            >
              <div className="reset-title">Confirm reset</div>
              <div className="reset-msg">
                Clear graph, run context, and blueprint preview. This cannot be undone.
              </div>
              <div className="reset-actions">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="term-btn term-btn-ghost"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => { setShowResetConfirm(false); resetGraph() }}
                  className="term-btn"
                  style={{ borderColor: 'rgba(155,61,61,0.5)', color: 'var(--red)' }}
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default App
