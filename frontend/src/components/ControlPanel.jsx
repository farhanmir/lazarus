import React, { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, MoonStar, RotateCcw, Search, SunMedium, Zap } from 'lucide-react'

function ControlPanel({
  assets,
  selectedAssetId,
  setSelectedAssetId,
  onRunAnalysis,
  onGenerateBlueprint,
  onResetGraph,
  analysisLoading,
  blueprintLoading,
  activeRun,
  activeHypothesis,
  runStatus,
  theme,
  onToggleTheme,
}) {
  const [query, setQuery] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return assets
    return assets.filter((asset) =>
      `${asset.asset_code} ${asset.original_indication} ${asset.internal_name}`.toLowerCase().includes(normalized),
    )
  }, [assets, query])

  const statusToneClasses = {
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  }

  return (
    <section className="nexus-panel rounded-3xl bg-white/90 p-6 shadow-panel ring-1 ring-slate-200 backdrop-blur">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <span className="hud-dot">Postgres</span>
            <span className="hud-dot">Neo4j</span>
            <span className="hud-dot">OpenAI</span>
            <span className="hud-dot">K2 Think</span>
            <span className="hud-dot">Spectrum</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
            Lazarus Nexus
          </p>
          <h1 className="text-3xl font-semibold text-ink md:text-4xl">Autonomous Clinical R&amp;D Swarm</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Select an asset, trigger multi-agent analysis, inspect the reasoning graph, and package the
            resulting recommendation into an executive-ready blueprint.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
            aria-label="Toggle theme"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
          <div className="nexus-run-chip rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-50">
            <span className="block text-xs uppercase tracking-[0.18em] text-slate-400">Active Run</span>
            <span className="font-medium">
              {activeRun?.id ? `${activeRun.id} · ${activeRun.status}` : 'No run yet'}
            </span>
          </div>
        </div>
      </div>

      <motion.div
        layout
        className={`mt-6 rounded-3xl border px-4 py-4 ${statusToneClasses[runStatus.tone] ?? statusToneClasses.slate}`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">{runStatus.label}</span>
            </div>
            <p className="text-sm">{runStatus.description}</p>
          </div>
          <div className="min-w-[260px] flex-1 lg:max-w-sm">
            <div className="h-2 overflow-hidden rounded-full bg-white/70">
              <motion.div
                className="h-full rounded-full bg-current"
                initial={{ width: 0 }}
                animate={{ width: `${runStatus.progress}%` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto_auto]">
        <div className="grid gap-3">
          <label className="text-sm font-medium text-slate-700">
            Search Asset
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-pulse focus-within:bg-white">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type RX-782, Asthma, Rexalon..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                aria-label="Search assets"
              />
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Select Drug Asset
            <select
              value={selectedAssetId}
              onChange={(event) => setSelectedAssetId(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-pulse focus:bg-white"
              aria-label="Select asset"
            >
              <option value="">Choose an asset</option>
              {filteredAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.asset_code} · {asset.original_indication} · {asset.internal_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={!selectedAssetId || analysisLoading}
          className="rounded-2xl bg-pulse px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {analysisLoading ? 'Running Analysis...' : 'Run Analysis'}
          </span>
        </button>

        <button
          type="button"
          onClick={onGenerateBlueprint}
          disabled={!activeHypothesis?.id || blueprintLoading}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {blueprintLoading ? 'Generating Blueprint...' : 'Generate Blueprint'}
        </button>

        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-lg"
        >
          <span className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset Graph
          </span>
        </button>
      </div>

      <AnimatePresence>
        {showResetConfirm ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Confirm Reset</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Clear the current reasoning workspace?</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This clears the graph, selected node, blueprint preview, and current run context from the dashboard.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false)
                    onResetGraph()
                  }}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Reset Workspace
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

export default memo(ControlPanel)
