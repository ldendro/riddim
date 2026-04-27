import React, { useState, useEffect, useRef } from 'react';
import TasteMap from '../components/TasteMap';
import { useAuth } from '../context/AuthContext';
import { useDJ } from '../context/DJContext';
import './TastePage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function TastePage() {
  const { token } = useAuth();
  const { triggerDJComment } = useDJ();
  const [mapType, setMapType] = useState('intensity'); // 'intensity', 'texture', or 'genre'
  const [analyzing, setAnalyzing] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Initial analysis welcoming user automatically with full summary
    if (token && !fetchedRef.current) {
      fetchedRef.current = true;
      handleTasteAnalysis('combo');
    }
  }, [token]);

  const handleTasteAnalysis = async (focusType) => {
    try {
      setAnalyzing(true);

      // Temporary "thinking" state message from DJ Byte
      triggerDJComment({
        direct: true,
        comment: "Generating Taste Analysis...",
        mood: 'curious',
        isGenerating: true,
        isTasteSummary: false // Hide buttons while thinking
      });

      const res = await fetch(`${API_BASE}/api/dj/taste-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ focus: focusType }),
      });

      const data = await res.json();
      if (data.commentary) {
        triggerDJComment({
          direct: true,
          comment: data.commentary,
          mood: 'hype',
          isTasteSummary: true,
          onRegenerate: () => handleTasteAnalysis('combo')
        });
      }
    } catch (err) {
      console.error("Failed to analyze taste:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="taste-page animate-fade-in">
      <div className="page-header">
        <h1><span className="text-gradient">Taste Laboratory</span></h1>
        <p>A multi-dimensional breakdown of your exact musical phenotype.</p>
      </div>

      <div className="taste-navigation">
        <button
          className={`taste-tab ${mapType === 'intensity' ? 'active' : ''}`}
          onClick={() => setMapType('intensity')}
        >
          Intensity (BPM/Energy)
        </button>
        <button
          className={`taste-tab ${mapType === 'texture' ? 'active' : ''}`}
          onClick={() => setMapType('texture')}
        >
          Texture (Bass/Bright)
        </button>
        <button
          className={`taste-tab ${mapType === 'genre' ? 'active' : ''}`}
          onClick={() => setMapType('genre')}
        >
          Taxonomy (Genres)
        </button>
      </div>

      <div className="taste-content">
        <div className="tastemap-block">
          <TasteMap mapType={mapType} />
        </div>
      </div>
    </div>
  );
}

export default TastePage;
