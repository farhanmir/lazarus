import React, { memo } from 'react'
import { motion } from 'framer-motion'

function normalizeConfidence(value) {
  if (typeof value !== 'number') return 0
  return value <= 1 ? value * 100 : value
}

function ConfidenceGauge({ value }) {
  const normalized = normalizeConfidence(value)
  const clamped = Math.max(0, Math.min(100, normalized))
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (clamped / 100) * circumference

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-panel">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Confidence Meter</p>
      <div className="mt-4 flex items-center justify-center">
        <svg viewBox="0 0 120 120" className="h-36 w-36">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#2563eb"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="54" textAnchor="middle" className="fill-slate-900 text-[22px] font-bold">
            {clamped.toFixed(1)}
          </text>
          <text x="60" y="74" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold uppercase tracking-[0.18em]">
            percent
          </text>
        </svg>
      </div>
    </div>
  )
}

export default memo(ConfidenceGauge)
