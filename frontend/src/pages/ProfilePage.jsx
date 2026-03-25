import './PlaceholderPage.css';

function ProfilePage() {
  return (
    <div className="placeholder-page animate-fade-in">
      <div className="page-header">
        <h1><span className="text-gradient">Profile</span></h1>
        <p>Your taste model visualization and preferences</p>
      </div>
      <div className="empty-state glass-card">
        <div className="icon">📊</div>
        <h3>Coming in Phase 4</h3>
        <p>
          Interactive taste map, genre radar, and feature charts
          will be added in <strong>phase-4/taste-viz</strong>.
        </p>
        <div className="phase-features">
          <div className="phase-feature">
            <span className="feature-icon">🗺️</span>
            <span>UMAP taste map</span>
          </div>
          <div className="phase-feature">
            <span className="feature-icon">📈</span>
            <span>Feature bar charts</span>
          </div>
          <div className="phase-feature">
            <span className="feature-icon">🎯</span>
            <span>Genre radar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
