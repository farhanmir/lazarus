import axios from 'axios'

/**
 * In dev, default to same-origin (empty base) so Vite proxies to FastAPI (see vite.config.js).
 * Set VITE_API_BASE_URL when the UI is hosted separately from the API (e.g. production).
 */
export function getApiBase() {
  const explicit = import.meta.env.VITE_API_BASE_URL
  if (explicit != null && String(explicit).trim() !== '') {
    return String(explicit).trim().replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return ''
  }
  return 'http://127.0.0.1:8000'
}

function httpToWsBase(httpBase) {
  if (!httpBase) return 'ws://127.0.0.1:8000'
  if (httpBase.startsWith('https://')) return `wss://${httpBase.slice(8)}`
  if (httpBase.startsWith('http://')) return `ws://${httpBase.slice(7)}`
  return httpBase
}

const api = axios.create({
  baseURL: getApiBase(),
  /** Rescue pipeline can take a while (CT.gov + LLMs + PDF). */
  timeout: 180_000,
})

export const fetchAssets = async () => {
  const { data } = await api.get('/assets')
  return data
}

export const fetchCandidates = async (disease, limit = 5, config = {}) => {
  const { data } = await api.get('/api/candidates', {
    params: { disease, limit },
    ...config,
  })
  return data
}

export const runRescuePipeline = async ({ disease, recipient }) => {
  const body = { disease }
  if (recipient) body.recipient = recipient
  const { data } = await api.post('/api/rescue-pipeline', body, { timeout: 180_000 })
  return data
}

export const evaluateCandidate = async ({ drug, disease, assetCode }) => {
  const { data } = await api.post('/api/evaluate', {
    drug,
    disease,
    asset_code: assetCode || null,
  })
  return data
}

export const runAnalysis = async (assetId, runType = 'manual') => {
  const { data } = await api.post('/run-analysis', {
    asset_id: assetId,
    run_type: runType,
  })
  return data
}

export const startAnalysisJob = async (assetId, runType = 'manual') => {
  const { data } = await api.post('/run-analysis/async', {
    asset_id: assetId,
    run_type: runType,
  })
  return data
}

export const fetchGraph = async (assetId) => {
  const { data } = await api.get(`/graph/${assetId}`)
  return data
}

export const fetchRun = async (runId) => {
  const { data } = await api.get(`/runs/${runId}`)
  return data
}

export const fetchRunTrace = async (runId) => {
  const { data } = await api.get(`/runs/${runId}/trace`)
  return data
}

export const subscribeRunStream = (runId, { onMessage, onError, onClose } = {}) => {
  const httpBase =
    api.defaults.baseURL && api.defaults.baseURL.length > 0
      ? api.defaults.baseURL
      : typeof window !== 'undefined'
        ? window.location.origin
        : 'http://127.0.0.1:8000'
  const wsUrl = httpToWsBase(httpBase)
  let socket
  let intervalId = null
  let closed = false
  let usingPolling = false

  const stopPolling = () => {
    if (intervalId) {
      globalThis.clearInterval(intervalId)
      intervalId = null
    }
  }

  const pollOnce = async () => {
    try {
      const payload = await fetchRunTrace(runId)
      onMessage?.(payload)
      if (payload?.run?.status === 'completed' || payload?.run?.status === 'failed') {
        stopPolling()
        onClose?.({ reason: 'polling-complete' })
      }
    } catch (error) {
      stopPolling()
      onError?.(error)
    }
  }

  const startPolling = () => {
    if (usingPolling || closed) return
    usingPolling = true
    pollOnce()
    intervalId = globalThis.setInterval(pollOnce, 900)
  }

  try {
    socket = new WebSocket(`${wsUrl}/runs/${runId}/stream`)

    const fallbackTimer = globalThis.setTimeout(() => {
      if (!usingPolling && socket?.readyState !== WebSocket.OPEN) {
        try {
          socket?.close()
        } catch {
          // Ignore close failures before falling back to polling.
        }
        startPolling()
      }
    }, 1200)

    socket.onopen = () => {
      globalThis.clearTimeout(fallbackTimer)
    }

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      onMessage?.(payload)
    }

    socket.onerror = (event) => {
      globalThis.clearTimeout(fallbackTimer)
      if (!usingPolling) {
        startPolling()
        return
      }
      onError?.(event)
    }

    socket.onclose = (event) => {
      globalThis.clearTimeout(fallbackTimer)
      if (!usingPolling && !closed) {
        startPolling()
        return
      }
      onClose?.(event)
    }
  } catch {
    startPolling()
  }

  return {
    close() {
      closed = true
      stopPolling()
      try {
        socket?.close()
      } catch {
        // Ignore close errors during cleanup.
      }
    },
  }
}

