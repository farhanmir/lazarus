import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
})

export const fetchAssets = async () => {
  const { data } = await api.get('/assets')
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
  const wsUrl = api.defaults.baseURL.replace('http://', 'ws://').replace('https://', 'wss://')
  let socket
  let intervalId = null
  let closed = false
  let usingPolling = false

  const stopPolling = () => {
    if (intervalId) {
      window.clearInterval(intervalId)
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
    intervalId = window.setInterval(pollOnce, 900)
  }

  try {
    socket = new WebSocket(`${wsUrl}/runs/${runId}/stream`)

    const fallbackTimer = window.setTimeout(() => {
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
      window.clearTimeout(fallbackTimer)
    }

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      onMessage?.(payload)
    }

    socket.onerror = (event) => {
      window.clearTimeout(fallbackTimer)
      if (!usingPolling) {
        startPolling()
        return
      }
      onError?.(event)
    }

    socket.onclose = (event) => {
      window.clearTimeout(fallbackTimer)
      if (!usingPolling && !closed) {
        startPolling()
        return
      }
      onClose?.(event)
    }
  } catch (error) {
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

export const getBlueprintDownloadUrl = (blueprintId) =>
  `${api.defaults.baseURL}/blueprints/${blueprintId}/download`

export default api
