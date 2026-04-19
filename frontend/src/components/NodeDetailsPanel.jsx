import React, { memo } from 'react'
import { ActivitySquare, FileText, GitBranch, Hexagon, Link2, Pill, Route, Sparkles, Target } from 'lucide-react'

const iconMap = {
  Drug: Pill,
  Target: Target,
  Disease: ActivitySquare,
  Evidence: FileText,
  Hypothesis: Sparkles,
  Strategy: Hexagon,
}

const accentMap = {
  Drug: 'from-blue-500 to-blue-600',
  Target: 'from-amber-500 to-orange-500',
  Disease: 'from-emerald-500 to-green-500',
  Evidence: 'from-violet-500 to-purple-500',
  Hypothesis: 'from-rose-500 to-red-500',
  Strategy: 'from-slate-700 to-slate-900',
}

function NodeDetailsPanel({ details, overview }) {
  const Icon = iconMap[details?.type] ?? Sparkles

  return (
    <aside className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-panel backdrop-blur">
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <Route className="h-4 w-4" />
          Graph Flow
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {overview?.summary ?? 'The graph explains how the asset moves from target to disease, evidence, hypothesis, and strategy.'}
        </p>
        {!!overview?.flow?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {overview.flow.map((item) => (
              <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                {item}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{overview?.evidenceCount ?? 0} evidence nodes</span>
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{overview?.relationshipCount ?? 0} relationships</span>
        </div>
      </div>

      {!details ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500 shadow-panel">
          Select a node in the graph to inspect its role, related links, and the meaning of each relationship.
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
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

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Node Role</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{details.typeDescription}</p>
          </div>

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

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <GitBranch className="h-4 w-4" />
              Relationship Meaning
            </div>
            <div className="mt-3 grid gap-2">
              {overview?.relationshipMeanings?.length ? (
                overview.relationshipMeanings.map((relationship) => (
                  <div
                    key={`${relationship.direction}-${relationship.label}-${relationship.target}-meaning`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700"
                  >
                    <span className="font-semibold text-slate-900">{relationship.label}</span>: {relationship.meaning}
                  </div>
                ))
              ) : (
                <span className="text-sm text-slate-500">Click a node to see relationship meanings in context.</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Metadata</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {details.metadata && Object.keys(details.metadata).length ? (
                Object.entries(details.metadata).map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {key}: {String(value)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No extra metadata attached to this node.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default memo(NodeDetailsPanel)
