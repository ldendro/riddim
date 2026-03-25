import './PlaceholderPage.css';

function SavedPage() {
  return (
    <div className="placeholder-page animate-fade-in">
      <div className="page-header">
        <h1><span className="text-gradient">Saved</span></h1>
        <p>Your curated collection of favorite tracks</p>
      </div>
      <div className="empty-state glass-card">
        <div className="icon">💾</div>
        <h3>No Saved Tracks Yet</h3>
        <p>
          Tracks you love will appear here. Start discovering music
          and save your favorites!
        </p>
      </div>
    </div>
  );
}

export default SavedPage;
