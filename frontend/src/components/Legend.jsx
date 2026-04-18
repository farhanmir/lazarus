import React, { memo } from 'react'
import { ActivitySquare, FileText, Pill, Sparkles, Target } from 'lucide-react'

const iconMap = {
  Drug: Pill,
  Target: Target,
  Disease: ActivitySquare,
  Evidence: FileText,
  Hypothesis: Sparkles,
}

const colorMap = {
  Drug: 'from-blue-500 to-blue-600 text-blue-50',
  Target: 'from-amber-500 to-orange-500 text-white',
  Disease: 'from-emerald-500 to-green-500 text-white',
  Evidence: 'from-violet-500 to-purple-500 text-white',
  Hypothesis: 'from-rose-500 to-red-500 text-white',
}

function Legend({ items = [] }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Graph Legend</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Knowledge Layers</h3>
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = iconMap[item.type] ?? Sparkles
          return (
            <div
              key={item.type}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3"
            >
              <div className={`flex-shrink-0 rounded-xl bg-gradient-to-br p-2 shadow-lg ${colorMap[item.type] ?? colorMap.Hypothesis}`}>
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.type}</p>
                <p className="text-xs leading-4 text-slate-500 truncate">{item.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(Legend)
