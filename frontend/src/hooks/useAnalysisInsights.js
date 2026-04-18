import { useMemo } from 'react'

function parseStepSummary(steps, agentMatcher, fieldName, fallback) {
  const step = steps?.find((s) => agentMatcher(s.agent_name))

  try {
    const payload = step?.output_summary ? JSON.parse(step.output_summary) : null
    return payload?.[fieldName] ?? fallback
  } catch {
    return fallback
  }
}

export function useAnalysisInsights(analysisResult, runTrace) {
  const metrics = useMemo(() => {
    const riskLevel = parseStepSummary(runTrace?.steps, (name) => name === 'skeptic', 'risk_level', 'Awaiting review')
    const priorityLevel = parseStepSummary(
      runTrace?.steps,
      (name) => name === 'trial_strategist',
      'priority_level',
      analysisResult?.hypothesis?.priority_level ?? 'Awaiting strategy',
    )

    const confidence = analysisResult?.run?.final_confidence
    let formattedConfidence = 'Awaiting score'

    if (typeof confidence === 'number') {
      const normalizedConfidence = confidence <= 1 ? confidence * 100 : confidence
      formattedConfidence = `${normalizedConfidence.toFixed(1)}%`
    }

    return [
      {
        key: 'hypothesis',
        value: analysisResult?.hypothesis
          ? `${analysisResult.hypothesis.source_disease} → ${analysisResult.hypothesis.target_disease}`
          : 'Awaiting analysis',
        caption: 'Active mechanistic repurposing candidate',
      },
      {
        key: 'confidence',
        value: formattedConfidence,
        caption: analysisResult?.run?.final_recommendation ?? 'No decision yet',
      },
      {
        key: 'risk',
        value: riskLevel,
        caption: 'Derived from skeptical review and safety pressure tests',
      },
      {
        key: 'priority',
        value: priorityLevel,
        caption: 'Trial strategist recommendation for next-stage focus',
      },
    ]
  }, [
    analysisResult?.hypothesis,
    analysisResult?.run?.final_confidence,
    analysisResult?.run?.final_recommendation,
    runTrace?.steps,
  ])

  const liveInsight = useMemo(() => {
    const riskLevel = parseStepSummary(runTrace?.steps, (name) => name.includes('skeptic'), 'risk_level', 'Unknown')
    const priorityLevel = parseStepSummary(
      runTrace?.steps,
      (name) => name === 'trial_strategist',
      'priority_level',
      analysisResult?.hypothesis?.priority_level ?? 'Pending',
    )

    const runtimeMs =
      analysisResult?.run?.started_at && analysisResult?.run?.completed_at
        ? new Date(analysisResult.run.completed_at) - new Date(analysisResult.run.started_at)
        : null

    const runtimeLabel = runtimeMs === null ? 'LIVE' : `${(runtimeMs / 1000).toFixed(1)}s`

    return {
      riskLevel,
      priorityLevel,
      runtimeLabel,
    }
  }, [
    analysisResult?.hypothesis?.priority_level,
    analysisResult?.run?.completed_at,
    analysisResult?.run?.started_at,
    runTrace?.steps,
  ])

  return { metrics, liveInsight }
}
