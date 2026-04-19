import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { runMultiDiseaseScan, fetchKnownDiseases, searchDrugs, fetchDrugContext, importDrugAsAsset } from '../services/api'

const riskColor = {
  low: '#2e5a47',
  medium: '#c9a24b',
  high: '#9b3d3d',
  unknown: '#8e9fa8',
}

const riskBg = {
  low: 'rgba(46,90,71,0.12)',
  medium: 'rgba(201,162,75,0.12)',
  high: 'rgba(155,61,61,0.12)',
  unknown: 'rgba(142,159,168,0.12)',
}

export default function MultiDiseaseScanPanel({ assets: initialAssets }) {
  const [localAssets, setLocalAssets] = useState(initialAssets || [])
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [knownDiseases, setKnownDiseases] = useState([])
  const [selectedDiseases, setSelectedDiseases] = useState([])
  const [customDisease, setCustomDisease] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [error, setError] = useState('')

  // Drug search state
  const [drugQuery, setDrugQuery] = useState('')
  const [drugResults, setDrugResults] = useState([])
  const [drugSearching, setDrugSearching] = useState(false)
  const [showDrugResults, setShowDrugResults] = useState(false)
  const [contextPreview, setContextPreview] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)
  const searchTimeout = useRef(null)

  useEffect(() => { setLocalAssets(initialAssets || []) }, [initialAssets])

  useEffect(() => {
    fetchKnownDiseases()
      .then(setKnownDiseases)
      .catch(() => {})
  }, [])

  // Debounced drug search
  const handleDrugSearch = (q) => {
    setDrugQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (q.length < 2) { setDrugResults([]); setShowDrugResults(false); return }
    searchTimeout.current = setTimeout(async () => {
      setDrugSearching(true)
      try {
        const results = await searchDrugs(q)
        setDrugResults(results)
        setShowDrugResults(true)
      } catch { setDrugResults([]) }
      finally { setDrugSearching(false) }
    }, 350)
  }

  // When a drug from OpenTargets is selected, import it and preview its context
  const selectSearchedDrug = async (drug) => {
    setDrugQuery(drug.name)
    setShowDrugResults(false)
    setContextLoading(true)
    setContextPreview(null)
    try {
      // Import as asset so it can be used with multi-disease scan
      const importResult = await importDrugAsAsset(drug)
      if (importResult.asset) {
        const imported = importResult.asset
        setLocalAssets((prev) => {
          if (prev.some((a) => a.id === imported.id)) return prev
          return [...prev, imported]
        })
        setSelectedAssetId(imported.id)
      }

      const ctx = await fetchDrugContext(drug.name)
      setContextPreview({ drug, context: ctx.context })
      // Auto-populate linked diseases into the disease selector
      if (ctx.context?.linked_diseases) {
        setKnownDiseases((prev) => {
          const combined = new Set([...prev, ...ctx.context.linked_diseases])
          return [...combined].sort()
        })
      }
    } catch { /* ignore */ }
    finally { setContextLoading(false) }
  }

  const toggleDisease = (d) => {
    setSelectedDiseases((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    )
  }

  const addCustomDisease = () => {
    const d = customDisease.trim()
    if (d && !selectedDiseases.includes(d)) {
      setSelectedDiseases((prev) => [...prev, d])
      setCustomDisease('')
    }
  }

  const handleScan = useCallback(async () => {
    if (!selectedAssetId) return
    setScanning(true)
    setError('')
    setScanResult(null)
    try {
      const result = await runMultiDiseaseScan(selectedAssetId, selectedDiseases)
      setScanResult(result)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [selectedAssetId, selectedDiseases])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: scanning ? '#c9a24b' : '#2e5a47',
          boxShadow: scanning ? '0 0 8px #c9a24b' : 'none',
        }} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '0.04em' }}>
          Multi-Disease Scan
        </h2>
      </div>

      {/* Drug Search (Real-time OpenTargets) */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 16, position: 'relative',
      }}>
        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 6, display: 'block' }}>
          Search Any Drug (Real-time API)
        </label>
        <input
          value={drugQuery}
          onChange={(e) => handleDrugSearch(e.target.value)}
          onFocus={() => drugResults.length > 0 && setShowDrugResults(true)}
          placeholder="Search OpenTargets — e.g. imatinib, aspirin, metformin..."
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'inherit', fontSize: 14, boxSizing: 'border-box',
          }}
        />
        {drugSearching && (
          <div style={{ position: 'absolute', right: 28, top: 40, fontSize: 11, opacity: 0.5 }}>searching...</div>
        )}

        {/* Dropdown results */}
        <AnimatePresence>
          {showDrugResults && drugResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', left: 16, right: 16, top: 68, zIndex: 50,
                background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {drugResults.map((drug) => (
                <div
                  key={drug.chembl_id}
                  onClick={() => selectSearchedDrug(drug)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{drug.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                      {drug.chembl_id} · {drug.drug_type} · Phase {drug.max_phase}
                      {drug.is_approved && ' · ✓ Approved'}
                      {drug.has_been_withdrawn && ' · ⚠ Withdrawn'}
                    </div>
                  </div>
                  {drug.description && (
                    <div style={{ fontSize: 11, opacity: 0.4, maxWidth: 200, textAlign: 'right' }}>
                      {drug.description.slice(0, 80)}...
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context preview */}
        {contextLoading && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.5 }}>Loading real-time context...</div>
        )}
        {contextPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: 12, padding: 12, borderRadius: 8,
              background: 'rgba(46,90,71,0.1)', border: '1px solid rgba(46,90,71,0.2)',
            }}
          >
            <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>
              Real-time Context Preview — {contextPreview.drug.name}
            </div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><strong>Target:</strong> {contextPreview.context.target}</div>
              <div><strong>Linked diseases:</strong> {contextPreview.context.linked_diseases?.join(', ') || 'none'}</div>
              <div><strong>Adverse events:</strong> {contextPreview.context.adverse_events?.join(', ') || 'none'}</div>
              <div><strong>Evidence refs:</strong> {contextPreview.context.evidence_refs?.length || 0} sources
                {contextPreview.context.evidence_refs?.map((ref, i) => (
                  <div key={i} style={{ fontSize: 11, opacity: 0.6, marginLeft: 12, marginTop: 2 }}>
                    [{ref.evidence_type}] {ref.source_ref} — {ref.title?.slice(0, 80)}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Drug Selector (seeded assets) */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 16,
      }}>
        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 6, display: 'block' }}>
          Select Drug
        </label>
        <select
          value={selectedAssetId}
          onChange={(e) => { setSelectedAssetId(e.target.value); setScanResult(null) }}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'inherit', fontSize: 14,
          }}
        >
          <option value="">— choose a drug —</option>
          {(localAssets || []).map((a) => (
            <option key={a.id} value={a.id}>{a.asset_code} — {a.internal_name} ({a.original_indication})</option>
          ))}
        </select>
      </div>

      {/* Disease Selector */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 16,
      }}>
        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 8, display: 'block' }}>
          Target Diseases (optional — leave empty to auto-detect)
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {knownDiseases.map((d) => (
            <button
              key={d}
              onClick={() => toggleDisease(d)}
              style={{
                padding: '4px 12px', borderRadius: 16, fontSize: 12,
                border: selectedDiseases.includes(d) ? '1px solid #2e5a47' : '1px solid rgba(255,255,255,0.12)',
                background: selectedDiseases.includes(d) ? 'rgba(46,90,71,0.2)' : 'rgba(255,255,255,0.04)',
                color: 'inherit', cursor: 'pointer',
              }}
            >
              {d}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={customDisease}
            onChange={(e) => setCustomDisease(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomDisease()}
            placeholder="Add custom disease..."
            style={{
              flex: 1, padding: '6px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'inherit', fontSize: 13,
            }}
          />
          <button
            onClick={addCustomDisease}
            style={{
              padding: '6px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'inherit', cursor: 'pointer', fontSize: 13,
            }}
          >
            Add
          </button>
        </div>
        {selectedDiseases.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Testing: {selectedDiseases.join(', ')}
          </div>
        )}
      </div>

      {/* Scan Button */}
      <button
        onClick={handleScan}
        disabled={!selectedAssetId || scanning}
        style={{
          padding: '12px 24px', borderRadius: 10,
          background: scanning ? 'rgba(201,162,75,0.2)' : 'rgba(46,90,71,0.25)',
          border: `1px solid ${scanning ? '#c9a24b' : '#2e5a47'}`,
          color: 'inherit', cursor: scanning ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
        }}
      >
        {scanning ? 'Scanning diseases...' : 'Run Multi-Disease Scan'}
      </button>

      {error && (
        <div style={{ color: '#9b3d3d', fontSize: 13, padding: 8 }}>{error}</div>
      )}

      {/* Results */}
      <AnimatePresence>
        {scanResult && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              {scanResult.drug_name} ({scanResult.asset_code}) — {scanResult.total_diseases_tested} diseases tested, {scanResult.results.length} results ranked by confidence
            </div>

            {scanResult.results.map((r, i) => (
              <motion.div
                key={r.hypothesis_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                style={{
                  background: riskBg[r.risk_level.toLowerCase()] || riskBg.unknown,
                  border: `1px solid ${riskColor[r.risk_level.toLowerCase()] || riskColor.unknown}33`,
                  borderRadius: 12, padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 18, fontWeight: 700,
                      color: riskColor[r.risk_level.toLowerCase()] || riskColor.unknown,
                    }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>
                      {r.target_disease}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 11,
                      fontWeight: 600, textTransform: 'uppercase',
                      background: riskColor[r.risk_level.toLowerCase()] || riskColor.unknown,
                      color: '#fff',
                    }}>
                      {r.risk_level}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>
                      {(r.final_confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                  {r.summary}
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 12, opacity: 0.6 }}>
                  <span>Decision: {r.final_decision}</span>
                  {r.recommended_action && <span>Action: {r.recommended_action}</span>}
                  {r.priority_level && <span>Priority: {r.priority_level}</span>}
                  {r.effort_score != null && <span>Effort: {r.effort_score.toFixed(2)}</span>}
                  {r.impact_score != null && <span>Impact: {r.impact_score.toFixed(2)}</span>}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
