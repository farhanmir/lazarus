import React, { memo } from 'react'
import GraphPanel from './GraphPanel'
import GraphLegend from './GraphLegend'

function InteractiveGraph({ graphData, selectedNode, setSelectedNode, steps, runStatus, legendItems }) {
  return (
    <div className="grid gap-4">
      <GraphPanel
        graphData={graphData}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        steps={steps}
        runStatus={runStatus}
      />
      <GraphLegend items={[...legendItems, { type: 'Strategy', description: 'Recommended execution path' }]} />
    </div>
  )
}

export default memo(InteractiveGraph)
