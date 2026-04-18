import React, { memo } from 'react'
import { motion } from 'framer-motion'

function normalize(val) {
  if (typeof val !== 'number') return 0
  return Math.max(0, Math.min(100, val <= 1 ? val * 100 : val))
}

function ConfidenceGauge({ value }) {
  const pct = normalize(value)
  const R = 42
  const circ = 2 * Math.PI * R
  const offset = circ - (pct / 100) * circ

  const color =
    pct >= 70 ? '#2e5a47' :
    pct >= 40 ? '#c9a24b' :
    '#9b3d3d'

  return (
    <div className="term-panel">
      <div className="term-panel-header">
        <span className="term-panel-title">CONFIDENCE</span>
      </div>
      <div className="gauge-wrap">
        <svg viewBox="0 0 110 110" width="110" height="110">
          <circle
            cx="55" cy="55" r={R}
            fill="none"
            stroke="rgba(20,23,26,0.08)"
            strokeWidth="10"
          />
          <motion.circle
            cx="55" cy="55" r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="butt"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            transform="rotate(-90 55 55)"
            style={{ filter: 'none' }}
          />
          <text
            x="55" y="50"
            textAnchor="middle"
            fill={color}
            fontSize="18"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="700"
          >
            {pct.toFixed(0)}
          </text>
          <text
            x="55" y="64"
            textAnchor="middle"
            fill="#6d7278"
            fontSize="7"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="700"
            letterSpacing="0.22em"
          >
            PERCENT
          </text>
        </svg>
      </div>
    </div>
  )
}

export default memo(ConfidenceGauge)
