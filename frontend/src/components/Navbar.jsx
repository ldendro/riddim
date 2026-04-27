import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar({ tabs, activeTab, onTabChange, user }) {
  const { logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

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

        {user && (
          <div className="navbar-user">
            <button
              className="user-avatar-btn"
              onClick={() => setShowDropdown(!showDropdown)}
              title={user.display_name}
            >
              {user.display_name?.[0]?.toUpperCase() || '?'}
            </button>
            {showDropdown && (
              <>
                <div className="dropdown-backdrop" onClick={() => setShowDropdown(false)} />
                <div className="user-dropdown glass-card">
                  <div className="dropdown-user-info">
                    <span className="dropdown-name">{user.display_name}</span>
                    <span className="dropdown-email">{user.email}</span>
                  </div>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => { onTabChange('profile'); setShowDropdown(false); }}>
                    Profile
                  </button>
                  <button className="dropdown-item dropdown-logout" onClick={logout}>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
