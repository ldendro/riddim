import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DJProvider } from './context/DJContext';
import Navbar from './components/Navbar';
import DJByte from './components/DJByte';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DiscoverPage from './pages/DiscoverPage';
import GeneratePage from './pages/GeneratePage';
import TastePage from './pages/TastePage';
import ProfilePage from './pages/ProfilePage';
import RippleGrid from './components/RippleGrid';
import './App.css';

const TABS = [
  { id: 'discover', label: 'Discover' },
  { id: 'generate', label: 'Generate' },
  { id: 'taste', label: 'Taste' },
  { id: 'profile', label: 'Profile' },
];

function DropFlash() {
  const flashRef = useRef(null);

  useEffect(() => {
    const handleDrop = (e) => {
      const el = flashRef.current;
      if (!el) return;
      const intensity = e.detail?.intensity || 1;
      // Pink/Magenta festival flash to match UI
      const hue = Math.random() > 0.5 ? 320 : 290;
      el.style.background = `radial-gradient(ellipse at 50% 50%, hsla(${hue}, 100%, 60%, ${0.25 * intensity}) 0%, transparent 70%)`;
      el.style.opacity = '1';
      el.style.transform = `scale(${1 + intensity * 0.03})`;

      // Fade out
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity = '0';
          el.style.transform = 'scale(1)';
        });
      });
    };

    window.addEventListener('riddim-drop', handleDrop);
    return () => window.removeEventListener('riddim-drop', handleDrop);
  }, []);

  return (
    <div
      ref={flashRef}
      className="drop-flash"
      style={{ opacity: 0 }}
    />
  );
}

function AppContent() {
  const { isAuthenticated, isOnboarded, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState('discover');

  // Show nothing while checking auth
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div className="loading-pulse" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-primary)' }} />
      </div>
    );
  }

  // Gate: Not logged in → Login page
  if (!isAuthenticated) {
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
            opacity={0.3}
          />
        </div>
        <LoginPage />
      </>
    );
  }

  // Gate: Logged in but not onboarded → Onboarding
  if (!isOnboarded) {
    return (
      <>
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
          <RippleGrid
            enableRainbow={false}
            gridColor="#b44dff"
            rippleIntensity={0.02}
            gridSize={15.0}
            gridThickness={15.0}
            fadeDistance={1.2}
            mouseInteraction={true}
            mouseInteractionRadius={1.2}
            opacity={0.3}
          />
        </div>
        <OnboardingPage />
      </>
    );
  }

  // Main app — authenticated + onboarded
  const renderPage = () => {
    switch (activeTab) {
      case 'discover':
        return <DiscoverPage />;
      case 'generate':
        return <GeneratePage />;
      case 'taste':
        return <TastePage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <DiscoverPage />;
    }
  };

  return (
    <DJProvider>
      {/* Ambient gradient layer — sits behind the RippleGrid for depth */}
      <div className="app-ambient" />

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

      {/* Festival drop flash — full-screen burst on beat drops */}
      <DropFlash />

      {/* DJ Byte — persistent robot DJ overlay */}
      <DJByte activeTab={activeTab} />

      <Navbar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} user={user} />
      <main className="page">
        <div className="container">
          {renderPage()}
        </div>
      </main>
    </DJProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