export const generateBlueprint = async (hypothesisId) => {
  const { data } = await api.post('/generate-blueprint', {
    hypothesis_id: hypothesisId,
  })
  return data
}

export const startBlueprintJob = async (hypothesisId) => {
  const { data } = await api.post('/generate-blueprint/async', {
    hypothesis_id: hypothesisId,
  })
  return data
}

export const fetchBlueprintDetail = async (blueprintId) => {
  const { data } = await api.get(`/blueprints/${blueprintId}/detail`)
  return data
}

export const sendPhotonNotification = async ({ recipient, message }) => {
  const { data } = await api.post('/photon/notify', {
    recipient,
    message,
  })
  return data
}

export const getBlueprintDownloadUrl = (blueprintId) => {
  const base = api.defaults.baseURL
  if (base) return `${base}/blueprints/${blueprintId}/download`
  return `/blueprints/${blueprintId}/download`
}

export const emailBlueprint = async (blueprintId, recipientEmail) => {
  const { data } = await api.post(`/blueprints/${blueprintId}/email`, {
    recipient_email: recipientEmail,
  })
  return data
}

export const fetchEffortImpact = async (runId) => {
  const { data } = await api.get(`/runs/${runId}/effort-impact`)
  return data
}

export const fetchPortfolioRanking = async () => {
  const { data } = await api.get('/portfolio/ranking')
  return data
}

export const fetchEffort = async (runId) => {
  const { data } = await api.get(`/runs/${runId}/effort`)
  return data
}

export const fetchImpact = async (runId) => {
  const { data } = await api.get(`/runs/${runId}/impact`)
  return data
}

export const fetchConversation = async (runId) => {
  const { data } = await api.get(`/runs/${runId}/messages`)
  return data
}

export const fetchHumanReviewDashboard = async (statusFilter) => {
  const { data } = await api.get('/human-reviews/dashboard', {
    params: statusFilter ? { status_filter: statusFilter } : undefined,
  })
  return data
}

export const resolveHumanReview = async (reviewId, resolutionNotes) => {
  const { data } = await api.post(`/human-reviews/${reviewId}/resolve`, {
    resolution_notes: resolutionNotes,
  })
  return data
}

export const fetchHypothesisComparison = async (assetId) => {
  const { data } = await api.get(`/assets/${assetId}/hypotheses/compare`)
  return data
}

export const sendMessage = async (runId, question) => {
  const { data } = await api.post(`/runs/${runId}/messages`, {
    run_id: runId,
    question,
  })
  return data
}

// --- Multi-Disease Scan ---

export const runMultiDiseaseScan = async (assetId, targetDiseases = []) => {
  const { data } = await api.post('/scan/multi-disease', {
    asset_id: assetId,
    target_diseases: targetDiseases,
  })
  return data
}

export const fetchKnownDiseases = async () => {
  const { data } = await api.get('/scan/diseases')
  return data.diseases
}

export const searchDrugs = async (query) => {
  if (!query || query.length < 2) return []
  const { data } = await api.get('/scan/drugs', { params: { q: query } })
  return data.drugs
}

export const importDrugAsAsset = async (drug) => {
  const { data } = await api.post('/scan/import-drug', {
    chembl_id: drug.chembl_id,
    drug_name: drug.name,
    description: drug.description,
    drug_type: drug.drug_type,
    max_phase: drug.max_phase,
  })
  return data
}

export const fetchDrugContext = async (drugName, disease = '') => {
  const { data } = await api.get('/scan/drug-context', {
    params: { drug_name: drugName, disease },
  })
  return data
}

// --- Disease Watchlist ---

export const createWatchlist = async (diseaseQuery) => {
  const { data } = await api.post('/watchlist', {
    disease_query: diseaseQuery,
  })
  return data
}

export const fetchWatchlists = async () => {
  const { data } = await api.get('/watchlist')
  return data
}

export const fetchWatchlist = async (watchlistId) => {
  const { data } = await api.get(`/watchlist/${watchlistId}`)
  return data
}

export const fetchActiveAlerts = async () => {
  const { data } = await api.get('/alerts')
  return data
}

export const dismissAlert = async (alertId) => {
  const { data } = await api.post(`/alerts/${alertId}/dismiss`)
  return data
}

export default api
