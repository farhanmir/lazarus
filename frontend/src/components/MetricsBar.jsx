import React, { memo } from 'react'

function MetricsBar({ metrics }) {
  const cells = [
    {
      key: 'hypothesis',
      lbl: 'HYPOTHESIS',
      val: metrics.find(m => m.key === 'hypothesis')?.value ?? '—',
      cap: metrics.find(m => m.key === 'hypothesis')?.caption ?? '',
      highlight: false,
    },
    {
      key: 'confidence',
      lbl: 'CONFIDENCE',
      val: metrics.find(m => m.key === 'confidence')?.value ?? '—',
      cap: metrics.find(m => m.key === 'confidence')?.caption ?? '',
      highlight: true,
    },
    {
      key: 'risk',
      lbl: 'RISK LEVEL',
      val: metrics.find(m => m.key === 'risk')?.value ?? '—',
      cap: metrics.find(m => m.key === 'risk')?.caption ?? '',
      highlight: false,
    },
    {
      key: 'priority',
      lbl: 'PRIORITY',
      val: metrics.find(m => m.key === 'priority')?.value ?? '—',
      cap: metrics.find(m => m.key === 'priority')?.caption ?? '',
      highlight: false,
    },
  ]

  return (
    <div className="metrics-grid">
      {cells.map(cell => (
        <div key={cell.key} className={`metric-cell${cell.highlight ? ' highlighted' : ''}`}>
          <div className="metric-lbl">{cell.lbl}</div>
          <div className={`metric-val${cell.val.length > 12 ? ' sm' : ''}`}>{cell.val}</div>
          {cell.cap && <div className="metric-cap">{cell.cap}</div>}
        </div>
      ))}
    </div>
  )
}

export default memo(MetricsBar)
