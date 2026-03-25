import { useState } from 'react';
import Navbar from './components/Navbar';
import DiscoverPage from './pages/DiscoverPage';
import GeneratePage from './pages/GeneratePage';
import ProfilePage from './pages/ProfilePage';
import SavedPage from './pages/SavedPage';
import RippleGrid from './components/RippleGrid';
import './App.css';

const TABS = [
  { id: 'discover', label: 'Discover' },
  { id: 'generate', label: 'Generate' },
  { id: 'profile', label: 'Profile' },
  { id: 'saved', label: 'Saved' },
];

function App() {
  const [activeTab, setActiveTab] = useState('discover');

  const renderPage = () => {
    switch (activeTab) {
      case 'discover':
        return <DiscoverPage />;
      case 'generate':
        return <GeneratePage />;
      case 'profile':
        return <ProfilePage />;
      case 'saved':
        return <SavedPage />;
      default:
        return <DiscoverPage />;
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
        <RippleGrid
          enableRainbow={false}
          gridColor="#00d4ff"
          rippleIntensity={0.015}
          gridSize={15.0}
          gridThickness={15.0}
          fadeDistance={1.2}
          mouseInteraction={true}
          mouseInteractionRadius={1.2}
          opacity={0.4}
        />
      </div>
      <Navbar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="page">
        <div className="container">
          {renderPage()}
        </div>
      </main>
    </>
  );
}

export default App;
