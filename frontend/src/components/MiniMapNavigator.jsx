import React, { memo } from 'react'

function MiniMapNavigator({ graphData, selectedNodeId }) {
  const nodes = graphData?.nodes ?? []
  if (!nodes.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm leading-6 text-slate-500 shadow-sm">
        Mini-map will appear when the graph loads.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Mini Map</p>
        <span className="text-[11px] text-slate-400">{nodes.length} nodes</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {nodes.slice(0, 12).map((node) => (
          <div
            key={node.id}
            className={`rounded-lg px-3 py-2 text-[11px] leading-4 font-semibold whitespace-nowrap ${
              node.id === selectedNodeId
                ? 'bg-blue-600 text-white'
                : node.highlight
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {node.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(MiniMapNavigator)
