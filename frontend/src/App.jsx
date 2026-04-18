import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ResetConfirmDialog from './components/app/ResetConfirmDialog'
import ShellHeader from './components/app/ShellHeader'
import ShellSidebar from './components/app/ShellSidebar'
import StatusStrip from './components/app/StatusStrip'
import TabContent from './components/app/TabContent'
import { useGraphData } from './hooks/useGraphData'
import { useAnalysisInsights } from './hooks/useAnalysisInsights'
import { useRunStatus } from './hooks/useRunStatus'
import {
  evaluateCandidate,
  fetchAssets,
  fetchCandidates,
  fetchBlueprintDetail,
  fetchGraph,
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
  const [diseaseQuery, setDiseaseQuery]   = useState('')
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [candidates, setCandidates]       = useState([])
  const [selectedCandidateAssetId, setSelectedCandidateAssetId] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const deferredGraphData    = useDeferredValue(graphData)
  const deferredSelectedNode = useDeferredValue(selectedNode)
  const runStatus = useRunStatus(analysisResult?.run, { analysisLoading, errorMessage })
  const { details: nodeDetails, legendItems } = useGraphData(deferredGraphData, deferredSelectedNode)
  const { metrics, liveInsight } = useAnalysisInsights(analysisResult, runTrace)

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return assets
    return assets.filter((asset) =>
      `${asset.asset_code} ${asset.original_indication} ${asset.internal_name}`.toLowerCase().includes(normalized),
    )
  }, [assets, query])

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.asset_id === selectedCandidateAssetId) ?? null,
    [candidates, selectedCandidateAssetId],
  )

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

  const handleFindCandidates = async () => {
    const disease = diseaseQuery.trim()
    if (!disease) return

    setCandidateLoading(true)
    setErrorMessage('')
    try {
      const result = await fetchCandidates(disease)
      const nextCandidates = result?.candidates ?? []
      setCandidates(nextCandidates)
      setSelectedCandidateAssetId(nextCandidates[0]?.asset_id ?? '')

      if (!nextCandidates.length) {
        setErrorMessage(`No candidate drugs found for "${disease}".`)
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail ?? error.message ?? 'Failed to fetch disease candidates.')
    } finally {
      setCandidateLoading(false)
    }
  }

  const handleRunAnalysis = async () => {
    if (!selectedAssetId && !selectedCandidate) return
    setActiveTab('dashboard')
    setAnalysisLoading(true)
    setErrorMessage('')
    setAnalysisResult(null)
    setRunTrace(null)
    setBlueprintResult(null)
    setGraphData(emptyGraph)
    setSelectedNode(null)
    try {
      const job = selectedCandidate
        ? await evaluateCandidate({
            drug: selectedCandidate.drug_name,
            disease: diseaseQuery.trim() || selectedCandidate.proposed_disease,
            assetCode: selectedCandidate.asset_code,
          })
        : await startAnalysisJob(selectedAssetId, 'manual')

      setAnalysisResult({ run: job.run, asset_code: job.asset_code, hypothesis: null })
      const graph = await fetchGraph(selectedCandidate?.asset_id ?? selectedAssetId)
      startTransition(() => {
        setGraphData(graph)
        setSelectedNode(graph.nodes.find((n) => n.highlight) ?? graph.nodes[0] ?? null)
      })

      await new Promise((resolve, reject) => {
        const subscription = subscribeRunStream(job.run.id, {
          onMessage: (payload) => {
            if (payload?.error) { subscription.close(); reject(new Error(payload.error)); return }
            setAnalysisResult({
              run:       payload.run,
              asset_code: payload.asset_code ?? job.asset_code,
              hypothesis: payload.hypothesis ?? null,
            })
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

  return (
    <>
      <div className="lazarus-shell">
        <ShellSidebar analysisLoading={analysisLoading} runTrace={runTrace} />

        <div className="nexus-right">
          <ShellHeader
            query={query}
            setQuery={setQuery}
            diseaseQuery={diseaseQuery}
            setDiseaseQuery={setDiseaseQuery}
            handleFindCandidates={handleFindCandidates}
            candidateLoading={candidateLoading}
            candidates={candidates}
            selectedCandidateAssetId={selectedCandidateAssetId}
            setSelectedCandidateAssetId={setSelectedCandidateAssetId}
            selectedAssetId={selectedAssetId}
            setSelectedAssetId={setSelectedAssetId}
            filteredAssets={filteredAssets}
            handleRunAnalysis={handleRunAnalysis}
            analysisLoading={analysisLoading}
            handleGenerateBlueprint={handleGenerateBlueprint}
            analysisResult={analysisResult}
            blueprintLoading={blueprintLoading}
            setShowResetConfirm={setShowResetConfirm}
          />

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

          <StatusStrip runStatus={runStatus} />

          {/* Content area */}
          <div className="nexus-content">
            <AnimatePresence mode="wait">
              <TabContent
                activeTab={activeTab}
                pageVariants={pageVariants}
                runTrace={runTrace}
                analysisResult={analysisResult}
                deferredGraphData={deferredGraphData}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                legendItems={legendItems}
                nodeDetails={nodeDetails}
                metrics={metrics}
                liveInsight={liveInsight}
                completedSteps={completedSteps}
                totalSteps={totalSteps}
                blueprintLoading={blueprintLoading}
                blueprintResult={blueprintResult}
              />
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ResetConfirmDialog
        showResetConfirm={showResetConfirm}
        setShowResetConfirm={setShowResetConfirm}
        resetGraph={resetGraph}
      />
    </>
  )
}

export default App
