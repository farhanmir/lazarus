import React, { useEffect, useRef, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AgentTimeline from './components/AgentTimeline'
import {
  evaluateCandidate,
  fetchBlueprintDetail,
  fetchCandidates,
  sendPhotonNotification,
  startBlueprintJob,
  subscribeRunStream,
} from './services/api'

function readableOutput(raw) {
  if (!raw) return 'Waiting for output...'
  try {
    const p = JSON.parse(raw)
    if (p.proposed_disease && p.confidence != null)
      return `Proposed: ${p.proposed_disease} · confidence ${(p.confidence * 100).toFixed(0)}%`
    if (p.risk_level)
      return `Risk: ${p.risk_level}${p.verdict ? ' · ' + p.verdict : ''}${p.reasoning ? '\n' + p.reasoning : ''}`
    if (p.final_decision && p.final_confidence != null)
      return `Verdict: ${p.final_decision} · confidence ${(p.final_confidence * 100).toFixed(0)}%${p.rationale ? '\n' + p.rationale : ''}`
    if (p.recommended_action)
      return `Action: ${p.recommended_action}${p.rationale ? '\n' + p.rationale : ''}`
    if (p.evidence_summary)
      return p.evidence_summary
    const stringPairs = Object.entries(p)
      .filter(([, v]) => typeof v === 'string' && v.length > 0)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    return stringPairs.length > 0 ? stringPairs.join('\n') : raw
  } catch {
    return raw
  }
}

const PIPELINE_STAGES = [
  { id: 'openclaw', label: 'Searching Trials (OpenClaw)' },
  { id: 'gemini', label: 'Ingesting Data (Gemini)' },
  { id: 'k2', label: 'Reasoning Pivot (K2)' },
  { id: 'dedalus', label: 'Finalizing Blueprint (Dedalus)' },
  { id: 'photon', label: 'Sending Alert (Photon)' },
]

function stageMap() {
  return PIPELINE_STAGES.reduce((accumulator, stage) => {
    accumulator[stage.id] = { status: 'idle', detail: '' }
    return accumulator
  }, {})
}

async function waitForRunCompletion(runId, onTrace) {
  return new Promise((resolve, reject) => {
    const subscription = subscribeRunStream(runId, {
      onMessage: (payload) => {
        onTrace(payload)
        if (payload?.run?.status === 'failed') {
          subscription.close()
          reject(new Error(payload.run.error_message || 'K2 reasoning failed.'))
          return
        }
        if (payload?.run?.status === 'completed') {
          subscription.close()
          resolve(payload)
        }
      },
      onError: () => {
        subscription.close()
        reject(new Error('Run stream disconnected while waiting for K2 output.'))
      },
    })
  })
}

function App() {
  const [disease, setDisease] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [reasoningLoading, setReasoningLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [stages, setStages] = useState(stageMap)
  const [autopsy, setAutopsy] = useState(null)
  const [rescue, setRescue] = useState(null)
  const [blueprint, setBlueprint] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [latestRunId, setLatestRunId] = useState('')
  const [liveTrace, setLiveTrace] = useState(null)
  const [photonRecipient, setPhotonRecipient] = useState('')
  const [sendingPhoton, setSendingPhoton] = useState(false)
  const [photonResult, setPhotonResult] = useState('')
  const [showTrace, setShowTrace] = useState(false)
  const [outputTab, setOutputTab] = useState('output')
  const traceDrawerRef = useRef(null)
  const traceCloseRef = useRef(null)


  useEffect(() => {
    if (showTrace && traceCloseRef.current) {
      traceCloseRef.current.focus()
    }
  }, [showTrace])

  function handleTraceKeyDown(e) {
    if (e.key === 'Escape') {
      setShowTrace(false)
      return
    }
    if (e.key !== 'Tab' || !traceDrawerRef.current) return
    const focusable = traceDrawerRef.current.querySelectorAll(
      'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  const selectedCandidate = useMemo(
    () => searchResults.find((candidate) => candidate.asset_id === selectedCandidateId) ?? null,
    [searchResults, selectedCandidateId],
  )

  const discoveredCandidates = blueprint?.candidates ?? []

  const canSearch = useMemo(() => disease.trim().length >= 2 && !searchLoading, [disease, searchLoading])
  const canReason = useMemo(() => !!selectedCandidate && !reasoningLoading, [selectedCandidate, reasoningLoading])

  const updateStage = (stageId, status, detail = '') => {
    setStages((previous) => ({
      ...previous,
      [stageId]: {
        status,
        detail: detail || previous[stageId]?.detail || '',
      },
    }))
  }

  const handleSearch = async (event) => {
    event.preventDefault()
    const diseaseQuery = disease.trim()
    if (diseaseQuery.length < 2) return

    setSearchLoading(true)
    setError('')
    setLiveTrace(null)
    setAutopsy(null)
    setRescue(null)
    setBlueprint(null)
    setLatestRunId('')
    setAlertMessage('')
    setPhotonResult('')
    setSelectedCandidateId('')
    setSearchResults([])
    setStages(stageMap())

    try {
      updateStage('openclaw', 'running', 'Scanning terminated and failed studies...')
      const candidateResult = await fetchCandidates(diseaseQuery, 10)
      const candidates = candidateResult?.candidates ?? []

      if (!candidates.length) {
        throw new Error(`No terminated trial candidates found for ${diseaseQuery}.`)
      }

      setSearchResults(candidates)
      setSelectedCandidateId(candidates[0].asset_id)

      updateStage(
        'openclaw',
        'done',
        `${candidates.length} failed trials ranked for ${diseaseQuery}.`,
      )
    } catch (error_) {
      const message = error_?.response?.data?.detail || error_?.message || 'Pipeline failed unexpectedly.'
      setError(message)
      setStages((previous) => {
        const runningEntry = Object.entries(previous).find(([, value]) => value.status === 'running')
        if (!runningEntry) return previous
        const [failedId, failedStage] = runningEntry
        return {
          ...previous,
          [failedId]: {
            ...failedStage,
            status: 'failed',
            detail: message,
          },
        }
      })
    } finally {
      setSearchLoading(false)
    }
  }

  const handleReasoning = async () => {
    if (!selectedCandidate || reasoningLoading) return

    setReasoningLoading(true)
    setError('')
    setAutopsy(null)
    setRescue(null)
    setBlueprint(null)
    setAlertMessage('')
    setPhotonResult('')
    setLatestRunId('')
    setLiveTrace(null)
    setStages(stageMap())

    try {
      updateStage('openclaw', 'done', `${selectedCandidate.asset_code}: selected from ranked failed trial list.`)
      updateStage('gemini', 'running', 'Ingesting the selected trial report and LLM brief...')

      const autopsyPayload = {
        trial_id: selectedCandidate.asset_code,
        disease: disease.trim(),
        drug: selectedCandidate.drug_name,
        scientific_wall:
          selectedCandidate.abandonment_reason ||
          selectedCandidate.relevance_summary ||
          'Trial failed for non-specific operational or safety reasons.',
        match_reason: selectedCandidate.match_reason,
      }
      setAutopsy(autopsyPayload)
      updateStage('gemini', 'done', selectedCandidate.relevance_summary || 'Trial evidence ingested and summarized.')

      updateStage('k2', 'running', 'Reasoning over the selected failure mode...')
      const runJob = await evaluateCandidate({
        drug: selectedCandidate.drug_name,
        disease: disease.trim(),
        assetCode: selectedCandidate.asset_code,
      })
      setLatestRunId(runJob.run.id)

      const finalTrace = await waitForRunCompletion(runJob.run.id, setLiveTrace)
      const hypothesis = finalTrace?.hypothesis
      if (!hypothesis?.id) {
        throw new Error('K2 finished without a recoverable hypothesis.')
      }

      setRescue({
        run_id: runJob.run.id,
        hypothesis_id: hypothesis.id,
        summary: hypothesis.summary,
        target_disease: hypothesis.target_disease,
        confidence: hypothesis.final_confidence,
      })
      updateStage('k2', 'done', `Pivot proposed for ${hypothesis.target_disease} at confidence ${Number(hypothesis.final_confidence || 0).toFixed(2)}.`)

      updateStage('dedalus', 'running', 'Finalizing the blueprint from the completed reasoning trace...')
      const blueprintJob = await startBlueprintJob(hypothesis.id)
      let detail = null
      let pollCount = 0
      while (!detail || detail.blueprint.generation_status === 'pending') {
        if (pollCount >= 90) throw new Error('Dedalus blueprint generation timed out after 90s.')
        await new Promise((resolve) => globalThis.setTimeout(resolve, 1000))
        detail = await fetchBlueprintDetail(blueprintJob.blueprint.id)
        pollCount++
      }

      if (detail.blueprint.generation_status === 'failed') {
        throw new Error('Dedalus blueprint generation failed.')
      }

      const finalBlueprint = {
        id: detail.blueprint.id,
        title: detail.blueprint.title,
        executive_summary: detail.payload?.executive_summary || detail.blueprint.executive_summary || '',
        candidates: searchResults.slice(0, 5),
        download_url: `/blueprints/${detail.blueprint.id}/download`,
      }
      setBlueprint(finalBlueprint)
      updateStage('dedalus', 'done', `Rescue Blueprint ready with ${finalBlueprint.candidates.length} high-confidence candidates.`)

      updateStage('photon', 'running', 'Dispatching scientist notification...')
      const text = `Trial Rescued: ${disease.trim()} (Trial ID: ${selectedCandidate.asset_code}). ${finalBlueprint.candidates.length} candidates identified via K2 Reasoning. View Blueprint: ${finalBlueprint.download_url}`
      setAlertMessage(text)
      updateStage('photon', 'done', 'Lead researcher alert composed and queued.')
    } catch (error_) {
      const message = error_?.response?.data?.detail || error_?.message || 'Pipeline failed unexpectedly.'
      setError(message)
      setStages((previous) => {
        const runningEntry = Object.entries(previous).find(([, value]) => value.status === 'running')
        if (!runningEntry) return previous
        const [failedId, failedStage] = runningEntry
        return {
          ...previous,
          [failedId]: {
            ...failedStage,
            status: 'failed',
            detail: message,
          },
        }
      })
    } finally {
      setReasoningLoading(false)
    }
  }

  const handleSendPhoton = async () => {
    const recipient = photonRecipient.trim()
    if (!recipient || !alertMessage) return

    setSendingPhoton(true)
    setPhotonResult('')
    try {
      const data = await sendPhotonNotification({ recipient, message: alertMessage })
      setPhotonResult(`Queued to ${data.recipient}.`)
      updateStage('photon', 'done', `Alert delivered to ${data.recipient}.`)
    } catch (error_) {
      const message = error_?.response?.data?.detail || error_?.message || 'Failed to send Photon alert.'
      setPhotonResult(message)
      updateStage('photon', 'failed', message)
    } finally {
      setSendingPhoton(false)
    }
  }

  return (
    <main className="pipeline-root">
      <div className="pipeline-shell">
        <nav className="pipeline-nav">
          <Link to="/" className="pipeline-nav-home" aria-label="Back to home">
            <img src="/icon.png" alt="" className="pipeline-nav-icon" />
          </Link>
          <span className="pipeline-nav-sep">/</span>
          <span className="pipeline-nav-current">Dashboard</span>
          {latestRunId && (
            <>
              <span className="pipeline-nav-sep">/</span>
              <button
                type="button"
                className="pipeline-nav-link pipeline-nav-btn"
                onClick={() => setShowTrace(true)}
              >
                Agent Trace
              </button>
            </>
          )}
        </nav>

        <header className="pipeline-header">
          <p className="pipeline-kicker">Lazarus Scientific Pipeline</p>
          <h1>Search failed trials, then choose one to rescue.</h1>
          <p className="pipeline-subcopy">
            OpenClaw searches the database for failed trials, LLMs rank the shortlist with rescue angles, then the selected
            trial is ingested and reasoned over live.
          </p>
        </header>

        <form className="pipeline-search" onSubmit={handleSearch}>
          <label htmlFor="disease-input">Enter disease to rescue</label>
          <div className="pipeline-search-row">
            <input
              id="disease-input"
              type="text"
              value={disease}
              onChange={(event) => setDisease(event.target.value)}
              placeholder="Glioblastoma"
              autoComplete="off"
            />
            <button type="submit" disabled={!canSearch}>
              {searchLoading ? 'Searching...' : 'Search Failed Trials'}
            </button>
          </div>
        </form>

        {error && <p className="pipeline-error">{error}</p>}

        {searchResults.length > 0 && (
          <section className="trial-search-results">
            <div className="section-label-row">
              <p className="pipeline-kicker">Ranked shortlist</p>
              <span className="trial-count">{searchResults.length} failed trials found</span>
            </div>
            <div className="trial-grid">
              {searchResults.map((candidate) => {
                const selected = candidate.asset_id === selectedCandidateId
                return (
                  <button
                    type="button"
                    key={candidate.asset_id}
                    className={`trial-card ${selected ? 'selected' : ''}`}
                    onClick={() => setSelectedCandidateId(candidate.asset_id)}
                  >
                    <div className="trial-card-top">
                      <div>
                        <div className="trial-code">{candidate.asset_code}</div>
                        <div className="trial-name">{candidate.drug_name}</div>
                      </div>
                      <div className="trial-score">{Number(candidate.scientific_confidence_score).toFixed(2)}</div>
                    </div>
                    <div className="trial-meta">{candidate.original_indication} · {candidate.trial_status || 'shelved'}</div>
                    <p className="trial-summary">{candidate.relevance_summary}</p>
                    <ul className="trial-facts">
                      {candidate.key_facts?.slice(0, 3).map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                    <div className="trial-rescue-angle">{candidate.rescue_angle}</div>
                    <div className="trial-action">{selected ? 'Selected trial' : 'Select trial'}</div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {selectedCandidate && (
          <section className="selected-trial-panel">
            <div>
              <p className="pipeline-kicker">Selected trial</p>
              <h2>{selectedCandidate.drug_name} · {selectedCandidate.asset_code}</h2>
              <p className="selected-trial-summary">{selectedCandidate.relevance_summary}</p>
            </div>

            <div className="selected-trial-grid">
              <article>
                <h3>Why it matters</h3>
                <p>{selectedCandidate.match_reason}</p>
              </article>
              <article>
                <h3>Rescue angle</h3>
                <p>{selectedCandidate.rescue_angle}</p>
              </article>
              <article>
                <h3>Failure reason</h3>
                <p>{selectedCandidate.abandonment_reason || 'Not recorded'}</p>
              </article>
            </div>

            <button type="button" className="selected-trial-button" onClick={handleReasoning} disabled={!canReason}>
              {reasoningLoading ? 'Reasoning live...' : 'Start reasoning'}
            </button>
          </section>
        )}

        <section className="pipeline-timeline" aria-label="Lazarus timeline">
          {PIPELINE_STAGES.map((stage, index) => {
            const stageState = stages[stage.id]
            let stageMarker = String(index + 1).padStart(2, '0')
            if (stageState.status === 'done') stageMarker = '✓'
            if (stageState.status === 'running') stageMarker = '›'
            if (stageState.status === 'failed') stageMarker = '✗'
            return (
              <article className={`timeline-row ${stageState.status}`} key={stage.id}>
                <span className="timeline-check" aria-hidden="true">
                  {stageMarker}
                </span>
                <div className="timeline-copy">
                  <h2>{stage.label}</h2>
                  <p>{stageState.detail || 'Waiting for activation.'}</p>
                </div>
              </article>
            )
          })}
        </section>

        {(autopsy || rescue || blueprint || alertMessage || liveTrace || reasoningLoading) && (
          <div className="output-tabs-wrap">
            <div className="output-tabs" role="tablist" aria-label="Pipeline output views">
              <button
                type="button"
                role="tab"
                id="tab-output"
                aria-selected={outputTab === 'output'}
                aria-controls="panel-output"
                className={`output-tab${outputTab === 'output' ? ' active' : ''}`}
                onClick={() => setOutputTab('output')}
              >
                Pipeline Output
              </button>
              <button
                type="button"
                role="tab"
                id="tab-live"
                aria-selected={outputTab === 'live'}
                aria-controls="panel-live"
                className={`output-tab${outputTab === 'live' ? ' active' : ''}`}
                onClick={() => setOutputTab('live')}
              >
                Live Findings
                {(reasoningLoading || liveTrace?.run?.status === 'running') && (
                  <span className="live-tab-dot" aria-hidden="true" />
                )}
              </button>
              {latestRunId && (
                <button
                  type="button"
                  role="tab"
                  id="tab-trace"
                  aria-selected={outputTab === 'trace'}
                  aria-controls="panel-trace"
                  className={`output-tab${outputTab === 'trace' ? ' active' : ''}`}
                  onClick={() => setOutputTab('trace')}
                >
                  Agent Trace
                </button>
              )}
            </div>

            {outputTab === 'output' && (autopsy || rescue || blueprint || alertMessage) && (
              <section className="pipeline-output" role="tabpanel" id="panel-output" aria-labelledby="tab-output">
                {autopsy && (
                  <article>
                    <h3>Trial Autopsy</h3>
                    <p>
                      {autopsy.trial_id}: {autopsy.scientific_wall}
                    </p>
                  </article>
                )}

                {rescue && (
                  <article>
                    <h3>Scientific Rescue Strategy</h3>
                    <p>{rescue.summary}</p>
                  </article>
                )}

                {blueprint && (
                  <article>
                    <h3>Rescue Blueprint</h3>
                    <p>{blueprint.executive_summary}</p>
                    <ul>
                      {discoveredCandidates.map((candidate) => (
                        <li key={candidate.asset_id}>{candidate.drug_name} ({candidate.asset_code})</li>
                      ))}
                    </ul>
                  </article>
                )}

                {alertMessage && (
                  <article>
                    <h3>Photon Alert Payload</h3>
                    <p>{alertMessage}</p>
                    <div className="photon-send-row">
                      <input
                        type="tel"
                        value={photonRecipient}
                        onChange={(event) => setPhotonRecipient(event.target.value)}
                        placeholder="+1 555 123 4567"
                        aria-label="Photon recipient phone number"
                      />
                      <button
                        type="button"
                        onClick={handleSendPhoton}
                        disabled={!photonRecipient.trim() || sendingPhoton}
                      >
                        {sendingPhoton ? 'Sending...' : 'Send via Photon'}
                      </button>
                    </div>
                    {photonResult && <p className="photon-send-result">{photonResult}</p>}
                  </article>
                )}
              </section>
            )}

            {outputTab === 'live' && (
              <section className="live-findings-panel" role="tabpanel" id="panel-live" aria-labelledby="tab-live">
                {!liveTrace && !reasoningLoading && (
                  <p className="trace-info" style={{ padding: '20px 0' }}>No live run data yet. Start reasoning to see live findings.</p>
                )}
                {(liveTrace || reasoningLoading) && (
                  <>
                    <div className="live-summary">
                      <article>
                        <h3>Current hypothesis</h3>
                        <p>{liveTrace?.hypothesis?.summary || 'Reasoning has not converged yet.'}</p>
                      </article>
                      <article>
                        <h3>Progress</h3>
                        <p>
                          {liveTrace?.steps?.filter((step) => step.status === 'completed').length ?? 0}
                          {' '}of {liveTrace?.steps?.length ?? 0} steps complete
                        </p>
                      </article>
                      <article>
                        <h3>Status</h3>
                        <p>{liveTrace?.run?.status || (reasoningLoading ? 'running' : 'idle')}</p>
                      </article>
                    </div>

                    <div className="live-steps">
                        {(liveTrace?.steps || []).map((step) => (
                          <article key={step.id} className={`live-step ${step.status}`}>
                            <div className="live-step-head">
                              <strong>{step.agent_name.replace(/_/g, ' ').toUpperCase()}</strong>
                              <span>{step.status}</span>
                            </div>
                            <p style={{ whiteSpace: 'pre-line' }}>
                              {readableOutput(step.output_summary || step.input_summary)}
                            </p>
                          </article>
                        ))}
                        {reasoningLoading && (!liveTrace?.steps || liveTrace.steps.length === 0) && (
                          <p className="trace-info" style={{ marginTop: 'auto' }}>Waiting for the first agent response...</p>
                        )}
                    </div>
                  </>
                )}
              </section>
            )}

            {outputTab === 'trace' && latestRunId && (
              <section className="pipeline-output" role="tabpanel" id="panel-trace" aria-labelledby="tab-trace">
                <AgentTimeline steps={liveTrace?.steps ?? []} />
              </section>
            )}
          </div>
        )}

        {showTrace && (
          <div
            className="trace-overlay"
            onClick={(e) => e.target === e.currentTarget && setShowTrace(false)}
            onKeyDown={handleTraceKeyDown}
          >
            <div
              className="trace-drawer"
              ref={traceDrawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="trace-drawer-title"
            >
              <div className="trace-drawer-header">
                <div>
                  <p className="pipeline-kicker">Agent Trace</p>
                  <h2 id="trace-drawer-title" style={{ margin: '4px 0 0', fontSize: '18px' }}>Run {latestRunId?.slice(0, 8)}</h2>
                </div>
                <button type="button" className="trace-drawer-close" ref={traceCloseRef} onClick={() => setShowTrace(false)}>
                  ✕ Close
                </button>
              </div>

              {liveTrace?.run && (
                <div className="trace-run-meta" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <article>
                    <h2>Status</h2>
                    <p>{liveTrace.run.status || '—'}</p>
                  </article>
                  <article>
                    <h2>Steps</h2>
                    <p>{liveTrace.steps?.length ?? 0} total</p>
                  </article>
                  <article>
                    <h2>Confidence</h2>
                    <p>{liveTrace.run.final_confidence != null ? Number(liveTrace.run.final_confidence).toFixed(2) : '—'}</p>
                  </article>
                </div>
              )}

              <AgentTimeline steps={liveTrace?.steps ?? []} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default App
