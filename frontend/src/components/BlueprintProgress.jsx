import React, { memo } from 'react'
import { FileCheck2, LoaderCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

function BlueprintProgress({ loading, ready }) {
  return (
    <AnimatePresence>
      {(loading || ready) ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-panel"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 text-white ${loading ? 'bg-blue-600' : 'bg-emerald-600'}`}>
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileCheck2 className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {loading ? 'Generating Executive Blueprint...' : 'Blueprint Ready'}
              </p>
              <p className="text-sm text-slate-500">
                {loading ? 'Rendering PDF package and artifact bundle.' : 'Executive artifact is ready to download and share.'}
              </p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default memo(BlueprintProgress)
