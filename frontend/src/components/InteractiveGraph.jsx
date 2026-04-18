import React, { memo, useMemo } from 'react'
import GraphView from './GraphView'
import GraphLegend from './GraphLegend'
import MiniMapNavigator from './MiniMapNavigator'

const stageNodeFilters = {
  advocate: new Set(['Drug', 'Target', 'Disease']),
  skeptic: new Set(['Drug', 'Target', 'Disease']),
  curator: new Set(['Drug', 'Target', 'Disease', 'Evidence']),
  judge: new Set(['Drug', 'Target', 'Disease', 'Evidence', 'Hypothesis']),
  trial: new Set(['Drug', 'Target', 'Disease', 'Evidence', 'Hypothesis', 'Strategy']),
}

function determineActiveStage(steps, runStatus) {
  if (runStatus === 'completed') return 'trial'
  const names = new Set(steps.filter((step) => step.status === 'completed').map((step) => step.agent_name))
  if (!names.has('advocate')) return 'advocate'
  if (!names.has('skeptic')) return 'skeptic'
  if (!names.has('evidence_curator')) return 'curator'
  if (!names.has('judge')) return 'judge'
  return 'trial'
}

function stageGraph(graphData, activeStage) {
  const allowedTypes = stageNodeFilters[activeStage] ?? stageNodeFilters.trial
  const nodes = (graphData?.nodes ?? []).map((node) => {
    const shouldShow = allowedTypes.has(node.type) || node.highlight
    const highlightedByStage =
      (activeStage === 'advocate' && ['Drug', 'Target', 'Disease'].includes(node.type)) ||
      (activeStage === 'skeptic' && node.type !== 'Evidence') ||
      (activeStage === 'curator' && ['Evidence', 'Disease', 'Target', 'Drug'].includes(node.type)) ||
      (activeStage === 'judge' && ['Hypothesis', 'Disease', 'Drug', 'Target', 'Evidence'].includes(node.type)) ||
      activeStage === 'trial'
    return {
      ...node,
      highlight: highlightedByStage && shouldShow ? true : node.highlight,
      description:
        activeStage === 'skeptic' && node.type === 'Disease'
          ? `${node.description ?? node.label} · Risk pathways are under review.`
          : activeStage === 'curator' && node.type === 'Evidence'
            ? `${node.description ?? node.label} · Evidence links just entered the graph.`
            : activeStage === 'trial' && node.type === 'Hypothesis'
              ? `${node.description ?? node.label} · Strategy output is now attached to this path.`
              : node.description,
    }
  })

  const visibleNodeIds = new Set(nodes.filter((node) => allowedTypes.has(node.type) || node.highlight).map((node) => node.id))
  const links = (graphData?.links ?? []).map((link) => ({
    ...link,
    highlight:
      visibleNodeIds.has(link.source) &&
      visibleNodeIds.has(link.target) &&
      (link.highlight || activeStage !== 'advocate' || ['TARGETS', 'LINKED_TO', 'ORIGINALLY_INDICATED_FOR'].includes(link.relationship)),
  }))

  return { nodes, links }
}

function InteractiveGraph({ graphData, selectedNode, setSelectedNode, steps, runStatus, legendItems }) {
  const activeStage = determineActiveStage(steps, runStatus)
  const stagedGraph = useMemo(() => stageGraph(graphData, activeStage), [graphData, activeStage])

  return (
    <div className="grid gap-4">
      <GraphView graphData={stagedGraph} selectedNode={selectedNode} setSelectedNode={setSelectedNode} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MiniMapNavigator graphData={stagedGraph} selectedNodeId={selectedNode?.id} />
        <GraphLegend items={[...legendItems, { type: 'Strategy', description: 'Recommended execution path' }]} />
      </div>
    </div>
  )
}

export default memo(InteractiveGraph)
