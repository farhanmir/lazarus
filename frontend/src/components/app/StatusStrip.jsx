import { motion } from 'framer-motion'
import PropTypes from 'prop-types'

function StatusStrip({ runStatus }) {
  let dotClass = 'status-dot-strip dot-idle'
  if (runStatus.tone === 'green') dotClass = 'status-dot-strip dot-done'
  else if (runStatus.tone === 'blue') dotClass = 'status-dot-strip dot-running'
  else if (runStatus.tone === 'red') dotClass = 'status-dot-strip dot-error'

  return (
    <div className="nexus-status-strip">
      <div className="status-info">
        <span className={dotClass} />
        <span className="status-label">{runStatus.label}</span>
        <span className="status-separator">·</span>
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
  )
}

StatusStrip.propTypes = {
  runStatus: PropTypes.shape({
    tone: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    progress: PropTypes.number.isRequired,
  }).isRequired,
}

export default StatusStrip
