import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import CytoscapeComponent from 'react-cytoscapejs'
import { Activity, Maximize2, Minimize2, Network } from 'lucide-react'
import GraphControls from './GraphControls'
import { normalizeGraphData, buildNodeIndex } from '../utils/graphTransform'
import { baseGraphStylesheet, edgeColorForRelationship } from '../utils/graphStyles'
import { useGraphHighlighting } from '../hooks/useGraphHighlighting'

cytoscape.use(cola)

const layouts = {
  cola: {
    name: 'cola',
    animate: true,
    fit: true,
    padding: 40,
    nodeSpacing: 26,
    edgeLengthVal: 150,
    maxSimulationTime: 1200,
  },
  breadthfirst: {
    name: 'breadthfirst',
    animate: true,
    directed: true,
    spacingFactor: 1.35,
    padding: 40,
    fit: true,
  },
  concentric: {
    name: 'concentric',
    animate: true,
    fit: true,
    padding: 40,
    minNodeSpacing: 44,
    concentric: (node) => {
      const order = {
        Strategy: 6,
        Hypothesis: 5,
        Evidence: 4,
        Disease: 3,
        Target: 2,
        Drug: 1,
      }
      return order[node.data('nodeType')] ?? 0
    },
    levelWidth: () => 1,
  },
}

function stageLabel(stage) {
  return {
    advocate: 'Advocate path focus',
    skeptic: 'Skeptic risk audit',
    curator: 'Evidence curation',
    judge: 'Judge convergence',
    trial: 'Trial strategy recommendation',
  }[stage] ?? 'Graph overview'
}

function applyHighlightState(cy, highlight, selectedNodeId, hoveredNodeId, hoveredEdgeId) {
  cy.batch(() => {
    cy.nodes().forEach((node) => {
      const nodeId = node.id()
      node.removeClass('is-stage-active is-related is-selected is-hovered is-dim')
      if (highlight.stageNodeIds.has(nodeId)) node.addClass('is-stage-active')
      if (highlight.relatedNodeIds.has(nodeId)) node.addClass('is-related')
      if (highlight.dimNodeIds.has(nodeId)) node.addClass('is-dim')
      if (selectedNodeId && nodeId === String(selectedNodeId)) node.addClass('is-selected')
      if (hoveredNodeId && nodeId === hoveredNodeId) node.addClass('is-hovered')
    })

    cy.edges().forEach((edge) => {
      const edgeId = edge.id()
      const relationship = edge.data('relationship')
      edge.removeClass('is-stage-edge is-related is-hovered is-dim')
      edge.style({
        'line-color': edgeColorForRelationship(relationship),
        'target-arrow-color': edgeColorForRelationship(relationship),
      })
      if (highlight.stageEdgeIds.has(edgeId)) edge.addClass('is-stage-edge')
      if (highlight.relatedEdgeIds.has(edgeId)) edge.addClass('is-related')
      if (highlight.dimEdgeIds.has(edgeId)) edge.addClass('is-dim')
      if (hoveredEdgeId && edgeId === hoveredEdgeId) edge.addClass('is-hovered')
    })
  })
}

