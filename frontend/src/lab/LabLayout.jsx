import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function LabLayout() {
  const { pathname } = useLocation()
  const isRun = pathname.includes('/lab/run/')

  return (
    <div className="lab-root">
      {!isRun && (
        <motion.nav
          className="lab-nav"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link to="/lab" className="lab-nav-brand">
            <span className="lab-nav-brand-mark" />
            <span>Lazarus</span>
            <span className="lab-mono" style={{ fontSize: 10, color: '#6d7278', letterSpacing: '0.2em', marginLeft: 10 }}>
              LAB / R&amp;D
            </span>
          </Link>
          <div className="lab-nav-links">
            <Link to="/lab">Overview</Link>
            <Link to="/lab/analyze">Analyze</Link>
            <Link to="/">Classic UI</Link>
          </div>
        </motion.nav>
      )}
      <Outlet />
    </div>
  )
}
