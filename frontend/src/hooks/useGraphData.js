import { useMemo } from 'react'

const legendItems = [
  { type: 'Drug', description: 'Portfolio asset under review' },
  { type: 'Target', description: 'Biological mechanism or pathway' },
  { type: 'Disease', description: 'Original and proposed indications' },
  { type: 'Evidence', description: 'Literature and trial support' },
  { type: 'Hypothesis', description: 'Synthesized repurposing recommendation' },
]

function formatConfidence(confidence) {
  if (typeof confidence !== 'number') return 'Confidence unavailable'
  const percent = confidence <= 1 ? confidence * 100 : confidence
  return `${percent.toFixed(1)}% confidence`
}

export function useGraphData(graphData, selectedNode) {
  return useMemo(() => {
    const nodes = graphData?.nodes ?? []
    const links = graphData?.links ?? []
    const selected = selectedNode ?? nodes.find((node) => node.highlight) ?? null

    const relationships = selected
      ? links
          .filter((link) => link.source === selected.id || link.target === selected.id)
          .map((link) => ({
            direction: link.source === selected.id ? 'Out' : 'In',
            label: link.relationship,
            target: link.source === selected.id ? link.target : link.source,
          }))
      : []

    const evidenceSummary =
      selected?.type === 'Evidence'
        ? selected.description || 'Primary evidence node for this hypothesis.'
        : relationships.length
          ? `${relationships.length} linked relationship${relationships.length > 1 ? 's' : ''} anchor this node in the active reasoning path.`
          : 'This node is available for deeper inspection once the graph is populated.'

    const details = selected
      ? {
          ...selected,
          confidenceLabel: formatConfidence(selected.confidence),
          description: selected.description || 'No additional description available for this graph entity.',
          evidenceSummary,
          relationships,
        }
      : null

    return {
      details,
      legendItems,
    }
  }, [graphData, selectedNode])
}
