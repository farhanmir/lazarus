import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import HeroScene from '../three/HeroScene'
import { useScrollReveal, useRevealChildren } from '../hooks/useScrollReveal'

const AGENTS = [
  {
    code: 'Sc',
    num: '01',
    name: 'Scout',
    desc: 'Ingests failed clinical trial corpora and indexes asset metadata, endpoints, and safety signals.',
  },
  {
    code: 'Cr',
    num: '02',
    name: 'Coroner',
    desc: 'K2 Think reasoning trace — dissects why the trial failed in 10 precise biological steps.',
  },
  {
    code: 'De',
    num: '03',
    name: 'Defibrillator',
    desc: 'Gemini 2M-window pass over 500-page FDA briefings to surface latent sub-populations.',
  },
  {
    code: 'Sk',
    num: '04',
    name: 'Skeptic',
    desc: 'Adversarial review — pressure-tests the hypothesis against confounds and bias.',
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
    body: 'Select a shelved compound. Scout assembles mechanism, indication, and failure context.',
  },
  {
    num: '02',
    title: 'Causal dissection',
    body: 'Coroner constructs a 10-step biological thinking trace on a PMID-cited graph.',
  },
  {
    num: '03',
    title: 'Sub-population lift',
    body: 'Defibrillator sweeps regulatory narrative to find the cohort where the drug works.',
  },
  {
    num: '04',
    title: 'Skeptical audit',
    body: 'Skeptic contests every assumption. Only hypotheses with risk-adjusted support survive.',
  },
  {
    num: '05',
    title: 'Blueprint',
    body: 'Strategist drafts the repurposing plan and dispatches it to the executive via iMessage.',
  },
]

function SplitHeading({ text, delayStart = 0 }) {
  const chars = text.split('')
  const ref = useScrollReveal()
  return (
    <h1
      className="lab-hero-title"
      ref={ref}
      onTransitionEnd={() => {}}
    >
      {chars.map((c, i) => (
        <span
          key={i}
          className="lab-char"
          style={{ transitionDelay: `${delayStart + i * 22}ms` }}
        >
          {c === ' ' ? '\u00A0' : c}
        </span>
      ))}
    </h1>
  )
}

function CharReveal({ el = 'h2', className, text, stagger = 20 }) {
  const Tag = el
  const ref = useScrollReveal()
  const chars = text.split('')
  return (
    <Tag className={className} ref={ref}>
      {chars.map((c, i) => (
        <span key={i} className="lab-char" style={{ transitionDelay: `${i * stagger}ms` }}>
          {c === ' ' ? '\u00A0' : c}
        </span>
      ))}
    </Tag>
  )
}

export default function LabLanding() {
  const agentsRef = useRevealChildren({ stagger: 70 })
  const pipelineRef = useRevealChildren({ stagger: 80 })
  const ledeRef = useScrollReveal()
  const ctaRef = useScrollReveal()

  // Make hero chars animate on mount
  React.useEffect(() => {
    const chars = document.querySelectorAll('.lab-hero-title .lab-char')
    requestAnimationFrame(() => {
      chars.forEach((c) => c.classList.add('is-visible'))
    })
  }, [])

  return (
    <>
      {/* ═══ HERO ═══ */}
      <section className="lab-hero">
        <div className="lab-hero-canvas">
          <HeroScene />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          style={{ position: 'relative', maxWidth: 1400 }}
        >
          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="lab-eyebrow"
            style={{ display: 'inline-block', marginBottom: 28 }}
          >
            Autonomous R&amp;D · Clinical Resurrection
          </motion.span>

          <SplitHeading text="We resurrect" />
          <SplitHeading text="failed trials." delayStart={600} />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.6 }}
            className="lab-hero-sub"
          >
            Lazarus is an autonomous swarm that dissects shelved clinical assets,
            re-identifies sub-populations where the drug actually works, and delivers
            a signature-ready blueprint to the executive inbox.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2 }}
            style={{ marginTop: 38, display: 'flex', gap: 14, flexWrap: 'wrap' }}
          >
            <Link to="/lab/analyze" className="lab-cta">
              Begin analysis
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
            <a href="#method" className="lab-cta lab-cta-ghost">The method</a>
          </motion.div>
        </motion.div>

        <div className="lab-hero-meta">
          <div className="lab-hero-meta-group">
            <span>Rev · 04.18</span>
            <span>Ops · Online</span>
          </div>
          <div className="lab-hero-meta-group" style={{ alignItems: 'flex-end' }}>
            <span>Scroll</span>
            <span>↓</span>
          </div>
        </div>
      </section>

      {/* ═══ LEDE ═══ */}
      <section className="lab-section" id="method">
        <div className="lab-section-head" ref={ledeRef}>
          <span className="lab-eyebrow lab-reveal">The thesis</span>
          <div style={{ marginTop: 20 }}>
            <CharReveal
              el="h2"
              className="lab-section-title"
              text="Over 90% of compounds fail in Phase II."
              stagger={14}
            />
          </div>
          <p className="lab-section-lede lab-reveal">
            Most are shelved forever. The data suggests otherwise —
            inside every failed readout hides a responder cohort
            the original protocol never isolated. Lazarus finds it.
          </p>
        </div>
      </section>

      {/* ═══ AGENTS ═══ */}
      <section className="lab-section lab-section-alt">
        <div className="lab-section-head">
          <span className="lab-eyebrow">The swarm</span>
          <CharReveal
            el="h2"
            className="lab-section-title"
            text="Five agents. One verdict."
            stagger={16}
          />
        </div>
        <div className="lab-agent-grid" ref={agentsRef}>
          {AGENTS.map((a) => (
            <div key={a.code} className="lab-agent-card lab-reveal" data-reveal>
              <div className="lab-agent-num">{a.num} / 05</div>
              <div className="lab-agent-code">{a.code}</div>
              <div className="lab-agent-name">{a.name}</div>
              <p className="lab-agent-desc">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PIPELINE ═══ */}
      <section className="lab-section">
        <div className="lab-section-head">
          <span className="lab-eyebrow">The protocol</span>
          <CharReveal
            el="h2"
            className="lab-section-title"
            text="Shelved compound to signed blueprint in under a minute."
            stagger={10}
          />
        </div>
        <div className="lab-pipeline" ref={pipelineRef}>
          {STEPS.map((s) => (
            <div key={s.num} className="lab-pipe-step lab-reveal" data-reveal>
              <div className="lab-pipe-step-num">{s.num}</div>
              <div className="lab-pipe-step-title">{s.title}</div>
              <div className="lab-pipe-step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="lab-section lab-section-alt" style={{ paddingTop: 180, paddingBottom: 180 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }} ref={ctaRef}>
          <span className="lab-eyebrow lab-reveal">Begin</span>
          <div style={{ marginTop: 28 }}>
            <CharReveal
              el="h2"
              className="lab-section-title"
              text="Select an asset. Watch the swarm work."
              stagger={14}
            />
          </div>
          <div className="lab-reveal" style={{ marginTop: 46 }}>
            <Link to="/lab/analyze" className="lab-cta">
              Open analysis console
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

      <footer style={{ padding: '40px 42px', borderTop: '1px solid rgba(20,23,26,0.08)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6d7278', display: 'flex', justifyContent: 'space-between' }}>
        <span>Lazarus / HackPrinceton 2026</span>
        <span>R&amp;D Sovereign · v0.1</span>
      </footer>
    </>
  )
}
