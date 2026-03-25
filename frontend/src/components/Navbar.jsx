import './Navbar.css';

function Navbar({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <span className="brand-text">RIDDIM</span>

        <div className="navbar-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
