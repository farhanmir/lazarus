import React, { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const toneMap = {
  slate: 'from-slate-100 to-white text-slate-700 border-slate-200',
  indigo: 'from-indigo-50 to-white text-indigo-700 border-indigo-200',
  blue: 'from-blue-50 to-white text-blue-700 border-blue-200',
  green: 'from-emerald-50 to-white text-emerald-700 border-emerald-200',
  red: 'from-rose-50 to-white text-rose-700 border-rose-200',
}

function RunStatusBanner({ status }) {
  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={status.label}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className={`rounded-3xl border bg-gradient-to-r px-5 py-4 shadow-panel ${toneMap[status.tone] ?? toneMap.slate}`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">System Status</p>
            <h2 className="mt-1 text-xl font-semibold">
              {status.label === 'Running' ? 'Running Analysis...' : status.label === 'Completed' ? 'Analysis Complete' : status.label}
            </h2>
            <p className="mt-1 text-sm">{status.description}</p>
          </div>
          <div className="min-w-[240px] flex-1 lg:max-w-sm">
            <div className="h-2 overflow-hidden rounded-full bg-white/80">
              <motion.div
                className="h-full rounded-full bg-current"
                initial={{ width: 0 }}
                animate={{ width: `${status.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  )
}

export default memo(RunStatusBanner)
