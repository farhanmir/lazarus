import { AnimatePresence, motion } from 'framer-motion'
import PropTypes from 'prop-types'

function ResetConfirmDialog({ showResetConfirm, setShowResetConfirm, resetGraph }) {
  return (
    <AnimatePresence>
      {showResetConfirm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="reset-overlay">
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.97 }}
            className="reset-dialog"
          >
            <div className="reset-title">Confirm reset</div>
            <div className="reset-msg">Clear graph, run context, and blueprint preview. This cannot be undone.</div>
            <div className="reset-actions">
              <button type="button" onClick={() => setShowResetConfirm(false)} className="term-btn term-btn-ghost">
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false)
                  resetGraph()
                }}
                className="term-btn reset-confirm-btn"
              >
                Reset
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

ResetConfirmDialog.propTypes = {
  showResetConfirm: PropTypes.bool.isRequired,
  setShowResetConfirm: PropTypes.func.isRequired,
  resetGraph: PropTypes.func.isRequired,
}

export default ResetConfirmDialog
