const NODE_TYPE_NORMALIZATION = {
  drug: 'Drug',
  target: 'Target',
  disease: 'Disease',
  evidence: 'Evidence',
  hypothesis: 'Hypothesis',
  strategy: 'Strategy',
}

function normalizeNodeType(type) {
  if (!type) return 'Hypothesis'
  return NODE_TYPE_NORMALIZATION[String(type).toLowerCase()] ?? type
}

function normalizeRelationship(edge) {
  return edge.relationship || edge.label || 'RELATED_TO'
}

function safeEdgeId(edge, index) {
  return edge.id || `${edge.source}-${edge.target}-${normalizeRelationship(edge)}-${index}`
}

export function normalizeGraphData(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const links = Array.isArray(graphData.links) ? graphData.links : []

  const normalizedNodes = nodes.map((node) => {
    const nodeType = normalizeNodeType(node.type)
    return {
      group: 'nodes',
      data: {
        id: String(node.id),
        label: node.label || String(node.id),
        nodeType,
        description: node.description || '',
        confidence: node.confidence ?? null,
        metadata: node.metadata || {},
        highlight: Boolean(node.highlight),
      },
    }
  })

  const normalizedEdges = links.map((edge, index) => ({
    group: 'edges',
    data: {
      id: safeEdgeId(edge, index),
      source: String(edge.source),
      target: String(edge.target),
      label: normalizeRelationship(edge),
      relationship: normalizeRelationship(edge),
      highlight: Boolean(edge.highlight),
      metadata: edge.metadata || {},
    },
  }))

  return [...normalizedNodes, ...normalizedEdges]
}

export function buildNodeIndex(graphData = {}) {
  return new Map((graphData.nodes || []).map((node) => [String(node.id), node]))
}

