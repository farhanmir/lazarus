import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  BrainCircuit,
  FileText,
  LayoutDashboard,
  MessageCircle,
  MoonStar,
  Network,
  RotateCcw,
  Search,
  SunMedium,
  TrendingUp,
  Zap,
} from 'lucide-react'
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

const emptyGraph = {
  nodes: [],
  links: [],
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'graph', label: 'Graph Explorer', icon: Network },
  { id: 'agents', label: 'Agent Timeline', icon: BrainCircuit },
  { id: 'strategy', label: 'Strategy', icon: TrendingUp },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'blueprint', label: 'Blueprint', icon: FileText },
]

const pageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

const glowPulse = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(16,185,129,0.15)',
      '0 0 40px rgba(16,185,129,0.25)',
      '0 0 20px rgba(16,185,129,0.15)',
    ],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
}

function ParticleField() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2,
        duration: 15 + Math.random() * 25,
        delay: Math.random() * 10,
      })),
    [],
  )

  return (
    <div className="particle-field" aria-hidden="true">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="particle"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{
            y: [0, -30, 10, -20, 0],
            x: [0, 15, -10, 5, 0],
            opacity: [0, 0.6, 0.3, 0.7, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

function App() {
  const [assets, setAssets] = useState([])
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [graphData, setGraphData] = useState(emptyGraph)
  const [selectedNode, setSelectedNode] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [blueprintLoading, setBlueprintLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [runTrace, setRunTrace] = useState(null)
  const [blueprintResult, setBlueprintResult] = useState(null)
  const [theme, setTheme] = useState('light')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const deferredGraphData = useDeferredValue(graphData)
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
    const skepticStep = runTrace?.steps?.find((step) => step.agent_name === 'skeptic')
    const strategistStep = runTrace?.steps?.find((step) => step.agent_name === 'trial_strategist')
    let riskLevel = 'Awaiting review'
    let priorityLevel = analysisResult?.hypothesis?.priority_level ?? 'Awaiting strategy'

    try {
      const skepticPayload = skepticStep?.output_summary ? JSON.parse(skepticStep.output_summary) : null
      if (skepticPayload?.risk_level) riskLevel = skepticPayload.risk_level
    } catch {
      // Keep fallback display when a step payload is not JSON.
    }

    try {
      const strategyPayload = strategistStep?.output_summary ? JSON.parse(strategistStep.output_summary) : null
      if (strategyPayload?.priority_level) priorityLevel = strategyPayload.priority_level
    } catch {
      // Keep fallback display when a step payload is not JSON.
    }

    const confidence = analysisResult?.run?.final_confidence
    const formattedConfidence =
      typeof confidence === 'number'
        ? `${(confidence <= 1 ? confidence * 100 : confidence).toFixed(1)}%`
        : 'Awaiting score'

    return [
      {
        key: 'hypothesis',
        label: 'Selected Hypothesis',
        value: analysisResult?.hypothesis
          ? `${analysisResult.hypothesis.source_disease} → ${analysisResult.hypothesis.target_disease}`
          : 'Awaiting analysis',
        caption: 'Active mechanistic repurposing candidate',
      },
      {
        key: 'confidence',
        label: 'Confidence',
        value: formattedConfidence,
        caption: analysisResult?.run?.final_recommendation ?? 'No decision yet',
      },
      {
        key: 'risk',
        label: 'Risk Level',
        value: riskLevel,
        caption: 'Derived from skeptical review and safety pressure tests',
      },
      {
        key: 'priority',
        label: 'Priority Level',
        value: priorityLevel,
        caption: 'Trial strategist recommendation for next-stage focus',
      },
    ]
  }, [analysisResult?.hypothesis, analysisResult?.run?.final_confidence, analysisResult?.run?.final_recommendation, runTrace?.steps])

  const liveInsight = useMemo(() => {
    const skepticStep = runTrace?.steps?.find((step) => step.agent_name.includes('skeptic'))
    const strategistStep = runTrace?.steps?.find((step) => step.agent_name === 'trial_strategist')
    let riskLevel = 'Unknown'
    let priorityLevel = analysisResult?.hypothesis?.priority_level ?? 'Pending'

    try {
      const skepticPayload = skepticStep?.output_summary ? JSON.parse(skepticStep.output_summary) : null
      if (skepticPayload?.risk_level) riskLevel = skepticPayload.risk_level
    } catch {
      // Ignore non-JSON payloads.
    }

    try {
      const strategyPayload = strategistStep?.output_summary ? JSON.parse(strategistStep.output_summary) : null
      if (strategyPayload?.priority_level) priorityLevel = strategyPayload.priority_level
    } catch {
      // Ignore non-JSON payloads.
    }

    const runtimeMs = analysisResult?.run?.started_at && analysisResult?.run?.completed_at
      ? new Date(analysisResult.run.completed_at).getTime() - new Date(analysisResult.run.started_at).getTime()
      : null

    return {
      riskLevel,
      priorityLevel,
      runtimeLabel: runtimeMs !== null ? `${(runtimeMs / 1000).toFixed(1)}s` : 'Live',
    }
  }, [analysisResult?.hypothesis?.priority_level, analysisResult?.run?.completed_at, analysisResult?.run?.started_at, runTrace?.steps])

  useEffect(() => {
    fetchAssets()
      .then((data) => {
        setAssets(data)
        if (data.length) {
          setSelectedAssetId(data[0].id)
        }
      })
      .catch(() => {
        setErrorMessage('Unable to load assets from the Lazarus backend.')
      })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

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
        setSelectedNode(graph.nodes.find((node) => node.highlight) ?? graph.nodes[0] ?? null)
      })

      await new Promise((resolve, reject) => {
        const subscription = subscribeRunStream(job.run.id, {
          onMessage: (payload) => {
            if (payload?.error) {
              subscription.close()
              reject(new Error(payload.error))
              return
            }

            setAnalysisResult((current) => ({
              ...current,
              run: payload.run,
              asset_code: payload.asset_code ?? current?.asset_code ?? job.asset_code,
              hypothesis: payload.hypothesis ?? null,
            }))
            setRunTrace(payload)

            if (payload.run?.status === 'failed') {
              subscription.close()
              reject(new Error(payload.run.error_message || 'Analysis failed to complete.'))
            }

            if (payload.run?.status === 'completed') {
              subscription.close()
              resolve(payload)
            }
          },
          onError: () => {
            reject(new Error('Real-time run stream disconnected unexpectedly.'))
          },
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

      if (detail.blueprint.generation_status === 'failed') {
        throw new Error('Blueprint generation failed.')
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail ?? error.message ?? 'Blueprint generation failed.')
    } finally {
      setBlueprintLoading(false)
    }
  }

  const completedSteps = runTrace?.steps?.filter((s) => s.status === 'completed').length ?? 0
  const totalSteps = 5

  return (
    <>
      <ParticleField />
      <div className="scanlines" aria-hidden="true" />
      <div className="scan-beam" aria-hidden="true" />

      <div className="nexus-shell flex min-h-screen">
        {/* ─── Sidebar Navigation ─── */}
        <motion.nav
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="nexus-sidebar"
        >
          <div className="flex flex-col items-center gap-2 pb-6 pt-5 border-b border-white/5">
            <motion.div
              className="nexus-logo"
              whileHover={{ scale: 1.1, rotate: 10 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <BrainCircuit className="h-7 w-7 text-emerald-400" />
            </motion.div>
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-400/80">Lazarus</span>
          </div>

          <div className="mt-6 flex flex-1 flex-col gap-1 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`nav-tab ${isActive ? 'nav-tab-active' : ''}`}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="nav-tab-label">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="nav-indicator"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </motion.button>
              )
            })}
          </div>

          <div className="mt-auto flex flex-col gap-2 border-t border-white/5 px-2 pt-4 pb-4">
            <button
              type="button"
              onClick={() => setTheme((c) => (c === 'light' ? 'dark' : 'light'))}
              className="nav-tab"
            >
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              <span className="nav-tab-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </motion.nav>

        {/* ─── Main Content ─── */}
        <main className="nexus-main">
          {/* ─── Top Bar ─── */}
          <motion.header
            className="nexus-topbar"
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-white/90">Autonomous Clinical R&amp;D Swarm</h1>
              </div>
              <div className="hidden md:flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 ml-4">
                <span className="hud-dot">Postgres</span>
                <span className="hud-dot">Neo4j</span>
                <span className="hud-dot">Dedalus</span>
                <span className="hud-dot">K2 Think</span>
                <span className="hud-dot">Spectrum</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Inline asset selector */}
              <div className="topbar-search">
                <Search className="h-3.5 w-3.5 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search assets..."
                  className="bg-transparent text-xs text-white/80 outline-none placeholder:text-slate-500 w-32 lg:w-48"
                />
              </div>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="topbar-select"
              >
                <option value="">Select asset</option>
                {filteredAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.asset_code} · {asset.internal_name}
                  </option>
                ))}
              </select>

              {/* Action buttons */}
              <motion.button
                type="button"
                onClick={handleRunAnalysis}
                disabled={!selectedAssetId || analysisLoading}
                className="topbar-btn topbar-btn-primary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                {...(analysisLoading ? glowPulse : {})}
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{analysisLoading ? 'Running...' : 'Analyze'}</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={handleGenerateBlueprint}
                disabled={!analysisResult?.hypothesis?.id || blueprintLoading}
                className="topbar-btn topbar-btn-secondary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{blueprintLoading ? 'Generating...' : 'Blueprint'}</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="topbar-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </motion.button>

              {analysisResult?.run && (
                <div className="nexus-run-chip-mini">
                  <span className="text-emerald-400 text-[9px]">●</span>
                  <span className="text-[10px] text-slate-400 font-mono">{analysisResult.run.id?.slice(0, 8)}</span>
                </div>
              )}
            </div>
          </motion.header>

          {/* ─── Error Banner ─── */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-4 mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300"
              >
                {errorMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Status Strip ─── */}
          <div className="nexus-status-strip mx-4 mt-3">
            <div className="flex items-center gap-3 text-xs">
              <span className={`status-dot ${runStatus.tone === 'green' ? 'status-dot-green' : runStatus.tone === 'blue' ? 'status-dot-blue' : runStatus.tone === 'red' ? 'status-dot-red' : 'status-dot-default'}`} />
              <span className="text-slate-400 font-medium">{runStatus.label}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">{runStatus.description}</span>
            </div>
            <div className="status-progress-bar">
              <motion.div
                className="status-progress-fill"
                animate={{ width: `${runStatus.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* ─── Tab Content ─── */}
          <div className="nexus-content">
            <AnimatePresence mode="wait">
              {/* ═══ DASHBOARD TAB ═══ */}
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4">
                    {/* Pipeline + Metrics Row */}
                    <motion.div variants={staggerItem}>
                      <AgentProgressBar steps={runTrace?.steps ?? []} runStatus={analysisResult?.run?.status ?? 'idle'} />
                    </motion.div>

                    {/* Metrics + Confidence + Decision in a combined row */}
                    <motion.div variants={staggerItem} className="grid gap-4 xl:grid-cols-[1fr_280px]">
                      <div className="grid gap-4">
                        <MetricsBar metrics={metrics} />
                        {/* Inline Decision Feed */}
                        <div className="nexus-glass-card p-5">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Live Decision Feed</p>
                              <h2 className="mt-1 text-lg font-semibold text-white/90">
                                {analysisResult?.run?.final_recommendation ?? 'Awaiting final recommendation'}
                              </h2>
                              <p className="mt-1.5 text-xs text-slate-500">
                                Total run: {liveInsight.runtimeLabel} {analysisResult?.run?.status === 'running' ? '· streaming' : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <RiskBadge label={liveInsight.riskLevel} />
                              <RiskBadge label={liveInsight.priorityLevel} prefix="Priority" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        <ConfidenceGauge value={analysisResult?.run?.final_confidence} />
                        {/* Mini pipeline progress */}
                        <div className="nexus-glass-card p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-3">Pipeline Progress</p>
                          <div className="flex items-center gap-2">
                            {Array.from({ length: totalSteps }, (_, i) => (
                              <motion.div
                                key={i}
                                className={`h-2 flex-1 rounded-full ${i < completedSteps ? 'bg-emerald-500' : 'bg-slate-700/50'}`}
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 0.3, delay: i * 0.08 }}
                              />
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2">{completedSteps}/{totalSteps} stages complete</p>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {/* ═══ GRAPH TAB ═══ */}
              {activeTab === 'graph' && (
                <motion.div
                  key="graph"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="grid gap-4 h-full"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
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

              {/* ═══ AGENTS TAB ═══ */}
              {activeTab === 'agents' && (
                <motion.div
                  key="agents"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <AgentTimeline steps={runTrace?.steps ?? []} />
                </motion.div>
              )}

              {/* ═══ STRATEGY TAB ═══ */}
              {activeTab === 'strategy' && (
                <motion.div
                  key="strategy"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <EffortImpactChart runId={analysisResult?.run?.id} />
                </motion.div>
              )}

              {/* ═══ MESSAGES TAB ═══ */}
              {activeTab === 'messages' && (
                <motion.div
                  key="messages"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <MessagingPanel runId={analysisResult?.run?.id} />
                </motion.div>
              )}

              {/* ═══ BLUEPRINT TAB ═══ */}
              {activeTab === 'blueprint' && (
                <motion.div
                  key="blueprint"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="grid gap-4"
                >
                  <BlueprintProgress loading={blueprintLoading} ready={Boolean(blueprintResult?.blueprint?.id)} />
                  <BlueprintViewer
                    blueprintResult={blueprintResult}
                    blueprintLoading={blueprintLoading}
                    downloadUrl={
                      blueprintResult?.blueprint?.id ? getBlueprintDownloadUrl(blueprintResult.blueprint.id) : undefined
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Reset confirm modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.96 }}
              className="nexus-glass-card w-full max-w-md p-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Confirm Reset</p>
              <h3 className="mt-2 text-xl font-semibold text-white/90">Clear the current workspace?</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                This clears the graph, run context, and blueprint preview.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { setShowResetConfirm(false); resetGraph() }}
                  className="rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition"
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
