import React, { memo } from 'react'
import { ActivitySquare, FileText, Link2, Pill, Sparkles, Target } from 'lucide-react'

const iconMap = {
  Drug: Pill,
  Target: Target,
  Disease: ActivitySquare,
  Evidence: FileText,
  Hypothesis: Sparkles,
}

const accentMap = {
  Drug: 'from-blue-500 to-blue-600',
  Target: 'from-amber-500 to-orange-500',
  Disease: 'from-emerald-500 to-green-500',
  Evidence: 'from-violet-500 to-purple-500',
  Hypothesis: 'from-rose-500 to-red-500',
}

function NodeDetailsPanel({ details }) {
  if (!details) {
    return (
      <aside className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500 shadow-panel">
        Select a node in the graph to inspect its reasoning role, confidence, evidence summary, and linked entities.
      </aside>
    )
  }

  const Icon = iconMap[details.type] ?? Sparkles

  return (
    <aside className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-panel backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg ${accentMap[details.type] ?? accentMap.Hypothesis}`}>
            <Icon className="h-5 w-5" strokeWidth={2.1} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Node Details</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{details.label}</h3>
            <p className="text-sm text-slate-500">{details.type}</p>
          </div>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
          {details.confidenceLabel}
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Description</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{details.description}</p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Evidence Summary</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{details.evidenceSummary}</p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            <Link2 className="h-4 w-4" />
            Relationships
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {details.relationships.length ? (
              details.relationships.map((relationship) => (
                <span
                  key={`${relationship.direction}-${relationship.label}-${relationship.target}`}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {relationship.direction} {relationship.label} {relationship.target}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">No linked relationships available.</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

export default memo(NodeDetailsPanel)
