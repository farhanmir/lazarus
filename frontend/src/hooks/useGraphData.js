/**
 * Memoises the Cytoscape graph view-model: legend entries, a flat node
 * overview, and the detail block for the currently selected node. Consumers
 * (InteractiveGraph, NodeDetailsPanel) stay pure render components.
 */
import { useMemo } from 'react'

const legendItems = [
  { type: 'Drug', description: 'Portfolio asset under review' },
  { type: 'Target', description: 'Biological mechanism or pathway' },
  { type: 'Disease', description: 'Original and proposed indications' },
  { type: 'Evidence', description: 'Literature and trial support' },
  { type: 'Hypothesis', description: 'Synthesized repurposing recommendation' },
  { type: 'Strategy', description: 'Operational recommendation for next-stage execution' },
]

const nodeTypeDescriptions = {
  Drug: 'Starting asset under review. This is the shelved or archived compound being evaluated for repurposing.',
  Target: 'Mechanistic anchor. Targets explain which pathway or protein connects the asset to the proposed disease.',
  Disease: 'Clinical indication node. Diseases show both the original indication and the candidate repurposing direction.',
  Evidence: 'Support layer. Evidence nodes capture trials, papers, or observations that strengthen or weaken the hypothesis.',
  Hypothesis: 'Decision layer. This node represents the synthesized repurposing thesis produced by the agent workflow.',
  Strategy: 'Execution layer. Strategy nodes describe the recommended next move after the hypothesis is accepted.',
}

const relationshipDescriptions = {
  TARGETS: 'Shows which biological target the drug acts on.',
  FAILED_FOR: 'Marks the original indication or program context where the asset underperformed or was shelved.',
  ORIGINALLY_INDICATED_FOR: 'Connects the asset back to its original disease program.',
  SUPPORTED_BY: 'Links a disease or hypothesis to evidence that supports it.',
  PROPOSES_REPURPOSING_OF: 'Connects the hypothesis to the underlying asset being repurposed.',
  TO_DISEASE: 'Shows the destination disease the repurposing case is moving toward.',
  BASED_ON_TARGET: 'Explains that the hypothesis is grounded in the selected target or mechanism.',
  RECOMMENDS: 'Represents the strategic recommendation generated from the judged hypothesis.',
  LINKED_TO: 'Connects related biological or disease entities inside the active reasoning path.',
  RELATED_TO: 'Generic relationship used when no more specific semantic label is available.',
}

function formatConfidence(confidence) {
  if (typeof confidence !== 'number') return 'Confidence unavailable'
  const percent = confidence <= 1 ? confidence * 100 : confidence
  return `${percent.toFixed(1)}% confidence`
}

function findNode(nodes, predicate) {
  return nodes.find(predicate) ?? null
}

function buildGraphOverview(nodes, links) {
  const drug = findNode(nodes, (node) => node.type === 'Drug' && node.highlight) ?? findNode(nodes, (node) => node.type === 'Drug')
  const target = findNode(nodes, (node) => node.type === 'Target' && node.highlight) ?? findNode(nodes, (node) => node.type === 'Target')
  const disease = findNode(nodes, (node) => node.type === 'Disease' && node.highlight) ?? findNode(nodes, (node) => node.type === 'Disease')
  const hypothesis = findNode(nodes, (node) => node.type === 'Hypothesis' && node.highlight) ?? findNode(nodes, (node) => node.type === 'Hypothesis')
  const strategy = findNode(nodes, (node) => node.type === 'Strategy' && node.highlight) ?? findNode(nodes, (node) => node.type === 'Strategy')
  const evidenceCount = nodes.filter((node) => node.type === 'Evidence').length

  const flowParts = []
  if (drug) flowParts.push(`${drug.label} (${drug.type})`)
  if (target) flowParts.push(`${target.label} (${target.type})`)
  if (disease) flowParts.push(`${disease.label} (${disease.type})`)
  if (hypothesis) flowParts.push(`${hypothesis.label} (${hypothesis.type})`)
  if (strategy) flowParts.push(`${strategy.label} (${strategy.type})`)

  const summary = flowParts.length
    ? `The graph starts from ${drug?.label ?? 'the asset'}, moves through ${target?.label ?? 'its target'} toward ${disease?.label ?? 'the candidate disease'}, and then ends at ${strategy?.label ?? hypothesis?.label ?? 'the final recommendation'} after evidence review.`
    : 'The graph will describe how a shelved asset connects to a mechanism, disease hypothesis, evidence package, and execution strategy.'

  return {
    summary,
    flow: flowParts,
    evidenceCount,
    relationshipCount: links.length,
  }
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
            meaning: relationshipDescriptions[link.relationship] ?? relationshipDescriptions.RELATED_TO,
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
          metadata: selected.metadata || {},
          typeDescription: nodeTypeDescriptions[selected.type] ?? 'This node contributes to the reasoning graph.',
        }
      : null

    const overview = {
      ...buildGraphOverview(nodes, links),
      nodeTypeDescription: details?.typeDescription ?? null,
      relationshipMeanings: details?.relationships ?? [],
    }

    return {
      details,
      overview,
      legendItems,
    }
  }, [graphData, selectedNode])
}
