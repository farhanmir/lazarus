import React, { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, FileBadge2, ShieldCheck, Sparkles } from 'lucide-react'

function BlueprintViewer({ blueprintResult, downloadUrl, blueprintLoading }) {
  const blueprint = blueprintResult?.blueprint
  const payload = blueprintResult?.payload

  return (
    <section className="rounded-3xl bg-white/90 p-6 shadow-panel ring-1 ring-slate-200 backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Executive Artifact</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Blueprint Viewer</h2>
        </div>
        {blueprint ? (
          <a
            href={downloadUrl}
            className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl"
          >
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Blueprint
            </span>
          </a>
        ) : null}
      </div>

      <AnimatePresence mode="wait">
        {blueprintLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-3xl border border-blue-100 bg-blue-50/80 p-6"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-600 p-3 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Generating executive blueprint...</p>
                <p className="text-sm text-blue-700">Packaging evidence, risk, and next-step strategy into a shareable artifact.</p>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
              <motion.div
                className="h-full rounded-full bg-blue-600"
                initial={{ width: '10%' }}
                animate={{ width: ['18%', '76%', '92%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        ) : blueprint ? (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]"
          >
            <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Drug</span>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {payload?.drug_name} ({payload?.asset_code})
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Target Disease</span>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{payload?.proposed_indication}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confidence</span>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {typeof payload?.confidence_score === 'number'
                      ? `${payload.confidence_score <= 1 ? (payload.confidence_score * 100).toFixed(1) : payload.confidence_score.toFixed(1)}%`
                      : 'n/a'}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recommendation</span>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{payload?.recommendation ?? 'Not generated'}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Priority</span>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{payload?.priority_level ?? 'Not assigned'}</p>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Executive Summary</span>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {blueprint.executive_summary ?? 'Blueprint content is still being assembled.'}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileBadge2 className="h-4 w-4 text-blue-600" />
                    Trial Focus
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{payload?.trial_focus ?? 'Awaiting strategy generation'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Business Rationale
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{payload?.business_rationale ?? 'Awaiting strategy generation'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 p-5 text-white">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Download Status</span>
                <p className="mt-1 text-lg font-semibold">Download Ready</p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Blueprint Status</span>
                <p className="mt-1 text-lg font-semibold">{blueprint.generation_status}</p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Recommended Action</span>
                <p className="mt-1 text-base font-semibold">{payload?.recommended_action ?? 'Not generated'}</p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Suggested Cohort</span>
                <p className="mt-1 text-sm text-slate-100">{payload?.suggested_patient_cohort ?? 'Not assigned'}</p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">PDF Path</span>
                <p className="mt-1 break-all text-sm text-slate-100">{blueprint.pdf_path}</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500"
          >
            Generate a blueprint to preview executive metadata, strategy summary, and the final downloadable artifact.
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export default memo(BlueprintViewer)
