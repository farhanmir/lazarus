import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FlaskConical, ArrowRight } from 'lucide-react'

export default function SwitchUIsPill() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.5 }}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
      }}
    >
      <Link
        to="/lab"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px 8px 12px',
          borderRadius: 999,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(240,238,232,0.95))',
          color: '#1a1a1a',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1) inset',
          backdropFilter: 'blur(12px)',
        }}
      >
        <FlaskConical size={14} strokeWidth={2} />
        <span>Switch UIs</span>
        <ArrowRight size={12} strokeWidth={2.5} />
      </Link>
    </motion.div>
  )
}
