import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AgentProgressBar from './components/AgentProgressBar'
import AgentTimeline from './components/AgentTimeline'
import BlueprintProgress from './components/BlueprintProgress'
import BlueprintViewer from './components/BlueprintViewer'
import ConfidenceGauge from './components/ConfidenceGauge'
import EffortImpactChart from './components/EffortImpactChart'
import HumanReviewDashboard from './components/HumanReviewDashboard'
import HypothesisComparisonPanel from './components/HypothesisComparisonPanel'
import InteractiveGraph from './components/InteractiveGraph'
import MessagingPanel from './components/MessagingPanel'
import MetricsBar from './components/MetricsBar'
import MultiDiseaseScanPanel from './components/MultiDiseaseScanPanel'
import WatchlistPanel from './components/WatchlistPanel'
import NodeDetailsPanel from './components/NodeDetailsPanel'
import PortfolioRankingPanel from './components/PortfolioRankingPanel'
import RescuePipelinePanel from './components/RescuePipelinePanel'
import RiskBadge from './components/RiskBadge'
import { GlobeScene } from './components/GlobeScene'
import { AgentLogFeed } from './components/AgentLogFeed'
import { useGraphData } from './hooks/useGraphData'
import { useRunStatus } from './hooks/useRunStatus'
import {
  fetchAssets,
  fetchBlueprintDetail,
  fetchHumanReviewDashboard,
  fetchGraph,
  fetchHypothesisComparison,
  fetchPortfolioRanking,
  getBlueprintDownloadUrl,
  resolveHumanReview,
  startAnalysisJob,
  startBlueprintJob,
  subscribeRunStream,
} from './services/api'

const emptyGraph = { nodes: [], links: [] }

const TABS = [
  { id: 'rescue', label: 'Rescue' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'graph',     label: 'Graph' },
  { id: 'analysis',  label: 'Analysis' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'research',  label: 'Research' },
  { id: 'ops',       label: 'Ops' },
  { id: 'blueprint', label: 'Blueprint' },
]

