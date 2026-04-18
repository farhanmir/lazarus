import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, Clock, Users, Zap } from 'lucide-react'
import { fetchEffortImpact } from '../services/api'

const ZONE_COLORS = {
  ideal: '#10b981',     // green — low effort, high impact
  promising: '#3b82f6', // blue — medium zone
  cautious: '#f59e0b',  // amber — high effort, medium impact
  avoid: '#ef4444',     // red — high effort, low impact
}

function EffortImpactChart({ runId }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!runId) return
    setLoading(true)
    setError(null)
    fetchEffortImpact(runId)
      .then(setData)
      .catch(() => setError('No effort/impact data available for this run.'))
      .finally(() => setLoading(false))
  }, [runId])

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = 340
    const margin = { top: 20, right: 30, bottom: 50, left: 55 }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const x = d3.scaleLinear().domain([0, 1]).range([0, innerW])
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0])

    // Color zones (background quadrants)
    const zones = [
      { x1: 0, y1: 0.5, x2: 0.5, y2: 1, color: ZONE_COLORS.ideal, label: 'Ideal' },
      { x1: 0.5, y1: 0.5, x2: 1, y2: 1, color: ZONE_COLORS.promising, label: 'Promising' },
      { x1: 0, y1: 0, x2: 0.5, y2: 0.5, color: ZONE_COLORS.cautious, label: 'Cautious' },
      { x1: 0.5, y1: 0, x2: 1, y2: 0.5, color: ZONE_COLORS.avoid, label: 'Avoid' },
    ]

    zones.forEach((z) => {
      g.append('rect')
        .attr('x', x(z.x1))
        .attr('y', y(z.y2))
        .attr('width', x(z.x2) - x(z.x1))
        .attr('height', y(z.y1) - y(z.y2))
        .attr('fill', z.color)
        .attr('opacity', 0.08)

      g.append('text')
        .attr('x', x((z.x1 + z.x2) / 2))
        .attr('y', y((z.y1 + z.y2) / 2))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', z.color)
        .attr('opacity', 0.4)
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .text(z.label)
    })

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.1f')))
      .selectAll('text')
      .attr('fill', '#94a3b8')

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.1f')))
      .selectAll('text')
      .attr('fill', '#94a3b8')

    // Axis labels
    svg
      .append('text')
      .attr('x', margin.left + innerW / 2)
      .attr('y', height - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '12px')
      .text('Effort Score →')

    svg
      .append('text')
      .attr('transform', `rotate(-90)`)
      .attr('x', -(margin.top + innerH / 2))
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '12px')
      .text('← Impact Score')

    // Data point
    const effortScore = data.effort.effort_score
    const impactScore = data.impact.impact_score

    // Determine zone color
    let pointColor = ZONE_COLORS.cautious
    if (effortScore < 0.5 && impactScore >= 0.5) pointColor = ZONE_COLORS.ideal
    else if (effortScore >= 0.5 && impactScore >= 0.5) pointColor = ZONE_COLORS.promising
    else if (effortScore >= 0.5 && impactScore < 0.5) pointColor = ZONE_COLORS.avoid

    // Pulse ring
    g.append('circle')
      .attr('cx', x(effortScore))
      .attr('cy', y(impactScore))
      .attr('r', 18)
      .attr('fill', pointColor)
      .attr('opacity', 0.15)

    // Data circle
    g.append('circle')
      .attr('cx', x(effortScore))
      .attr('cy', y(impactScore))
      .attr('r', 8)
      .attr('fill', pointColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 0 6px rgba(0,0,0,0.3))')

    // Style axis lines
    svg.selectAll('.domain').attr('stroke', '#334155')
    svg.selectAll('.tick line').attr('stroke', '#334155')
  }, [data])

  if (!runId) {
    return (
      <div className="nexus-glass-card p-6 text-center text-slate-400">
        <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p>Run an analysis to see the Effort vs Impact chart</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="nexus-glass-card p-6 text-center text-slate-400">
        <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p>Loading effort & impact data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="nexus-glass-card p-6 text-center text-slate-400">
        <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p>{error}</p>
      </div>
    )
  }

  if (!data) return null

  const readiness = data.investment_readiness_score
  const readinessColor =
    readiness >= 0.6 ? 'text-emerald-400' : readiness >= 0.3 ? 'text-amber-400' : 'text-red-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="nexus-glass-card flex items-center gap-3 p-4">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          <div>
            <div className="text-xs text-slate-400">Est. Cost</div>
            <div className="text-sm font-semibold text-white">
              ${(data.effort.estimated_cost_usd / 1_000_000).toFixed(1)}M
            </div>
          </div>
        </div>
        <div className="nexus-glass-card flex items-center gap-3 p-4">
          <Clock className="h-5 w-5 text-blue-400" />
          <div>
            <div className="text-xs text-slate-400">Timeline</div>
            <div className="text-sm font-semibold text-white">{data.effort.estimated_time_months} months</div>
          </div>
        </div>
        <div className="nexus-glass-card flex items-center gap-3 p-4">
          <Users className="h-5 w-5 text-purple-400" />
          <div>
            <div className="text-xs text-slate-400">Patient Pop.</div>
            <div className="text-sm font-semibold text-white">
              {(data.impact.patient_population_size / 1_000_000).toFixed(1)}M
            </div>
          </div>
        </div>
        <div className="nexus-glass-card flex items-center gap-3 p-4">
          <Zap className="h-5 w-5 text-amber-400" />
          <div>
            <div className="text-xs text-slate-400">Readiness</div>
            <div className={`text-sm font-semibold ${readinessColor}`}>
              {(readiness * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="nexus-glass-card p-4" ref={containerRef}>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Effort vs Impact</h3>
        <svg ref={svgRef} className="w-full" />
      </div>

      {/* Detail cards */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="nexus-glass-card p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Effort Details</h4>
          <div className="space-y-1 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Trial Complexity</span>
              <span className="font-medium text-white">{data.effort.trial_complexity}</span>
            </div>
            <div className="flex justify-between">
              <span>Effort Score</span>
              <span className="font-medium text-white">{data.effort.effort_score}</span>
            </div>
          </div>
        </div>
        <div className="nexus-glass-card p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Impact Details</h4>
          <div className="space-y-1 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Breakthrough</span>
              <span className="font-medium text-white">{data.impact.expected_breakthrough_score}</span>
            </div>
            <div className="flex justify-between">
              <span>Commercial Value</span>
              <span className="font-medium text-white">{data.impact.commercial_value_estimate}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default EffortImpactChart
