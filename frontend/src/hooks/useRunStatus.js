import { useMemo } from 'react'

const statusConfig = {
  idle: {
    label: 'Idle',
    description: 'Select an asset and launch a reasoning cycle.',
    tone: 'slate',
    progress: 0,
  },
  queued: {
    label: 'Queued',
    description: 'Preparing the multi-agent workflow.',
    tone: 'indigo',
    progress: 18,
  },
  running: {
    label: 'Running',
    description: 'Running multi-agent reasoning across the clinical asset graph.',
    tone: 'blue',
    progress: 58,
  },
  completed: {
    label: 'Completed',
    description: 'Run finished successfully and the reasoning trace is ready to inspect.',
    tone: 'green',
    progress: 100,
  },
  failed: {
    label: 'Failed',
    description: 'The run stopped before completion. Review the error banner and retry.',
    tone: 'red',
    progress: 100,
  },
}

export function useRunStatus(activeRun, { analysisLoading = false, errorMessage = '' } = {}) {
  return useMemo(() => {
    if (errorMessage) {
      return {
        ...statusConfig.failed,
        description: errorMessage,
      }
    }

    if (analysisLoading && !activeRun?.status) {
      return statusConfig.running
    }

    return statusConfig[activeRun?.status] ?? statusConfig.idle
  }, [activeRun?.status, analysisLoading, errorMessage])
}
