import React, { memo } from 'react'

const toneMap = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
}

function RiskBadge({ label = 'Unknown', prefix = 'Risk' }) {
  const tone = toneMap[label.toLowerCase()] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ring-1 ${tone}`}>
      {prefix}: {label}
    </span>
  )
}

export default memo(RiskBadge)
