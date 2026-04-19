import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import HeroScene from '../components/three/HeroScene'
import './landing.css'

const AGENTS = [
  {
    code: 'Sc',
    num: '01',
    name: 'Scout',
    desc: 'Ingests failed clinical trial corpora. Indexes asset metadata, endpoints, and safety signals.',
  },
  {
    code: 'Cr',
    num: '02',
    name: 'Coroner',
    desc: 'K2 Think reasoning trace — dissects why the trial failed across 10 precise biological steps.',
  },
  {
    code: 'Df',
    num: '03',
    name: 'Defibrillator',
    desc: 'Gemini 2M-window pass over 500-page FDA briefings to surface latent sub-populations.',
  },
  {
    code: 'Sk',
    num: '04',
    name: 'Skeptic',
    desc: 'Adversarial review — pressure-tests every hypothesis against confounds and bias.',
  },
  {
    code: 'St',
    num: '05',
    name: 'Strategist',
    desc: 'Synthesizes a ready-to-sign Phase II blueprint with priority tier and capital estimate.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Asset triage',
    desc: 'Select a shelved compound. Scout assembles mechanism, indication, and failure context from clinical corpora.',
  },
  {
    num: '02',
    title: 'Causal dissection',
    desc: 'Coroner constructs a 10-step biological reasoning trace on a PMID-cited knowledge graph.',
  },
  {
    num: '03',
    title: 'Sub-population lift',
    desc: 'Defibrillator sweeps regulatory narrative to find the cohort where the drug actually works.',
  },
  {
    num: '04',
    title: 'Skeptical audit',
    desc: 'Skeptic contests every assumption. Only risk-adjusted hypotheses with evidence support survive.',
  },
  {
    num: '05',
    title: 'Blueprint delivery',
    desc: 'Strategist drafts the repurposing plan and dispatches it to the executive inbox via iMessage.',
  },
]

const STATS = [
  { value: '12,000+', label: 'Shelved compounds indexed' },
  { value: '5', label: 'Autonomous AI agents' },
  { value: '<60s', label: 'Compound to blueprint' },
]

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Landing() {
  return (
    <div className="landing-root">
      {/* ─── Nav ─── */}
      <motion.nav
        className="ln-nav"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="ln-nav-brand">
          <img src="/logo.png" alt="Lazarus" className="ln-nav-logo" />
          <span>Lazarus</span>
          <span className="ln-nav-sub">R&amp;D / Lab</span>
        </div>
        <div className="ln-nav-links">
          <button type="button" className="ln-nav-scroll" onClick={() => scrollTo('method')}>Method</button>
          <button type="button" className="ln-nav-scroll" onClick={() => scrollTo('agents')}>The Swarm</button>
          <Link to="/dashboard?tab=rescue" className="ln-nav-scroll">Rescue</Link>
          <Link to="/dashboard" className="ln-nav-cta">Dashboard</Link>
        </div>
      </motion.nav>

      {/* ─── Hero ─── */}
      <section className="ln-hero">
        <div className="ln-hero-left">
          <motion.span
            className="ln-eyebrow"
            variants={fade}
            initial="hidden"
            animate="show"
            custom={2}
          >
            Autonomous R&amp;D · Clinical Resurrection
          </motion.span>

          <motion.h1
            className="ln-headline"
            variants={fade}
            initial="hidden"
            animate="show"
            custom={3}
          >
            We resurrect<br />
            <em>failed trials.</em>
          </motion.h1>

          <motion.p
            className="ln-hero-lead"
            variants={fade}
            initial="hidden"
            animate="show"
            custom={5}
          >
            Lazarus is an autonomous swarm that dissects shelved clinical assets,
            re-identifies sub-populations where the drug actually works, and delivers
            a signature-ready blueprint to the executive inbox.
          </motion.p>

          <motion.div
            className="ln-actions"
            variants={fade}
            initial="hidden"
            animate="show"
            custom={7}
          >
            <Link to="/dashboard" className="ln-btn ln-btn-primary">
              Open Dashboard
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <button type="button" className="ln-btn ln-btn-outline" onClick={() => scrollTo('method')}>
              The Method
            </button>
          </motion.div>
        </div>

        <motion.div
          className="ln-hero-right"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.1 }}
        >
          <HeroScene />
        </motion.div>

        <div className="ln-hero-meta">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>HackPrinceton 2026</span>
            <span>System · Online</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span>Scroll</span>
            <span>↓</span>
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <div className="ln-stats">
        {STATS.map((s, i) => (
          <motion.div
            key={i}
            className="ln-stat"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="ln-stat-value">{s.value}</div>
            <div className="ln-stat-label">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* ─── Method ─── */}
      <section id="method" className="ln-method">
        <div className="ln-method-head">
          <span className="ln-eyebrow">The protocol</span>
          <h2 className="ln-section-title">
            Shelved compound<br />
            to signed blueprint.
          </h2>
        </div>

        <div className="ln-steps">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              className="ln-step"
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-24px' }}
              transition={{ duration: 0.48, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="ln-step-num">{s.num}</div>
              <div>
                <div className="ln-step-title">{s.title}</div>
                <div className="ln-step-desc">{s.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Agents ─── */}
      <section id="agents" className="ln-agents">
        <div className="ln-agents-head">
          <span className="ln-eyebrow">The swarm</span>
          <h2 className="ln-section-title">Five agents. One verdict.</h2>
        </div>

        <div className="ln-agent-grid">
          {AGENTS.map((a, i) => (
            <motion.div
              key={a.code}
              className="ln-agent-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-16px' }}
              transition={{ duration: 0.44, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="ln-agent-num">{a.num} / 05</div>
              <div className="ln-agent-code">{a.code}</div>
              <div className="ln-agent-name">{a.name}</div>
              <p className="ln-agent-desc">{a.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="ln-cta">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="ln-eyebrow">Begin</span>
          <h2 className="ln-cta-title">
            Select an asset.<br />
            Watch the swarm work.
          </h2>
          <Link to="/dashboard" className="ln-btn ln-btn-light">
            Open Analysis Dashboard
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="ln-footer">
        <span>Lazarus · HackPrinceton 2026</span>
        <span>R&amp;D Sovereign · v0.1</span>
      </footer>
    </div>
  )
}
