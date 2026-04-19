import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { GlobeScene } from '../GlobeScene'
import { AgentLogFeed } from '../AgentLogFeed'

function ShellSidebar({ analysisLoading, runTrace }) {
  return (
    <aside className="nexus-left">
      <Link to="/" className="nexus-brand" style={{ textDecoration: 'none', display: 'block' }}>
        <span className="brand-title">Lazarus</span>
        <span className="brand-sub">Bio-R&amp;D Swarm · Clinical Reasoning Cluster</span>
      </Link>

      <div className="globe-wrap">
        <GlobeScene isRunning={analysisLoading} />
        <div className="globe-status">
          <span className={`globe-status-dot${analysisLoading ? ' running' : ''}`} />
          <span>{analysisLoading ? 'PROCESSING' : 'STANDBY'}</span>
        </div>
      </div>

      <div className="agent-log-panel">
        <div className="panel-label">Agent Stream</div>
        <AgentLogFeed steps={runTrace?.steps ?? []} isRunning={analysisLoading} />
      </div>
    </aside>
  )
}

ShellSidebar.propTypes = {
  analysisLoading: PropTypes.bool.isRequired,
  runTrace: PropTypes.shape({
    steps: PropTypes.array,
  }),
}

export default ShellSidebar
