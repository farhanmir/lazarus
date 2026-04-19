import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import Landing from './pages/Landing'
import AgentTrace from './pages/AgentTrace'
import './styles.css'

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard?tab=rescue" replace />} />
        <Route path="/welcome" element={<Landing />} />
        <Route path="/dashboard" element={<App />} />
        <Route path="/agents/:runId" element={<AgentTrace />} />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
