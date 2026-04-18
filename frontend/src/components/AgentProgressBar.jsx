import React, { memo, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleDashed, Play, XCircle } from 'lucide-react'

const stageDefinitions = [
  { key: 'advocate', label: 'Advocate', aliases: ['advocate', 'advocate_iteration'] },
  { key: 'skeptic', label: 'Skeptic', aliases: ['skeptic', 'skeptic_iteration'] },
  { key: 'curator', label: 'Curator', aliases: ['parallel_evidence', 'evidence_curator', 'evidence_iteration', 'assessment', 'assessment_iteration'] },
  { key: 'judge', label: 'Judge', aliases: ['judge'] },
  { key: 'trial', label: 'Trial Strategist', aliases: ['trial_strategist', 'hitl_router'] },
]

function buildStageState(steps, runStatus) {
  const completedAliases = new Set(
    steps.filter((step) => step.status === 'completed').map((step) => step.agent_name),
  )
  const failedStep = steps.find((step) => step.status === 'failed')

  const states = stageDefinitions.map((stage) => {
    const completed = stage.aliases.some((alias) => completedAliases.has(alias))
    return {
      ...stage,
      status: completed ? 'completed' : 'pending',
    }
  })

  if (failedStep) {
    const failedStage = states.find((stage) => stage.aliases.includes(failedStep.agent_name))
    if (failedStage) failedStage.status = 'failed'
    return states
  }

  if (runStatus === 'running' || runStatus === 'queued') {
    const nextStage = states.find((stage) => stage.status === 'pending')
    if (nextStage) nextStage.status = 'running'
  }

  return states
}

function StageIcon({ status }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4" />
  if (status === 'running') return <Play className="h-4 w-4" />
  if (status === 'failed') return <XCircle className="h-4 w-4" />
  return <CircleDashed className="h-4 w-4" />
}

function AgentProgressBar({ steps = [], runStatus = 'idle' }) {
  const stages = useMemo(() => buildStageState(steps, runStatus), [steps, runStatus])

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Live Stage Flow</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Multi-Agent Pipeline</h2>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-5">
        {stages.map((stage, index) => (
          <div key={stage.key} className="relative">
            <motion.div
              layout
              className={`flex items-center gap-3 rounded-2xl border px-4 py-4 ${
                stage.status === 'completed'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : stage.status === 'running'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : stage.status === 'failed'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <div className={`${stage.status === 'running' ? 'animate-pulse' : ''}`}>
                <StageIcon status={stage.status} />
              </div>
              <div>
                <p className="text-sm font-semibold">{stage.label}</p>
                <p className="text-[11px] uppercase tracking-[0.18em]">{stage.status}</p>
              </div>
            </motion.div>
            <AnimatePresence>
              {index < stages.length - 1 ? (
                <motion.div
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: 1 }}
                  className="hidden xl:block absolute right-[-18px] top-1/2 h-px w-8 bg-slate-300"
                />
              ) : null}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  )
}

export default memo(AgentProgressBar)
