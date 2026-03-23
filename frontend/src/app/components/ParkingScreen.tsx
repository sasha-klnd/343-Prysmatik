import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import {
  Car, ChevronLeft, Search, Loader, MapPin, Star,
  Clock, DollarSign, AlertCircle, RefreshCcw, Navigation,
  Zap, MessageCircle, ExternalLink, ChevronRight,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import { apiFetch } from '@/api/client';

const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

const selectedIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

interface ParkingScreenProps {
  onBack: () => void;
  nearLocation?: string;
  onAskAI?: (message: string) => void;
}

interface ParkingPlace {
  id: string; name: string; lat: number; lng: number;
  address: string; rating?: number; open_now?: boolean;
  price_level?: number; price_label: string; types: string[];
  distance_m?: number;
}

const MTL_CENTER: [number, number] = [45.5017, -73.5673];
const DEFAULT_RADIUS = 800;

function distanceLabel(m?: number) {
  if (m == null) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ParkingScreen({ onBack, nearLocation, onAskAI }: ParkingScreenProps) {
  const [places,      setPlaces]      = useState<ParkingPlace[]>([]);
  const [center,      setCenter]      = useState<[number, number]>(MTL_CENTER);
  const [centerLabel, setCenterLabel] = useState('');
  const [search,      setSearch]      = useState(nearLocation ?? '');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [selected,    setSelected]    = useState<ParkingPlace | null>(null);
  const [noKey,       setNoKey]       = useState(false);
  const [showList,    setShowList]    = useState(false);

  const mapRef = useRef<any>(null);

  const fetchParking = async (address: string) => {
    if (!address.trim()) return;
    setLoading(true); setError(null); setPlaces([]); setSelected(null);
    try {
      const data = await apiFetch(
        `/parking/near-address?address=${encodeURIComponent(address)}&radius=${DEFAULT_RADIUS}`
      );
      const rawPlaces: ParkingPlace[] = data.places || [];
      // Annotate with distance from center
      if (data.center) {
        const c: [number, number] = [data.center.lat, data.center.lng];
        setCenter(c);
        setCenterLabel(data.center.label || address);
        if (mapRef.current) mapRef.current.setView(c, 15);
        rawPlaces.forEach(p => {
          p.distance_m = Math.round(haversineM(c[0], c[1], p.lat, p.lng));
        });
        rawPlaces.sort((a, b) => (a.distance_m ?? 999999) - (b.distance_m ?? 999999));
      }
      setPlaces(rawPlaces);
      if (rawPlaces.length === 0) setError('No parking found within 800 m. Try a more specific address.');
    } catch (e: any) {
      const msg: string = e?.message || 'Failed to fetch parking';
      if (msg.includes('not configured') || msg.includes('503')) {
        setNoKey(true);
        setError('Google Maps API key not configured. Add GOOGLE_MAPS_API_KEY to your .env.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nearLocation) fetchParking(nearLocation);
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchParking(search); };

  const handleAskAI = (msg: string) => {
    if (onAskAI) onAskAI(msg);
    else onBack();
  };

  const openInMaps = (place: ParkingPlace) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, '_blank');
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0b0d]">

      {/* Header */}
      <div className="glass-effect border-b border-white/10 px-4 py-3 backdrop-blur-2xl z-50 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-gray-300 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-indigo-400" />
            <h1 className="text-lg font-bold text-white">Parking</h1>
            {centerLabel && (
              <span className="text-xs text-indigo-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Near {centerLabel}
              </span>
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 ml-auto min-w-0 flex-1 max-w-md">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search near an address…"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 outline-none focus:border-indigo-500/50"
            />
            <button type="submit" disabled={loading || !search.trim()}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all flex items-center gap-1.5 text-sm shrink-0">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="hidden sm:inline">Find</span>
            </button>
          </form>

          {/* Mobile list toggle */}
          <button
            onClick={() => setShowList(v => !v)}
            className="lg:hidden px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm flex items-center gap-1.5"
          >
            <MapPin className="w-4 h-4" />
            <span className="hidden xs:inline">{showList ? 'Map' : `List${places.length > 0 ? ` (${places.length})` : ''}`}</span>
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Sidebar */}
        <div className={`${showList ? 'flex' : 'hidden'} lg:flex w-full lg:w-96 shrink-0 bg-[#0f1012] border-r border-white/10 flex-col overflow-hidden absolute lg:relative inset-0 lg:inset-auto z-10`}>

          {/* Stats row */}
          {places.length > 0 && (
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm text-gray-400">
                <span className="text-white font-semibold">{places.length}</span> spots found within {DEFAULT_RADIUS} m
              </span>
              <button onClick={() => fetchParking(search)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                <RefreshCcw className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          )}

          {/* Error / no-key */}
          {error && (
            <div className="m-3 p-3 rounded-xl border border-red-500/30 bg-red-600/10 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {noKey && (
            <div className="m-3 p-3 rounded-xl border border-amber-500/30 bg-amber-600/10 text-xs text-amber-300">
              Without a Google Maps API key, parking search is unavailable.<br />
              <button
                onClick={() => handleAskAI(`Find parking near ${search || 'downtown Montreal'}`)}
                className="flex items-center gap-1.5 mt-2 text-indigo-300 hover:text-indigo-200"
              >
                <Zap className="w-3.5 h-3.5" /> Ask AI for parking suggestions instead
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && places.length === 0 && !error && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
                <Car className="w-7 h-7 text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">Find parking near you</p>
              <p className="text-xs text-gray-400 mb-4">
                Search any Montréal address to see nearby parking lots and garages with real-time availability.
              </p>
              <button
                onClick={() => handleAskAI('Find me parking near downtown Montreal')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-sm hover:bg-indigo-600/30 transition-all"
              >
                <MessageCircle className="w-4 h-4" /> Ask AI about parking
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 p-5 text-sm text-gray-400">
              <Loader className="w-4 h-4 animate-spin text-indigo-400" />
              Finding parking spots…
            </div>
          )}

          {/* Parking list */}
          {places.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              {places.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => { setSelected(p); if (mapRef.current) mapRef.current.setView([p.lat, p.lng], 17); setShowList(false); }}
                  className={`p-4 border-b border-white/8 cursor-pointer transition-all hover:bg-white/5 ${selected?.id === p.id ? 'bg-indigo-600/10 border-l-2 border-l-indigo-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">#{i + 1}</span>
                        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{p.address}</p>

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {p.distance_m != null && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Navigation className="w-3 h-3" /> {distanceLabel(p.distance_m)}
                          </span>
                        )}
                        {p.rating != null && (
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <Star className="w-3 h-3" /> {p.rating.toFixed(1)}
                          </span>
                        )}
                        {p.open_now != null && (
                          <span className={`flex items-center gap-1 text-xs ${p.open_now ? 'text-emerald-400' : 'text-red-400'}`}>
                            <Clock className="w-3 h-3" />
                            {p.open_now ? 'Open' : 'Closed'}
                          </span>
                        )}
                        {p.price_label && p.price_label !== 'Unknown' && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <DollarSign className="w-3 h-3" /> {p.price_label}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ask AI button at the bottom */}
          {places.length > 0 && (
            <div className="p-3 border-t border-white/10 shrink-0">
              <button
                onClick={() => handleAskAI(`I need parking near ${centerLabel || search}. Which option is best for me?`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-sm transition-all"
              >
                <Zap className="w-4 h-4" /> Ask AI to recommend the best option
              </button>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={center}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
            />

            {/* Search radius circle */}
            {places.length > 0 && (
              <Circle
                center={center}
                radius={DEFAULT_RADIUS}
                pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 1 }}
              />
            )}

            {/* Parking markers */}
            {places.map((p, i) => (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={selected?.id === p.id ? selectedIcon : defaultIcon}
                eventHandlers={{ click: () => setSelected(p) }}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <p className="font-bold text-sm mb-1">#{i + 1} {p.name}</p>
                    <p className="text-xs text-gray-600 mb-2">{p.address}</p>
                    <div className="flex gap-3 text-xs text-gray-500 flex-wrap mb-2">
                      {p.distance_m != null && <span>📍 {distanceLabel(p.distance_m)}</span>}
                      {p.rating != null && <span>⭐ {p.rating.toFixed(1)}</span>}
                      {p.open_now != null && <span>{p.open_now ? '🟢 Open' : '🔴 Closed'}</span>}
                    </div>
                    <button
                      onClick={() => openInMaps(p)}
                      className="w-full text-xs py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                      Navigate →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Selected place detail panel — overlaid on map */}
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 lg:left-4 lg:right-auto lg:w-80 z-20">
              <div className="glass-effect rounded-2xl border border-white/15 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{selected.name}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{selected.address}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300 shrink-0 text-lg leading-none">×</button>
                </div>

                <div className="flex flex-wrap gap-3 mb-3 text-xs">
                  {selected.distance_m != null && (
                    <span className="flex items-center gap-1 text-gray-300">
                      <Navigation className="w-3 h-3 text-indigo-400" /> {distanceLabel(selected.distance_m)}
                    </span>
                  )}
                  {selected.rating != null && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3 h-3" /> {selected.rating.toFixed(1)}
                    </span>
                  )}
                  {selected.open_now != null && (
                    <span className={`flex items-center gap-1 ${selected.open_now ? 'text-emerald-400' : 'text-red-400'}`}>
                      <Clock className="w-3 h-3" /> {selected.open_now ? 'Open now' : 'Closed'}
                    </span>
                  )}
                  {selected.price_label && selected.price_label !== 'Unknown' && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <DollarSign className="w-3 h-3" /> {selected.price_label}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openInMaps(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Navigate
                  </button>
                  <button
                    onClick={() => handleAskAI(`Is ${selected.name} at ${selected.address} a good parking option? How much does it cost and how do I get there from my location?`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 text-xs font-semibold transition-all border border-white/10"
                  >
                    <Zap className="w-3.5 h-3.5" /> Ask AI
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty map state */}
          {places.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center pointer-events-auto">
                <div className="glass-effect rounded-2xl border border-white/10 p-6 shadow-xl backdrop-blur-xl">
                  <Car className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Search an address to find nearby parking</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ParkingScreen;
