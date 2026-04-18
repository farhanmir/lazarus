import React, { memo, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const nodeStyles = {
  Drug: { color: '#2563eb', radius: 28, icon: 'Rx' },
  Target: { color: '#f59e0b', radius: 24, icon: '◎' },
  Disease: { color: '#16a34a', radius: 22, icon: 'Dx' },
  Evidence: { color: '#7c3aed', radius: 18, icon: '≣' },
  Hypothesis: { color: '#dc2626', radius: 26, icon: '✦' },
}

function GraphView({ graphData, selectedNode, setSelectedNode }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 920, height: 520 })
  const [hoveredNodeId, setHoveredNodeId] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver(([entry]) => {
      setDimensions({
        width: Math.max(entry.contentRect.width, 640),
        height: 520,
      })
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!graphData || !svgRef.current) return

    const { width, height } = dimensions
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg.attr('viewBox', [0, 0, width, height])

    const selectedId = selectedNode?.id ?? null
    const highlightedNodeIds = new Set(graphData.nodes.filter((node) => node.highlight).map((node) => node.id))
    const relatedNodeIds = new Set()
    const relatedLinkKeys = new Set()
    graphData.links.forEach((link, index) => {
      if (selectedId && (link.source === selectedId || link.target === selectedId)) {
        relatedNodeIds.add(link.source)
        relatedNodeIds.add(link.target)
        relatedLinkKeys.add(`${link.source}-${link.target}-${index}`)
      }
      if (!selectedId && link.highlight) {
        relatedNodeIds.add(link.source)
        relatedNodeIds.add(link.target)
      }
    })

    const defs = svg.append('defs')
    const arrow = defs
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 16)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#94a3b8')
      .attr('d', 'M0,-5L10,0L0,5')

    const canvas = svg.append('g')

    const zoom = d3.zoom().scaleExtent([0.45, 2.8]).on('zoom', (event) => {
      canvas.attr('transform', event.transform)
    })

    svg.call(zoom)

    const nodes = graphData.nodes.map((node) => ({ ...node }))
    const links = graphData.links.map((link) => ({ ...link }))

    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance((d) => (d.highlight ? 130 : 180)))
      .force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide().radius((d) => (nodeStyles[d.type]?.radius ?? 18) + 14),
      )

    const link = canvas
      .append('g')
      .attr('stroke-linecap', 'round')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => (d.highlight ? '#22c55e' : '#94a3b8'))
      .attr('stroke-width', (d) => (d.highlight ? 4.5 : 1.6))
      .attr('stroke-opacity', (d) => {
        if (selectedId) {
          return d.source === selectedId || d.target === selectedId ? 0.95 : 0.12
        }
        return d.highlight ? 0.95 : highlightedNodeIds.size ? 0.12 : 0.4
      })
      .attr('marker-end', 'url(#arrow)')
      .attr('stroke-dasharray', (d) => (d.highlight ? '0' : '5 8'))

    link.each(function () {
      const line = d3.select(this)
      const length = this.getTotalLength?.() ?? 160
      line
        .attr('stroke-dasharray', `${length} ${length}`)
        .attr('stroke-dashoffset', length)
        .transition()
        .duration(700)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
    })

    const labels = canvas
      .append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', 11)
      .attr('fill', '#475569')
      .attr('text-anchor', 'middle')
      .attr('opacity', (d) => (d.highlight || selectedId ? 0.9 : 0.42))
      .text((d) => d.relationship)

    const nodeGroup = canvas
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .style('opacity', (d) => {
        if (selectedId) {
          return d.id === selectedId || relatedNodeIds.has(d.id) ? 1 : 0.18
        }
        return highlightedNodeIds.size ? (highlightedNodeIds.has(d.id) ? 1 : 0.18) : 1
      })
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.25).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )
      .on('mouseenter', (_, d) => setHoveredNodeId(d.id))
      .on('mouseleave', () => setHoveredNodeId(null))
      .on('click', (_, d) => setSelectedNode(d))

    nodeGroup
      .append('circle')
      .attr('r', (d) => (nodeStyles[d.type]?.radius ?? 18) + 10)
      .attr('fill', (d) => d3.color(nodeStyles[d.type]?.color ?? '#334155')?.copy({ opacity: d.highlight ? 0.22 : 0.12 })?.toString() ?? '#cbd5e1')
      .attr('stroke', 'none')
      .attr('class', (d) => (d.id === selectedId ? 'graph-node-pulse' : ''))

    nodeGroup
      .append('circle')
      .attr('r', (d) => nodeStyles[d.type]?.radius ?? 18)
      .attr('fill', (d) => nodeStyles[d.type]?.color ?? '#334155')
      .attr('stroke', (d) => (d.highlight ? '#0f172a' : '#ffffff'))
      .attr('stroke-width', (d) => (d.highlight ? 3 : 2.2))
      .attr('filter', (d) => (d.id === selectedId ? 'url(#glow)' : null))

    defs
      .append('filter')
      .attr('id', 'glow')
      .append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 0)
      .attr('stdDeviation', 6)
      .attr('flood-color', '#22c55e')
      .attr('flood-opacity', 0.65)

    nodeGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 13)
      .attr('font-weight', 700)
      .attr('fill', '#ffffff')
      .text((d) => nodeStyles[d.type]?.icon ?? '•')

    nodeGroup
      .append('text')
      .attr('dy', (d) => (nodeStyles[d.type]?.radius ?? 18) + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', '#dbe7f5')
      .text((d) => d.label)

    nodeGroup
      .attr('opacity', 0)
      .transition()
      .duration(650)
      .ease(d3.easeCubicOut)
      .attr('opacity', (d) => {
        if (selectedId) {
          return d.id === selectedId || relatedNodeIds.has(d.id) ? 1 : 0.18
        }
        return highlightedNodeIds.size ? (highlightedNodeIds.has(d.id) ? 1 : 0.18) : 1
      })

    nodeGroup
      .transition()
      .duration(500)
      .attr('transform', (d) => `translate(${d.x ?? width / 2},${d.y ?? height / 2}) scale(0.92)`)

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)

      nodeGroup.attr('transform', (d) => {
        const scale = d.id === selectedId ? 1.12 : d.id === hoveredNodeId ? 1.08 : 1
        return `translate(${d.x},${d.y}) scale(${scale})`
      })

      labels
        .attr('x', (d) => (d.source.x + d.target.x) / 2)
        .attr('y', (d) => (d.source.y + d.target.y) / 2 - 6)
    })

    svg
      .transition()
      .duration(700)
      .call(zoom.transform, d3.zoomIdentity.translate(width * 0.04, height * 0.02).scale(0.96))

    return () => simulation.stop()
  }, [graphData, dimensions, hoveredNodeId, selectedNode, setSelectedNode])

  return (
    <section className="rounded-3xl bg-white/90 p-6 shadow-panel ring-1 ring-slate-200 backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Graph Reasoning</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Interactive Graph View</h2>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {graphData ? `${graphData.nodes.length} Nodes · ${graphData.links.length} Links` : 'No graph loaded'}
        </div>
      </div>

      <div ref={containerRef} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
        <svg ref={svgRef} className="h-[520px] w-full" />
        <div className="pointer-events-none absolute left-5 top-5 max-w-[34rem] rounded-2xl bg-white/88 px-5 py-4 text-sm leading-6 text-slate-600 shadow-lg backdrop-blur">
          Click nodes for a full detail panel. The active reasoning path stays highlighted while unrelated entities fade back.
        </div>
      </div>
    </section>
  )
}

export default memo(GraphView)
