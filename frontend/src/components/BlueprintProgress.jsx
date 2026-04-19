import React, { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

function BlueprintProgress({ loading, ready }) {
  return (
    <AnimatePresence>
      {(loading || ready) ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ overflow: 'hidden' }}
        >
          <div className="term-panel" style={{ marginBottom: 0 }}>
            <div className="term-panel-header">
              <span className="term-panel-title">
                {loading ? 'Generating Blueprint' : 'Blueprint Ready'}
              </span>
              <span style={{
                fontSize: '11px',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.06em',
                color: loading ? 'var(--amber)' : 'var(--accent)',
                animation: loading ? 'hudPulse 1.5s ease-in-out infinite' : 'none',
              }}>
                {loading ? 'PROCESSING' : 'COMPLETE'}
              </span>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default memo(BlueprintProgress)
