import React, { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, CircleDashed, Clock3, ShieldAlert, Sparkles } from 'lucide-react'

const agentStyles = {
  advocate: 'bg-blue-50 text-blue-700 ring-blue-200',
  skeptic: 'bg-orange-50 text-orange-700 ring-orange-200',
  evidence_curator: 'bg-violet-50 text-violet-700 ring-violet-200',
  judge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  trial_strategist: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
}

function formatStepTitle(step) {
  if (step.agent_name === 'advocate') return `Advocate → ${step.score?.toFixed(2) ?? 'n/a'}`
  if (step.agent_name === 'skeptic') return `Skeptic → ${step.score?.toFixed(2) ?? 'n/a'}`
  if (step.agent_name === 'evidence_curator') return 'Curator → Evidence Compiled'
  if (step.agent_name === 'judge') return `Judge → ${step.score?.toFixed(2) ?? 'n/a'}`
  if (step.agent_name === 'trial_strategist') return 'Trial Strategist → Action Plan'
  return step.agent_name
}

function parseOutput(step) {
  try {
    return JSON.parse(step.output_summary)
  } catch {
    return null
  }
}

function formatDuration(step) {
  if (!step.started_at || !step.completed_at) return 'Live'
  const durationMs = new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

function stepStatusIcon(status) {
  if (status === 'completed') return CheckCircle2
  if (status === 'failed') return ShieldAlert
  if (status === 'running') return Clock3
  return CircleDashed
}

function AgentTimeline({ steps = [] }) {
  const [expandedId, setExpandedId] = useState(null)

  const normalizedSteps = useMemo(
    () =>
      steps.map((step) => ({
        ...step,
        parsedOutput: parseOutput(step),
      })),
    [steps],
  )

  return (
    <section className="rounded-3xl bg-white/90 p-6 shadow-panel ring-1 ring-slate-200 backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Workflow Progress</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Agent Stepper</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
          {steps.length} Steps
        </span>
      </div>

      <div className="space-y-5">
        {normalizedSteps.map((step, index) => {
          const StatusIcon = stepStatusIcon(step.status)
          const isExpanded = expandedId === step.id
          return (
          <motion.div key={step.id} layout className="relative flex gap-4">
            <div className="flex w-10 flex-col items-center">
              <div
                className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                  step.status === 'completed'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : step.status === 'failed'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : step.status === 'running'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <StatusIcon className="h-4 w-4" />
              </div>
              {index < steps.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200" /> : null}
            </div>
            <motion.div layout className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : step.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                aria-expanded={isExpanded}
              >
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{formatStepTitle(step)}</h3>
                  <p className="mt-2 max-w-[34rem] text-sm leading-7 text-slate-600">
                    {step.input_summary || 'Agent completed its reasoning slice.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ring-1 ${
                    agentStyles[step.agent_name] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
                    }`}
                  >
                    {step.agent_name.replace('_', ' ')}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] text-slate-500">
                <span>Status: {step.status}</span>
                <span>Score: {typeof step.score === 'number' ? step.score.toFixed(2) : 'n/a'}</span>
                <span>
                  Runtime:{' '}
                  {formatDuration(step)}
                </span>
                <span>
                  Completed:{' '}
                  {step.completed_at
                    ? new Date(step.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'pending'}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {isExpanded ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        Agent Reasoning Details
                      </div>
                      <pre className="overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                        {step.parsedOutput
                          ? JSON.stringify(step.parsedOutput, null, 2)
                          : step.output_summary}
                      </pre>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
          )
        })}
        {!steps.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-base leading-8 text-slate-500">
            Run an analysis to populate the Advocate → Skeptic → Curator → Judge → Trial Strategist workflow.
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default memo(AgentTimeline)