const TAB_IDS = new Set(TABS.map((t) => t.id))

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
  const [activeTab, setActiveTab]         = useState(() => {
    if (globalThis.window === undefined) return 'dashboard'
    const t = new URLSearchParams(globalThis.window.location.search).get('tab')
    return t && TAB_IDS.has(t) ? t : 'dashboard'
  })
  const [query, setQuery]                 = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [portfolioRanking, setPortfolioRanking] = useState(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioError, setPortfolioError] = useState('')
  const [reviewDashboard, setReviewDashboard] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [hypothesisComparison, setHypothesisComparison] = useState(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState('')
  const [analysisSubTab, setAnalysisSubTab]   = useState('strategy')   // 'strategy' | 'compare'
  const [researchSubTab, setResearchSubTab]   = useState('scan')        // 'scan' | 'watchlist'
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('lazarus-sidebar-collapsed') === 'true' } catch { return false }
  })

  const [searchParams, setSearchParams] = useSearchParams()

  const selectTab = useCallback(
    (id) => {
      if (!TAB_IDS.has(id)) return
      setActiveTab(id)
      setSearchParams(id === 'dashboard' ? {} : { tab: id }, { replace: true })
    },
    [setSearchParams],
  )

  useEffect(() => {
    const t = searchParams.get('tab')
    const next = t && TAB_IDS.has(t) ? t : 'dashboard'
    setActiveTab((cur) => (cur === next ? cur : next))
  }, [searchParams])

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const deferredGraphData    = useDeferredValue(graphData)
  const deferredSelectedNode = useDeferredValue(selectedNode)
  const runStatus = useRunStatus(analysisResult?.run, { analysisLoading, errorMessage })
  const { details: nodeDetails, overview: graphOverview, legendItems } = useGraphData(deferredGraphData, deferredSelectedNode)

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

  useEffect(() => {
    if (activeTab !== 'portfolio') return
    setPortfolioLoading(true)
    setPortfolioError('')
    fetchPortfolioRanking()
      .then(setPortfolioRanking)
      .catch(() => setPortfolioError('Unable to build the portfolio ranking board right now.'))
      .finally(() => setPortfolioLoading(false))
  }, [activeTab, analysisResult?.run?.id])

  useEffect(() => {
    if (activeTab !== 'ops') return
    setReviewLoading(true)
    setReviewError('')
    fetchHumanReviewDashboard()
      .then(setReviewDashboard)
      .catch(() => setReviewError('Unable to load the human review queue right now.'))
      .finally(() => setReviewLoading(false))
  }, [activeTab, analysisResult?.run?.id])

  useEffect(() => {
    if (activeTab !== 'analysis' || analysisSubTab !== 'compare' || !selectedAssetId) return
    setComparisonLoading(true)
    setComparisonError('')
    fetchHypothesisComparison(selectedAssetId)
      .then(setHypothesisComparison)
      .catch(() => setComparisonError('Unable to compare hypotheses for the selected asset.'))
      .finally(() => setComparisonLoading(false))
  }, [activeTab, analysisSubTab, selectedAssetId, analysisResult?.run?.id])

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('lazarus-sidebar-collapsed', String(next)) } catch {}
      return next
    })
  }

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
    selectTab('dashboard')
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
    selectTab('blueprint')
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

  const handleResolveReview = async (reviewId) => {
    await resolveHumanReview(reviewId, 'Resolved from Lazarus review dashboard.')
    const data = await fetchHumanReviewDashboard()
    setReviewDashboard(data)
    if (activeTab === 'portfolio') {
      const ranking = await fetchPortfolioRanking()
      setPortfolioRanking(ranking)
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
      <div className={`lazarus-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        {/* ══════════════ LEFT PANEL ══════════════ */}
        <aside className={`nexus-left${sidebarCollapsed ? ' collapsed' : ''}`}>
          {/* Brand row: title/subtitle left, collapse toggle right */}
          <div className="nexus-brand-row">
            <Link to="/" className="nexus-brand" style={{ textDecoration: 'none' }}>
              <span className="brand-title">Lazarus</span>
              <span className="brand-sub">Bio-R&amp;D Swarm · Clinical Reasoning Cluster</span>
            </Link>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? '›' : '‹'}
            </button>
          </div>

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
                {['Postgres', 'Neo4j', 'OpenAI', 'K2 Think', 'Spectrum'].map((s) => (
                  <span key={s} className="hud-service">{s}</span>
                ))}
              </div>
            </div>

            <div className="header-right">
              {/* Search */}
              <input
                aria-label="Search compounds"
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
                aria-label="Select asset for analysis"
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
          <nav className="nexus-tabnav" role="tablist" aria-label="Application tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => selectTab(tab.id)}
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
              {/* ═══ RESCUE PIPELINE (same /dashboard shell) ═══ */}
              {activeTab === 'rescue' && (
                <motion.div key="rescue" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <RescuePipelinePanel />
                </motion.div>
              )}

              {/* ═══ DASHBOARD ═══ */}
              {activeTab === 'dashboard' && (
                <motion.div key="dashboard" role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard" tabIndex={0} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
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

                      </div>

                      <div className="dash-side">
                        <ConfidenceGauge value={analysisResult?.run?.final_confidence} />
                      </div>
                    </div>

                    {/* Collapsible Agent Timeline */}
                    <div>
                      <button
                        type="button"
                        className="timeline-collapse-btn"
                        onClick={() => setTimelineExpanded(prev => !prev)}
                        aria-expanded={timelineExpanded}
                        aria-controls="agent-timeline-body"
                      >
                        <span className="timeline-collapse-label">Agent Timeline</span>
                        <span className="timeline-collapse-meta">
                          {runTrace?.steps?.filter(s => s.status === 'completed').length ?? 0}/{runTrace?.steps?.length ?? 0} complete
                          <span className="timeline-collapse-chevron">{timelineExpanded ? '▲' : '▼'}</span>
                        </span>
                      </button>
                      <AnimatePresence initial={false}>
                        {timelineExpanded && (
                          <motion.div
                            id="agent-timeline-body"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <AgentTimeline steps={runTrace?.steps ?? []} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══ GRAPH ═══ */}
              {activeTab === 'portfolio' && (
                <motion.div key="portfolio" role="tabpanel" id="panel-portfolio" aria-labelledby="tab-portfolio" tabIndex={0} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <PortfolioRankingPanel
                    ranking={portfolioRanking}
                    loading={portfolioLoading}
                    error={portfolioError}
                    onSelectAsset={(assetId) => {
                      setSelectedAssetId(assetId)
                      setAnalysisSubTab('compare')
                      selectTab('analysis')
                    }}
                  />
                </motion.div>
              )}

              {/* ═══ GRAPH ═══ */}
              {activeTab === 'graph' && (
                <motion.div key="graph" role="tabpanel" id="panel-graph" aria-labelledby="tab-graph" tabIndex={0} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <div className="graph-tab-grid">
                    <InteractiveGraph
                      graphData={deferredGraphData}
                      selectedNode={selectedNode}
                      setSelectedNode={setSelectedNode}
                      steps={runTrace?.steps ?? []}
                      runStatus={analysisResult?.run?.status ?? 'idle'}
                      legendItems={legendItems}
                    />
                    <NodeDetailsPanel details={nodeDetails} overview={graphOverview} />
                  </div>
                </motion.div>
              )}

              {/* ═══ ANALYSIS (Strategy + Compare) ═══ */}
              {activeTab === 'analysis' && (
                <motion.div key="analysis" role="tabpanel" id="panel-analysis" aria-labelledby="tab-analysis" tabIndex={0} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Sub-nav */}
                    <div className="sub-tabnav" role="group" aria-label="Analysis view">
                      <button
                        type="button"
                        className={`sub-tab-btn${analysisSubTab === 'strategy' ? ' active' : ''}`}
                        onClick={() => setAnalysisSubTab('strategy')}
                        aria-pressed={analysisSubTab === 'strategy'}
                      >
                        Strategy
                      </button>
                      <button
                        type="button"
                        className={`sub-tab-btn${analysisSubTab === 'compare' ? ' active' : ''}`}
                        onClick={() => setAnalysisSubTab('compare')}
                        aria-pressed={analysisSubTab === 'compare'}
                      >
                        Compare
                      </button>
                    </div>

                    {analysisSubTab === 'strategy' && (
                      <EffortImpactChart runId={analysisResult?.run?.id} />
                    )}
                    {analysisSubTab === 'compare' && (
                      <HypothesisComparisonPanel
                        comparison={hypothesisComparison}
                        loading={comparisonLoading}
                        error={comparisonError}
                      />
                    )}
                  </div>
                </motion.div>
              )}

              {/* ═══ OPS (Reviews + Messages) ═══ */}
              {activeTab === 'ops' && (
                <motion.div key="ops" role="tabpanel" id="panel-ops" aria-labelledby="tab-ops" tabIndex={0} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    <HumanReviewDashboard
                      dashboard={reviewDashboard}
                      loading={reviewLoading}
                      error={reviewError}
                      onResolve={handleResolveReview}
                    />
                    <div className="ops-section-divider">
                      <span className="ops-section-label">Messaging</span>
                    </div>
                    <MessagingPanel runId={analysisResult?.run?.id} />
                  </div>
                </motion.div>
              )}

              {/* ═══ RESEARCH (Scan + Watchlist) ═══ */}
              {activeTab === 'research' && (
                <motion.div key="research" role="tabpanel" id="panel-research" aria-labelledby="tab-research" tabIndex={0} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Sub-nav */}
                    <div className="sub-tabnav" role="group" aria-label="Research view">
                      <button
                        type="button"
                        className={`sub-tab-btn${researchSubTab === 'scan' ? ' active' : ''}`}
                        onClick={() => setResearchSubTab('scan')}
                        aria-pressed={researchSubTab === 'scan'}
                      >
                        Multi-Disease Scan
                      </button>
                      <button
                        type="button"
                        className={`sub-tab-btn${researchSubTab === 'watchlist' ? ' active' : ''}`}
                        onClick={() => setResearchSubTab('watchlist')}
                        aria-pressed={researchSubTab === 'watchlist'}
                      >
                        Watchlist
                      </button>
                    </div>

                    {researchSubTab === 'scan' && (
                      <MultiDiseaseScanPanel assets={assets} />
                    )}
                    {researchSubTab === 'watchlist' && (
                      <WatchlistPanel />
                    )}
                  </div>
                </motion.div>
              )}

              {/* ═══ BLUEPRINT ═══ */}
              {activeTab === 'blueprint' && (
                <motion.div key="blueprint" role="tabpanel" id="panel-blueprint" aria-labelledby="tab-blueprint" tabIndex={0} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
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
