import React, { useState, useEffect, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import './TasteMap.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function TasteMap({ mapType = 'intensity' }) {
  const { token } = useAuth();
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPoints();
  }, [mapType]);

  const fetchPoints = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/tastemap/points?map_type=${mapType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load taste map data');
      const data = await res.json();
      setPoints(data.points || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Separate points by type so they render in correct z-order (standard first, then reactions, then centroids)
  const mapData = useMemo(() => {
    const defaultPoints = [];
    const likedPoints = [];
    const dislikedPoints = [];
    const centroids = [];

    points.forEach(p => {
      // Scale points lightly to make them fit perfectly on the map
      const mapped = { ...p, index: 1 };
      
      if (p.type === 'centroid') {
        mapped.index = 3; // Render largest
        centroids.push(mapped);
      } else if (['love', 'like'].includes(p.reaction)) {
        mapped.index = 2; // Medium size
        likedPoints.push(mapped);
      } else if (['reject', 'skip'].includes(p.reaction)) {
        mapped.index = 2;
        dislikedPoints.push(mapped);
      } else {
        defaultPoints.push(mapped);
      }
    });

    return { defaultPoints, likedPoints, dislikedPoints, centroids };
  }, [points]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`tastemap-tooltip ${data.type === 'centroid' ? 'centroid-tooltip' : ''}`}>
          <p className="tastemap-tooltip-title">{data.title}</p>
          <p className="tastemap-tooltip-genre">{data.genre}</p>
          {data.reaction !== 'none' && data.type !== 'centroid' && (
            <p className={`tastemap-tooltip-reaction ${data.reaction}`}>
              {data.reaction.toUpperCase()}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="tastemap-container loading">
        <div className="loading-pulse"></div>
        <p>Projecting audio dimensions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tastemap-container error">
        <p>Failed to load visualizer: {error}</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="tastemap-container empty">
        <p>No tracks available to map. Please run the setup pipeline.</p>
      </div>
    );
  }

  // Find boundaries to keep chart square and fully fit
  const domain = [-110, 110];

  const getMapHeader = () => {
    if (mapType === 'intensity') return { title: 'Intensity Matrix', sub: 'Tempo vs Energy. Your physical interaction with the beat.' };
    if (mapType === 'texture') return { title: 'Sonic Texture', sub: 'Bass Depth vs Spectral Brightness. The raw harmonic properties of your taste.' };
    return { title: 'Taxonomy Constellations', sub: 'Genre Groupings. How your preferred styles naturally cluster.' };
  };

  const header = getMapHeader();

  return (
    <div className="tastemap-wrapper animate-fade-in">
      <div className="tastemap-header">
        <h3>{header.title}</h3>
        <p>{header.sub}</p>
        <div className="tastemap-legend">
          <span className="legend-item"><span className="dot liked"></span> Liked</span>
          <span className="legend-item"><span className="dot disliked"></span> Disliked</span>
          <span className="legend-item"><span className="dot unmapped"></span> Unexplored</span>
        </div>
      </div>
      
      <div className="tastemap-chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis 
              type="number" 
              dataKey="x" 
              name={mapType === 'intensity' ? 'BPM' : mapType === 'texture' ? 'Depth' : 'X'} 
              domain={[0, 100]} 
              hide={mapType === 'genre'}
              tickFormatter={(val) => 
                mapType === 'intensity' ? Math.round((val / 100 * 120) + 60) :
                mapType === 'texture' ? ['Light', 'Punchy', 'Deep'][Math.floor(val/34)] : ''
              } 
              stroke="rgba(255,255,255,0.2)" 
              label={mapType === 'genre' ? null : { 
                value: mapType === 'intensity' ? 'Tempo (BPM)' : 'Depth (Bass Energy)', 
                position: 'insideBottomRight', 
                offset: -10, 
                fill: 'var(--text-muted)' 
              }} 
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name={mapType === 'intensity' ? 'Energy' : mapType === 'texture' ? 'Brightness' : 'Y'} 
              domain={[0, 100]} 
              hide={mapType === 'genre'}
              tickFormatter={(val) => 
                mapType === 'intensity' ? ['Low', 'Med', 'High'][Math.floor(val/34)] :
                mapType === 'texture' ? ['Muffled', 'Warm', 'Sharp'][Math.floor(val/34)] : ''
              } 
              stroke="rgba(255,255,255,0.2)" 
              label={mapType === 'genre' ? null : { 
                value: mapType === 'intensity' ? 'Intensity' : 'Brightness', 
                angle: -90, 
                position: 'insideLeft', 
                fill: 'var(--text-muted)' 
              }} 
            />
            <ZAxis type="number" dataKey="index" range={[15, 600]} name="Size" />
            
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }} />
            
            {/* Unexplored tracks (background) */}
            <Scatter name="Unexplored" data={mapData.defaultPoints} fill="rgba(255, 255, 255, 0.15)" />
            
            {/* Disliked tracks (red) */}
            <Scatter name="Disliked" data={mapData.dislikedPoints} fill="rgba(255, 50, 50, 0.8)">
              {mapData.dislikedPoints.map((entry, index) => (
                <Cell key={`cell-disliked-${index}`} className="scatter-dot disliked" />
              ))}
            </Scatter>

            {/* Liked tracks (neon cyan/green) */}
            <Scatter name="Liked" data={mapData.likedPoints} fill="var(--neon-cyan)">
              {mapData.likedPoints.map((entry, index) => (
                <Cell key={`cell-liked-${index}`} className="scatter-dot liked" />
              ))}
            </Scatter>

            {/* Centroids (pulsing stars) */}
            <Scatter name="Centroids" data={mapData.centroids} fill="#ffffff">
              {mapData.centroids.map((entry, index) => (
                <Cell 
                  key={`cell-centroid-${index}`} 
                  className={`scatter-dot centroid ${entry.id.includes('liked') ? 'liked' : 'disliked'}`} 
                />
              ))}
            </Scatter>
            
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default TasteMap;
