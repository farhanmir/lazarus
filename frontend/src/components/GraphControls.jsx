import React, { memo } from 'react'
import { Focus, LayoutGrid, Radar, RefreshCw, ScanSearch, ZoomIn, ZoomOut } from 'lucide-react'

function ControlButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function GraphControls({ layoutMode, setLayoutMode, focusMode, setFocusMode, onFit, onResetLayout, onZoomIn, onZoomOut }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {[
          { id: 'cola', label: 'Overview', icon: Radar },
          { id: 'breadthfirst', label: 'Path Focus', icon: Focus },
          { id: 'concentric', label: 'Concentric', icon: LayoutGrid },
        ].map(({ id, label, icon: Icon }) => {
          const active = layoutMode === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setLayoutMode(id)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          )
        })}
      </div>

      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {[
          { id: 'full', label: 'Full Graph' },
          { id: 'path', label: 'Focus Mode' },
        ].map(({ id, label }) => {
          const active = focusMode === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFocusMode(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                active ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <ControlButton icon={ScanSearch} label="Fit Graph" onClick={onFit} />
      <ControlButton icon={ZoomIn} label="Zoom In" onClick={onZoomIn} />
      <ControlButton icon={ZoomOut} label="Zoom Out" onClick={onZoomOut} />
      <ControlButton icon={RefreshCw} label="Reset Layout" onClick={onResetLayout} />
    </div>
  )
}

export default memo(GraphControls)
