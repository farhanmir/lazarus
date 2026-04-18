import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Landing from './pages/Landing'
import LabLayout from './lab/LabLayout'
import LabLanding from './lab/pages/LabLanding'
import LabAnalyze from './lab/pages/LabAnalyze'
import LabRun from './lab/pages/LabRun'
import './styles.css'
import './lab/lab.css'

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<App />} />
        <Route path="/lab" element={<LabLayout />}>
          <Route index element={<LabLanding />} />
          <Route path="analyze" element={<LabAnalyze />} />
          <Route path="run/:runId" element={<LabRun />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
