import { useMemo } from 'react'

const STAGE_CONFIG = {
  advocate: {
    nodeTypes: ['Drug', 'Target', 'Disease'],
    edgeLabels: ['TARGETS', 'LINKED_TO', 'ORIGINALLY_INDICATED_FOR', 'TO_DISEASE', 'BASED_ON_TARGET'],
  },
  skeptic: {
    nodeTypes: ['Drug', 'Target', 'Disease', 'Evidence'],
    edgeLabels: ['FAILED_FOR', 'LINKED_TO', 'SUPPORTED_BY'],
  },
  curator: {
    nodeTypes: ['Drug', 'Target', 'Disease', 'Evidence'],
    edgeLabels: ['SUPPORTED_BY', 'LINKED_TO', 'TARGETS'],
  },
  judge: {
    nodeTypes: ['Drug', 'Target', 'Disease', 'Evidence', 'Hypothesis'],
    edgeLabels: ['SUPPORTED_BY', 'PROPOSES_REPURPOSING_OF', 'TO_DISEASE', 'BASED_ON_TARGET'],
  },
  trial: {
    nodeTypes: ['Drug', 'Target', 'Disease', 'Evidence', 'Hypothesis', 'Strategy'],
    edgeLabels: ['SUPPORTED_BY', 'PROPOSES_REPURPOSING_OF', 'TO_DISEASE', 'BASED_ON_TARGET', 'RECOMMENDS'],
  },
}

function canonicalStageFromStepName(name) {
  if (!name) return null
  if (name.includes('advocate')) return 'advocate'
  if (name.includes('skeptic')) return 'skeptic'
  if (name.includes('evidence') || name === 'parallel_evidence') return 'curator'
  if (name.includes('assessment') || name.includes('judge') || name === 'hitl_router') return 'judge'
  if (name.includes('trial_strategist')) return 'trial'
  return null
}

export function determineActiveGraphStage(steps = [], runStatus = 'idle') {
  if (runStatus === 'completed') return 'trial'
  const running = steps.find((step) => step.status === 'running')
  if (running) return canonicalStageFromStepName(running.agent_name) ?? 'advocate'

  const completedStages = new Set(
    steps
      .filter((step) => step.status === 'completed')
      .map((step) => canonicalStageFromStepName(step.agent_name))
      .filter(Boolean),
  )

  if (!completedStages.has('advocate')) return 'advocate'
  if (!completedStages.has('skeptic')) return 'skeptic'
  if (!completedStages.has('curator')) return 'curator'
  if (!completedStages.has('judge')) return 'judge'
  return 'trial'
}

export function useGraphHighlighting(graphData, steps, runStatus, selectedNodeId, focusMode) {
  return useMemo(() => {
    const stage = determineActiveGraphStage(steps, runStatus)
    const config = STAGE_CONFIG[stage] ?? STAGE_CONFIG.trial
    const nodes = graphData?.nodes ?? []
    const links = graphData?.links ?? []

    const stageNodeIds = new Set(
      nodes
        .filter((node) => config.nodeTypes.includes(node.type) || node.highlight)
        .map((node) => String(node.id)),
    )

    const stageEdgeIds = new Set()
    const relatedNodeIds = new Set()
    const relatedEdgeIds = new Set()
    const highlightedNodeIds = new Set(
      nodes.filter((node) => node.highlight).map((node) => String(node.id)),
    )

    links.forEach((edge, index) => {
      const relationship = edge.relationship || edge.label || 'RELATED_TO'
      const edgeId = edge.id || `${edge.source}-${edge.target}-${relationship}-${index}`
      const inStage =
        config.edgeLabels.includes(relationship) &&
        stageNodeIds.has(String(edge.source)) &&
        stageNodeIds.has(String(edge.target))

      if (inStage || edge.highlight) {
        stageEdgeIds.add(edgeId)
        relatedNodeIds.add(String(edge.source))
        relatedNodeIds.add(String(edge.target))
        highlightedNodeIds.add(String(edge.source))
        highlightedNodeIds.add(String(edge.target))
      }

      if (selectedNodeId && (String(edge.source) === String(selectedNodeId) || String(edge.target) === String(selectedNodeId))) {
        relatedEdgeIds.add(edgeId)
        relatedNodeIds.add(String(edge.source))
        relatedNodeIds.add(String(edge.target))
      }
    })

    const dimNodeIds = new Set()
    const dimEdgeIds = new Set()

    if (focusMode === 'path') {
      nodes.forEach((node) => {
        const nodeId = String(node.id)
        const keep =
          nodeId === String(selectedNodeId) ||
          relatedNodeIds.has(nodeId) ||
          highlightedNodeIds.has(nodeId)
        if (!keep) dimNodeIds.add(nodeId)
      })

      links.forEach((edge, index) => {
        const relationship = edge.relationship || edge.label || 'RELATED_TO'
        const edgeId = edge.id || `${edge.source}-${edge.target}-${relationship}-${index}`
        const keep = relatedEdgeIds.has(edgeId) || stageEdgeIds.has(edgeId) || edge.highlight
        if (!keep) dimEdgeIds.add(edgeId)
      })
    }

    return {
      stage,
      stageNodeIds,
      stageEdgeIds,
      relatedNodeIds,
      relatedEdgeIds,
      dimNodeIds,
      dimEdgeIds,
    }
  }, [focusMode, graphData, runStatus, selectedNodeId, steps])
}
