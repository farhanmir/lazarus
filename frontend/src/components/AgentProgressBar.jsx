import React, { memo, useMemo } from 'react'

const STAGES = [
  { key: 'advocate', label: 'ADVOCATE',  aliases: ['advocate', 'advocate_iteration'], color: '#6b50a8' },
  { key: 'skeptic',  label: 'SKEPTIC',   aliases: ['skeptic', 'skeptic_iteration'],   color: '#9b3d3d' },
  { key: 'curator',  label: 'CURATOR',   aliases: ['parallel_evidence', 'evidence_curator', 'evidence_iteration', 'assessment', 'assessment_iteration'], color: '#2e5a6e' },
  { key: 'judge',    label: 'JUDGE',     aliases: ['judge'],                           color: '#8a6e1e' },
  { key: 'strategy', label: 'STRATEGY',  aliases: ['trial_strategist', 'hitl_router'], color: '#1f3a2e' },
]

function buildStages(steps, runStatus) {
  const done = new Set(steps.filter(s => s.status === 'completed').map(s => s.agent_name))
  const failed = steps.find(s => s.status === 'failed')

  const states = STAGES.map(stage => ({
    ...stage,
    status: stage.aliases.some(a => done.has(a)) ? 'completed' : 'pending',
  }))

  if (failed) {
    const failedStage = states.find(s => s.aliases.includes(failed.agent_name))
    if (failedStage) failedStage.status = 'failed'
    return states
  }

  if (runStatus === 'running' || runStatus === 'queued') {
    const next = states.find(s => s.status === 'pending')
    if (next) next.status = 'running'
  }

  return states
}

function StageDot({ status, color }) {
  const bg =
    status === 'completed' ? color :
    status === 'running'   ? color :
    status === 'failed'    ? '#9b3d3d' :
    'rgba(20,23,26,0.2)'

  return (
    <span
      className="stage-dot"
      style={{
        background: bg,
        boxShadow: 'none',
      }}
    />
  )
}

function AgentProgressBar({ steps = [], runStatus = 'idle' }) {
  const stages = useMemo(() => buildStages(steps, runStatus), [steps, runStatus])

  return (
    <div className="term-panel" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="term-panel-header">
        <span className="term-panel-title">Agent Pipeline</span>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
          {stages.filter(s => s.status === 'completed').length} of {stages.length} complete
        </span>
      </div>
      <div className="term-panel-body">
        <div className="pipeline-bar">
          {stages.map(stage => (
            <div key={stage.key} className={`pipeline-stage ${stage.status}`}>
              <div className="stage-row">
                <StageDot status={stage.status} color={stage.color} />
                <span className="stage-name" style={{
                  color: stage.status === 'completed' || stage.status === 'running'
                    ? stage.color
                    : 'var(--text-dim)'
                }}>
                  {stage.label}
                </span>
              </div>
              {(stage.status === 'running' || stage.status === 'failed') && (
                <span className={`stage-status ${stage.status}`}>
                  {stage.status.toUpperCase()}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default memo(AgentProgressBar)
