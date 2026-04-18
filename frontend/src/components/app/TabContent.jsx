import { motion } from 'framer-motion'
import PropTypes from 'prop-types'
import AgentTimeline from '../AgentTimeline'
import BlueprintProgress from '../BlueprintProgress'
import BlueprintViewer from '../BlueprintViewer'
import EffortImpactChart from '../EffortImpactChart'
import InteractiveGraph from '../InteractiveGraph'
import MessagingPanel from '../MessagingPanel'
import NodeDetailsPanel from '../NodeDetailsPanel'
import { getBlueprintDownloadUrl } from '../../services/api'
import DashboardTab from './DashboardTab'

function TabContent({
  activeTab,
  pageVariants,
  runTrace,
  analysisResult,
  deferredGraphData,
  selectedNode,
  setSelectedNode,
  legendItems,
  nodeDetails,
  metrics,
  liveInsight,
  completedSteps,
  totalSteps,
  blueprintLoading,
  blueprintResult,
}) {
  if (activeTab === 'dashboard') {
    return (
      <DashboardTab
        pageVariants={pageVariants}
        runTrace={runTrace}
        analysisResult={analysisResult}
        metrics={metrics}
        liveInsight={liveInsight}
        completedSteps={completedSteps}
        totalSteps={totalSteps}
      />
    )
  }

  if (activeTab === 'graph') {
    return (
      <motion.div key="graph" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
        <div className="graph-grid-layout">
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
    )
  }

  if (activeTab === 'agents') {
    return (
      <motion.div key="agents" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
        <AgentTimeline steps={runTrace?.steps ?? []} />
      </motion.div>
    )
  }

  if (activeTab === 'strategy') {
    return (
      <motion.div key="strategy" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
        <EffortImpactChart runId={analysisResult?.run?.id} />
      </motion.div>
    )
  }

  if (activeTab === 'messages') {
    return (
      <motion.div key="messages" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
        <MessagingPanel runId={analysisResult?.run?.id} />
      </motion.div>
    )
  }

  return (
    <motion.div key="blueprint" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
      <div className="blueprint-column-layout">
        <BlueprintProgress loading={blueprintLoading} ready={Boolean(blueprintResult?.blueprint?.id)} />
        <BlueprintViewer
          blueprintResult={blueprintResult}
          blueprintLoading={blueprintLoading}
          downloadUrl={blueprintResult?.blueprint?.id ? getBlueprintDownloadUrl(blueprintResult.blueprint.id) : undefined}
        />
      </div>
    </motion.div>
  )
}

TabContent.propTypes = {
  activeTab: PropTypes.string.isRequired,
  pageVariants: PropTypes.shape({
    initial: PropTypes.object,
    animate: PropTypes.object,
    exit: PropTypes.object,
  }).isRequired,
  runTrace: PropTypes.shape({
    steps: PropTypes.array,
  }),
  analysisResult: PropTypes.shape({
    run: PropTypes.shape({
      id: PropTypes.string,
      status: PropTypes.string,
      final_confidence: PropTypes.number,
    }),
  }),
  deferredGraphData: PropTypes.shape({
    nodes: PropTypes.array,
    links: PropTypes.array,
  }).isRequired,
  selectedNode: PropTypes.object,
  setSelectedNode: PropTypes.func.isRequired,
  legendItems: PropTypes.array,
  nodeDetails: PropTypes.object,
  metrics: PropTypes.array.isRequired,
  liveInsight: PropTypes.shape({
    riskLevel: PropTypes.string,
    priorityLevel: PropTypes.string,
    runtimeLabel: PropTypes.string,
  }).isRequired,
  completedSteps: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired,
  blueprintLoading: PropTypes.bool.isRequired,
  blueprintResult: PropTypes.shape({
    blueprint: PropTypes.shape({
      id: PropTypes.string,
    }),
  }),
}

export default TabContent
