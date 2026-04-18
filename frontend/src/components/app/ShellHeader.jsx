import PropTypes from 'prop-types'

function ShellHeader({
  query,
  setQuery,
  selectedAssetId,
  setSelectedAssetId,
  filteredAssets,
  handleRunAnalysis,
  analysisLoading,
  handleGenerateBlueprint,
  analysisResult,
  blueprintLoading,
  setShowResetConfirm,
}) {
  return (
    <header className="nexus-header">
      <div className="header-left">
        <div className="system-status">
          <span className="status-blink" />
          <span className="system-status-label">Online</span>
        </div>
        <div className="hud-services">
          {['Postgres', 'Neo4j', 'Dedalus', 'K2 Think', 'Spectrum'].map((service) => (
            <span key={service} className="hud-service">
              {service}
            </span>
          ))}
        </div>
      </div>

      <div className="header-right">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search compounds…"
          className="header-search-input"
        />

        <select value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} className="term-select">
          <option value="">— SELECT ASSET —</option>
          {filteredAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.asset_code} · {asset.internal_name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={!selectedAssetId || analysisLoading}
          className={`term-btn term-btn-execute${analysisLoading ? ' running' : ''}`}
        >
          {analysisLoading ? 'Running…' : 'Run Analysis'}
        </button>

        <button
          type="button"
          onClick={handleGenerateBlueprint}
          disabled={!analysisResult?.hypothesis?.id || blueprintLoading}
          className="term-btn"
        >
          {blueprintLoading ? 'Generating…' : 'Blueprint'}
        </button>

        <button type="button" onClick={() => setShowResetConfirm(true)} className="term-btn term-btn-ghost">
          Reset
        </button>

        {analysisResult?.run && (
          <div className="run-id-chip">
            <span className="run-id-dot">●</span>
            <span>{analysisResult.run.id?.slice(0, 8)}</span>
          </div>
        )}
      </div>
    </header>
  )
}

ShellHeader.propTypes = {
  query: PropTypes.string.isRequired,
  setQuery: PropTypes.func.isRequired,
  selectedAssetId: PropTypes.string.isRequired,
  setSelectedAssetId: PropTypes.func.isRequired,
  filteredAssets: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      asset_code: PropTypes.string,
      internal_name: PropTypes.string,
    })
  ).isRequired,
  handleRunAnalysis: PropTypes.func.isRequired,
  analysisLoading: PropTypes.bool.isRequired,
  handleGenerateBlueprint: PropTypes.func.isRequired,
  analysisResult: PropTypes.shape({
    hypothesis: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
    run: PropTypes.shape({
      id: PropTypes.string,
    }),
  }),
  blueprintLoading: PropTypes.bool.isRequired,
  setShowResetConfirm: PropTypes.func.isRequired,
}

export default ShellHeader