function GraphPanel({ graphData, selectedNode, setSelectedNode, steps, runStatus }) {
  const cyRef = useRef(null)
  const panelRef = useRef(null)
  const [layoutMode, setLayoutMode] = useState('cola')
  const [focusMode, setFocusMode] = useState('full')
  const [hoveredNodeId, setHoveredNodeId] = useState(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const elements = useMemo(() => normalizeGraphData(graphData), [graphData])
  const nodeIndex = useMemo(() => buildNodeIndex(graphData), [graphData])
  const highlight = useGraphHighlighting(graphData, steps, runStatus, selectedNode?.id, focusMode)

  const runLayout = useCallback((mode = layoutMode) => {
    const cy = cyRef.current
    if (!cy) return
    cy.layout(layouts[mode] ?? layouts.cola).run()
  }, [layoutMode])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    applyHighlightState(cy, highlight, selectedNode?.id, hoveredNodeId, hoveredEdgeId)
  }, [highlight, hoveredEdgeId, hoveredNodeId, selectedNode])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    runLayout(layoutMode)
  }, [layoutMode, elements, runLayout])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen = document.fullscreenElement === panelRef.current
      setIsFullscreen(fullscreen)
      window.setTimeout(() => {
        const cy = cyRef.current
        if (!cy) return
        cy.resize()
        cy.fit(cy.elements(':visible'), 36)
      }, 120)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleFit = () => {
    const cy = cyRef.current
    if (!cy) return
    cy.animate({ fit: { eles: cy.elements(':visible'), padding: 32 }, duration: 280 })
  }

  const handleZoomIn = () => {
    const cy = cyRef.current
    if (!cy) return
    const nextZoom = Math.min(cy.zoom() * 1.18, cy.maxZoom())
    cy.animate({ zoom: nextZoom, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }, duration: 180 })
  }

  const handleZoomOut = () => {
    const cy = cyRef.current
    if (!cy) return
    const nextZoom = Math.max(cy.zoom() / 1.18, cy.minZoom())
    cy.animate({ zoom: nextZoom, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }, duration: 180 })
  }

  const handleReset = () => {
    setFocusMode('full')
    setHoveredEdgeId(null)
    setHoveredNodeId(null)
    runLayout(layoutMode)
    handleFit()
  }

  const toggleFullscreen = async () => {
    const panel = panelRef.current
    if (!panel) return

    if (document.fullscreenElement === panel) {
      await document.exitFullscreen()
      return
    }

    await panel.requestFullscreen()
  }

  const cyStylesheet = useMemo(() => baseGraphStylesheet, [])

  return (
    <section
      ref={panelRef}
      className={`rounded-3xl bg-white/95 p-6 shadow-panel ring-1 ring-slate-200 backdrop-blur ${
        isFullscreen ? 'h-screen w-screen overflow-auto rounded-none p-8' : ''
      }`}
    >
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            <Network className="h-4 w-4" />
            Graph Reasoning
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Clinical R&amp;D Relationship Map</h2>
          <p className="mt-2 text-sm text-slate-600">
            {stageLabel(highlight.stage)}. Click any node to inspect metadata, confidence, and linked evidence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
            <Activity className="h-3.5 w-3.5" />
            {stageLabel(highlight.stage)}
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            {(graphData?.nodes ?? []).length} nodes · {(graphData?.links ?? []).length} links
          </div>
        </div>
      </div>

      <GraphControls
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        onFit={handleFit}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetLayout={handleReset}
      />

      <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.55),_rgba(255,255,255,0.98)_48%)]">
        <div className="border-b border-slate-200/80 bg-white/70 px-5 py-3 text-sm text-slate-600">
          Advocate highlights drug-target-disease reasoning first, then evidence, hypothesis, and strategy layers animate in as the workflow advances. Use mouse wheel or the zoom buttons to inspect labels cleanly.
        </div>

        <CytoscapeComponent
          elements={elements}
          cy={(cy) => {
            cyRef.current = cy
            cy.minZoom(0.25)
            cy.maxZoom(3.5)
            cy.userZoomingEnabled(true)
            cy.userPanningEnabled(true)
            cy.boxSelectionEnabled(false)
            if (!cy.data('__lazarusBound')) {
              cy.data('__lazarusBound', true)
              cy.on('tap', 'node', (event) => {
                const nodeId = event.target.id()
                setSelectedNode(nodeIndex.get(nodeId) ?? null)
              })
              cy.on('tap', (event) => {
                if (event.target === cy) setSelectedNode(null)
              })
              cy.on('mouseover', 'node', (event) => setHoveredNodeId(event.target.id()))
              cy.on('mouseout', 'node', () => setHoveredNodeId(null))
              cy.on('mouseover', 'edge', (event) => setHoveredEdgeId(event.target.id()))
              cy.on('mouseout', 'edge', () => setHoveredEdgeId(null))
            }
            runLayout('cola')
          }}
          style={{ width: '100%', height: isFullscreen ? 'calc(100vh - 250px)' : '700px' }}
          layout={layouts[layoutMode]}
          stylesheet={cyStylesheet}
          wheelSensitivity={0.14}
        />
      </div>
    </section>
  )
}

export default memo(GraphPanel)
