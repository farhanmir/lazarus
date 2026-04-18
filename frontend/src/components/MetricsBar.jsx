import React, { memo } from 'react'
import { AlertTriangle, ArrowRightLeft, BarChart3, ShieldCheck } from 'lucide-react'

const metricIcons = {
  hypothesis: ArrowRightLeft,
  confidence: BarChart3,
  risk: AlertTriangle,
  priority: ShieldCheck,
}

const metricThemes = {
  hypothesis: 'from-blue-500/15 to-blue-200/20 text-blue-700',
  confidence: 'from-slate-900/10 to-slate-400/10 text-slate-700',
  risk: 'from-amber-500/15 to-orange-200/20 text-orange-700',
  priority: 'from-emerald-500/15 to-green-200/20 text-emerald-700',
}

function MetricsBar({ metrics }) {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metricIcons[metric.key] ?? BarChart3
        return (
          <article
            key={metric.key}
            className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-panel backdrop-blur"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{metric.value}</p>
                <p className="mt-2 text-sm text-slate-500">{metric.caption}</p>
              </div>
              <div className={`rounded-2xl bg-gradient-to-br p-3 ${metricThemes[metric.key] ?? metricThemes.confidence}`}>
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export default memo(MetricsBar)
