
import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import { QuizPoint } from '../types';
import { getDistance } from '../utils/geo';

interface GameMapProps {
  userLocation: { lat: number; lng: number } | null;
  lastActionLocation: { lat: number; lng: number } | null;
  points: QuizPoint[];
  currentIndex: number;
  onSimulateMove?: (lat: number, lng: number) => void;
  isWalkActive: boolean;
  unlockDistance: number;
}

const GameMap: React.FC<GameMapProps> = ({ userLocation, lastActionLocation, points, currentIndex, onSimulateMove, isWalkActive, unlockDistance }) => {
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const pointMarkersRef = useRef<L.LayerGroup | null>(null);
  const navigationPathRef = useRef<L.Polyline | null>(null);
  const lastAnsweredIdRef = useRef<number | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  // Visar säkerhetsvarning och instruktioner i 3 sekunder när promenaden startar eller nästa fråga aktiveras
  useEffect(() => {
    if (isWalkActive) {
      setShowOverlay(true);
      const timer = setTimeout(() => setShowOverlay(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isWalkActive, currentIndex]);

  // Beräkna riktning till den visuella målpunkten för kompassen
  const bearingToTarget = useMemo(() => {
    if (!userLocation || !points[currentIndex]) return 0;
    const lat1 = (userLocation.lat * Math.PI) / 180;
    const lon1 = (userLocation.lng * Math.PI) / 180;
    const lat2 = (points[currentIndex].lat * Math.PI) / 180;
    const lon2 = (points[currentIndex].lng * Math.PI) / 180;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const θ = Math.atan2(y, x);
    const brng = ((θ * 180) / Math.PI + 360) % 360;
    return brng;
  }, [userLocation, points, currentIndex]);

  // Beräkna hur långt användaren har rört sig från sin senaste startpunkt/svarade fråga
  const distanceMoved = useMemo(() => {
    if (!userLocation || !lastActionLocation) return 0;
    const dist = getDistance(
      userLocation.lat,
      userLocation.lng,
      lastActionLocation.lat,
      lastActionLocation.lng
    );
    return Math.round(dist);
  }, [userLocation, lastActionLocation]);

  const metersRemaining = useMemo(() => {
    return Math.max(0, unlockDistance - distanceMoved);
  }, [distanceMoved, unlockDistance]);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        touchZoom: true,
      }).setView([59.3293, 18.0686], 18);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(mapRef.current);

      pointMarkersRef.current = L.layerGroup().addTo(mapRef.current);

      mapRef.current.on('click', (e) => {
        if (onSimulateMove) {
          onSimulateMove(e.latlng.lat, e.latlng.lng);
        }
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (userLocation && mapRef.current) {
      if (!userMarkerRef.current) {
        const pulseIcon = L.divIcon({
          className: 'pulse-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { 
          icon: pulseIcon,
          zIndexOffset: 1000 
        }).addTo(mapRef.current);
      } else {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      }
      mapRef.current.panTo([userLocation.lat, userLocation.lng], { animate: true, duration: 1 });
      
      if (points[currentIndex] && isWalkActive) {
        if (navigationPathRef.current) {
          navigationPathRef.current.setLatLngs([
            [userLocation.lat, userLocation.lng],
            [points[currentIndex].lat, points[currentIndex].lng]
          ]);
        } else {
          navigationPathRef.current = L.polyline([
            [userLocation.lat, userLocation.lng],
            [points[currentIndex].lat, points[currentIndex].lng]
          ], {
            color: '#3B82F6',
            weight: 8,
            opacity: 0.8,
            dashArray: '1, 15',
            lineCap: 'round',
            className: 'nav-path-animated'
          }).addTo(mapRef.current);
        }
      } else {
        if (navigationPathRef.current) {
          navigationPathRef.current.remove();
          navigationPathRef.current = null;
        }
      }
    }
  }, [userLocation, points, currentIndex, isWalkActive]);

  useEffect(() => {
    if (mapRef.current && pointMarkersRef.current) {
      pointMarkersRef.current.clearLayers();
      
      points.forEach((point, idx) => {
        if (idx > currentIndex && !point.answered) return;

        const isCurrent = idx === currentIndex && !point.answered;
        const color = isCurrent ? '#3B82F6' : (point.isCorrect ? '#10B981' : '#EF4444');
        const opacity = isCurrent ? 1 : 0.8;
        
        if (isCurrent) {
            const auraIcon = L.divIcon({
                className: 'target-aura',
                iconSize: [60, 60],
                iconAnchor: [30, 30]
            });
            L.marker([point.lat, point.lng], { icon: auraIcon }).addTo(pointMarkersRef.current!);
        }

        const icon = L.divIcon({
          className: '',
          html: `
            <div class="relative">
                <div class="${isCurrent ? 'bobbing-marker' : ''}" 
                     style="background: ${color}; opacity: ${opacity}; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 8px 15px rgba(0,0,0,0.2); transition: background 0.5s ease;">
                    <span style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 14px;">
                        ${point.answered && point.isCorrect ? '✓' : point.id}
                    </span>
                </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

        L.marker([point.lat, point.lng], { icon }).addTo(pointMarkersRef.current!);
      });
    }
  }, [points, currentIndex]);

  return (
    <div id="map-wrapper" className="relative map-bg-animated">
        <div id="map" className="w-full h-full" />
        
        {/* Tillfällig instruktion och säkerhetsvarning som försvinner efter 3s */}
        {showOverlay && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-[50] pointer-events-none transition-all duration-500">
             <div className="bg-red-600/95 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border-4 border-white flex flex-col items-center text-center animate-in zoom-in duration-300">
                <span className="text-6xl mb-4">⚠️</span>
                <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Vandra Säkert!</h3>
                <p className="text-white font-bold leading-tight">
                  Gå 200 meter oavsett riktning för att låsa upp.<br/>
                  <span className="text-red-200">Gå aldrig över järnvägar eller farliga vägar!</span>
                </p>
             </div>
          </div>
        )}

        {/* Kompass: Visar riktning mot den automatiskt utvalda målpunkten */}
        {isWalkActive && metersRemaining > 0 && (
          <div className="absolute top-48 left-6 z-[45] compass-container pointer-events-none">
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-[1.5rem] shadow-2xl border-2 border-white flex flex-col items-center">
              <div 
                className="w-12 h-12 flex items-center justify-center transition-transform duration-500 ease-out"
                style={{ transform: `rotate(${bearingToTarget}deg)` }}
              >
                <div className="relative">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 text-blue-600 drop-shadow-md" fill="currentColor">
                    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                  </svg>
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center opacity-30 animate-pulse">👟</div>
                </div>
              </div>
              <span className="text-[9px] font-black text-blue-500 mt-2 uppercase tracking-widest leading-none">Målpunkt</span>
            </div>
          </div>
        )}

        {/* HUD: Visar kvarvarande avstånd (baserat på displacement från senaste punkt) */}
        {isWalkActive && (
          <div className="absolute bottom-28 right-6 z-[40] pointer-events-none">
            <div className="bg-white/95 backdrop-blur-md px-6 py-5 rounded-[2.5rem] shadow-2xl border-2 border-blue-50 flex items-center space-x-5 transition-all animate-in fade-in slide-in-from-right-10 duration-500 pointer-events-auto">
              <div className={`w-14 h-14 ${metersRemaining === 0 ? 'bg-green-500 animate-bounce' : 'bg-blue-600'} rounded-2xl flex items-center justify-center text-white shadow-lg transition-colors`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {metersRemaining === 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  )}
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                  {metersRemaining === 0 ? 'Dags att svara!' : 'Vandra kvar'}
                </span>
                <span className={`text-3xl font-black leading-none tabular-nums ${metersRemaining === 0 ? 'text-green-600' : 'text-blue-900'}`}>
                  {metersRemaining === 0 ? 'HITTAD!' : `${metersRemaining} m`}
                </span>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default GameMap;
