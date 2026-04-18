import { motion } from 'framer-motion'
import PropTypes from 'prop-types'
import AgentProgressBar from '../AgentProgressBar'
import MetricsBar from '../MetricsBar'
import ConfidenceGauge from '../ConfidenceGauge'
import RiskBadge from '../RiskBadge'

function DashboardTab({ pageVariants, runTrace, analysisResult, metrics, liveInsight, completedSteps, totalSteps }) {
  return (
    <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <AgentProgressBar steps={runTrace?.steps ?? []} runStatus={analysisResult?.run?.status ?? 'idle'} />
        <MetricsBar metrics={metrics} />

        <div className="dash-grid">
          <div className="dash-main">
            <div className="term-panel">
              <div className="term-panel-header">
                <span className="term-panel-title">Live Decision</span>
                <span className="panel-meta-label">
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
                    <div className="decision-line decision-tags-row">
                      <RiskBadge label={liveInsight.riskLevel} />
                      <RiskBadge label={liveInsight.priorityLevel} prefix="Priority" />
                    </div>
                  </>
                ) : (
                  <div className="decision-empty">&gt; AWAITING FINAL RECOMMENDATION</div>
                )}
              </div>
            </div>

            <div className="term-panel dashboard-progress-panel">
              <div className="term-panel-header">
                <span className="term-panel-title">Pipeline Progress</span>
                <span className="panel-meta-label">
                  {completedSteps}/{totalSteps}
                </span>
              </div>
              <div className="pipeline-track-row">
                {Array.from({ length: totalSteps }, (_, index) => (
                  <motion.div
                    key={index}
                    className="pipeline-track-segment"
                    style={{
                      background: index < completedSteps ? 'var(--accent)' : 'rgba(20,23,26,0.1)',
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.07 }}
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
  )
}

DashboardTab.propTypes = {
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
      status: PropTypes.string,
      final_recommendation: PropTypes.string,
      final_confidence: PropTypes.number,
    }),
  }),
  metrics: PropTypes.array.isRequired,
  liveInsight: PropTypes.shape({
    runtimeLabel: PropTypes.string,
    riskLevel: PropTypes.string,
    priorityLevel: PropTypes.string,
  }).isRequired,
  completedSteps: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired,
}

export default DashboardTab
