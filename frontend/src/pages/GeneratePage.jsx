import './PlaceholderPage.css';

function GeneratePage() {
  return (
    <div className="placeholder-page animate-fade-in">
      <div className="page-header">
        <h1><span className="text-gradient">Generate</span></h1>
        <p>A/B compare AI-generated EDM drops</p>
      </div>
      <div className="empty-state glass-card">
        <div className="icon">🎛️</div>
        <h3>Coming in Phase 3</h3>
        <p>
          MusicGen candidate pool generation and A/B comparison interface
          will be added in <strong>phase-3/generate</strong>.
        </p>
        <div className="phase-features">
          <div className="phase-feature">
            <span className="feature-icon">🔊</span>
            <span>Dual waveform A/B player</span>
          </div>
          <div className="phase-feature">
            <span className="feature-icon">⚖️</span>
            <span>Preference selection</span>
          </div>
          <div className="phase-feature">
            <span className="feature-icon">🎚️</span>
            <span>Directional adjustments</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GeneratePage;
