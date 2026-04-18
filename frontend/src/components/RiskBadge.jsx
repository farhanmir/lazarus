import React, { memo } from 'react'

function toneColor(label) {
  const l = label.toLowerCase()
  if (l === 'low')    return { color: '#2e5a47', bg: 'rgba(46,90,71,0.08)',  border: 'rgba(46,90,71,0.25)' }
  if (l === 'medium') return { color: '#8a6e1e', bg: 'rgba(201,162,75,0.1)', border: 'rgba(201,162,75,0.3)' }
  if (l === 'high')   return { color: '#9b3d3d', bg: 'rgba(155,61,61,0.08)', border: 'rgba(155,61,61,0.25)' }
  return { color: '#6d7278', bg: 'rgba(20,23,26,0.04)', border: 'rgba(20,23,26,0.12)' }
}

function RiskBadge({ label = 'Unknown', prefix = 'Risk' }) {
  const { color, bg, border } = toneColor(label)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      fontSize: '7.5px',
      fontWeight: 700,
      letterSpacing: '0.16em',
      fontFamily: 'var(--font-mono)',
      color,
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: '2px',
    }}>
      {prefix}: {label}
    </span>
  )
}

export default memo(RiskBadge)
