import React, { memo } from 'react'
import { ActivitySquare, FileText, GitBranch, Hexagon, Pill, Sparkles, Target } from 'lucide-react'

const nodeItems = {
  Drug: { icon: Pill, color: 'bg-blue-600', border: 'border-blue-700', description: 'Portfolio asset under review' },
  Target: { icon: Target, color: 'bg-amber-500', border: 'border-amber-600', description: 'Mechanism or pathway anchor' },
  Disease: { icon: ActivitySquare, color: 'bg-emerald-600', border: 'border-emerald-700', description: 'Original or proposed indication' },
  Evidence: { icon: FileText, color: 'bg-violet-600', border: 'border-violet-700', description: 'Trial or literature support' },
  Hypothesis: { icon: Sparkles, color: 'bg-rose-600', border: 'border-rose-700', description: 'Synthesized repurposing thesis' },
  Strategy: { icon: Hexagon, color: 'bg-slate-800', border: 'border-slate-900', description: 'Recommended execution pathway' },
}

const edgeItems = [
  'TARGETS',
  'FAILED_FOR',
  'ORIGINALLY_INDICATED_FOR',
  'SUPPORTED_BY',
  'PROPOSES_REPURPOSING_OF',
  'TO_DISEASE',
  'BASED_ON_TARGET',
  'RECOMMENDS',
]

function GraphLegend({ items = [] }) {
  const mergedItems = [...new Map(
    [...items, ...Object.entries(nodeItems).map(([type, value]) => ({ type, description: value.description }))]
      .map((item) => [item.type, item]),
  ).values()]

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-panel">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Graph Legend</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">Node Types & Relationships</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {mergedItems.map((item) => {
          const config = nodeItems[item.type] ?? nodeItems.Hypothesis
          const Icon = config.icon
          return (
            <div key={item.type} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-white shadow-sm ${config.color} ${config.border}`}>
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{item.type}</div>
                <div className="text-xs leading-5 text-slate-500">{item.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <GitBranch className="h-4 w-4" />
          Edge Semantics
        </div>
        <div className="flex flex-wrap gap-2">
          {edgeItems.map((edge) => (
            <span key={edge} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              {edge}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default memo(GraphLegend)
