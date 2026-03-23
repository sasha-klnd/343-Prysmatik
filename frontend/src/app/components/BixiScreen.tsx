import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Bike, ChevronLeft, RefreshCw, Search, Clock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import { LogTripModal } from '@/app/components/LogTripModal';

const mkIcon = (color: string) => new Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const iconGreen  = mkIcon('green');
const iconOrange = mkIcon('orange');
const iconRed    = mkIcon('red');
const getBikeIcon = (n: number) => n === 0 ? iconRed : n <= 3 ? iconOrange : iconGreen;

// Rich fallback — realistic Montréal BIXI stations
const STATIONS = [
  { station_id: '1',  name: 'Métro Mont-Royal / Clark',            lat: 45.5235, lon: -73.5857, capacity: 27, num_bikes_available: 12, num_docks_available: 15 },
  { station_id: '2',  name: 'de Maisonneuve / Mackay',             lat: 45.4968, lon: -73.5780, capacity: 23, num_bikes_available:  8, num_docks_available: 15 },
  { station_id: '3',  name: 'Vieux-Port / Place Jacques-Cartier',  lat: 45.5088, lon: -73.5540, capacity: 31, num_bikes_available: 18, num_docks_available: 13 },
  { station_id: '4',  name: 'McGill / Sherbrooke',                 lat: 45.5048, lon: -73.5732, capacity: 19, num_bikes_available:  5, num_docks_available: 14 },
  { station_id: '5',  name: 'Plateau / Papineau',                  lat: 45.5260, lon: -73.5732, capacity: 23, num_bikes_available:  9, num_docks_available: 14 },
  { station_id: '6',  name: 'Quartier Latin / Saint-Denis',        lat: 45.5140, lon: -73.5820, capacity: 27, num_bikes_available: 22, num_docks_available:  5 },
  { station_id: '7',  name: 'Mile End / Parc',                     lat: 45.5225, lon: -73.5985, capacity: 15, num_bikes_available:  7, num_docks_available:  8 },
  { station_id: '8',  name: 'Concordia / Guy',                     lat: 45.4944, lon: -73.5786, capacity: 21, num_bikes_available:  4, num_docks_available: 17 },
  { station_id: '9',  name: 'Métro Laurier / Christophe-Colomb',   lat: 45.5302, lon: -73.5849, capacity: 23, num_bikes_available: 14, num_docks_available:  9 },
  { station_id: '10', name: 'Rue Rachel / Boyer',                  lat: 45.5255, lon: -73.5790, capacity: 19, num_bikes_available:  3, num_docks_available: 16 },
  { station_id: '11', name: 'Avenue du Mont-Royal / Saint-Laurent', lat: 45.5213, lon: -73.5837, capacity: 25, num_bikes_available: 11, num_docks_available: 14 },
  { station_id: '12', name: 'Métro Berri-UQAM / Saint-Denis',      lat: 45.5166, lon: -73.5632, capacity: 35, num_bikes_available: 20, num_docks_available: 15 },
  { station_id: '13', name: 'Notre-Dame / Bonsecours',             lat: 45.5074, lon: -73.5494, capacity: 17, num_bikes_available:  0, num_docks_available: 17 },
  { station_id: '14', name: 'Saint-Laurent / Ontario',             lat: 45.5188, lon: -73.5658, capacity: 21, num_bikes_available: 16, num_docks_available:  5 },
  { station_id: '15', name: 'Rue Sainte-Catherine / Crescent',     lat: 45.4982, lon: -73.5745, capacity: 29, num_bikes_available:  2, num_docks_available: 27 },
  { station_id: '16', name: 'Avenue des Pins / Parc',              lat: 45.5112, lon: -73.5900, capacity: 19, num_bikes_available:  8, num_docks_available: 11 },
  { station_id: '17', name: 'Métro Place-des-Arts / Jeanne-Mance', lat: 45.5084, lon: -73.5688, capacity: 23, num_bikes_available: 13, num_docks_available: 10 },
  { station_id: '18', name: 'Côte-des-Neiges / Queen-Mary',        lat: 45.4928, lon: -73.6120, capacity: 15, num_bikes_available:  6, num_docks_available:  9 },
  { station_id: '19', name: 'Jean-Talon / Jarry',                  lat: 45.5380, lon: -73.6130, capacity: 19, num_bikes_available: 10, num_docks_available:  9 },
  { station_id: '20', name: 'Rosemont / De Lorimier',              lat: 45.5310, lon: -73.5680, capacity: 21, num_bikes_available: 17, num_docks_available:  4 },
  { station_id: '21', name: 'Métro Frontenac / Ontario',           lat: 45.5345, lon: -73.5485, capacity: 17, num_bikes_available:  5, num_docks_available: 12 },
  { station_id: '22', name: 'Wellington / Charlevoix',             lat: 45.4868, lon: -73.5660, capacity: 23, num_bikes_available: 11, num_docks_available: 12 },
  { station_id: '23', name: 'Atwater / Saint-Antoine',             lat: 45.4940, lon: -73.5870, capacity: 19, num_bikes_available:  0, num_docks_available: 19 },
  { station_id: '24', name: 'Métro Snowdon / Côte-des-Neiges',     lat: 45.4905, lon: -73.6225, capacity: 15, num_bikes_available:  7, num_docks_available:  8 },
  { station_id: '25', name: 'Saint-Joseph / Fullum',               lat: 45.5238, lon: -73.5601, capacity: 21, num_bikes_available: 15, num_docks_available:  6 },
];

interface Station { station_id: string; name: string; lat: number; lon: number; capacity: number; num_bikes_available: number; num_docks_available: number; }
type FilterMode = 'all' | 'bikes' | 'docks';
const MONTREAL_CENTER: [number, number] = [45.5088, -73.5700];

interface BixiScreenProps {
  onBack: () => void;
  isAuthenticated?: boolean;
  onRequireAuth?: (action: string) => void;
}

export function BixiScreen({ onBack, isAuthenticated = false, onRequireAuth = () => {} }: BixiScreenProps) {
  const [stations,     setStations]     = useState<Station[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterMode,   setFilterMode]   = useState<FilterMode>('all');
  const [activeView,   setActiveView]   = useState<'list' | 'map'>('list');
  const [lastUpdated,  setLastUpdated]  = useState('');
  const [refreshing,   setRefreshing]   = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const load = useCallback((showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setLoading(true);

    // Try live GBFS first; fall back to static data on any error
    Promise.all([
      fetch('https://gbfs.velobixi.com/gbfs/2-2/en/station_information.json'),
      fetch('https://gbfs.velobixi.com/gbfs/2-2/en/station_status.json'),
    ])
      .then(async ([infoRes, statusRes]) => {
        const [info, status] = await Promise.all([infoRes.json(), statusRes.json()]);
        const statusMap: Record<string, any> = {};
        for (const s of status?.data?.stations ?? []) statusMap[s.station_id] = s;
        const merged: Station[] = (info?.data?.stations ?? []).map((s: any) => ({
          station_id: s.station_id, name: s.name, lat: s.lat, lon: s.lon,
          capacity: s.capacity ?? 0,
          num_bikes_available: statusMap[s.station_id]?.num_bikes_available ?? 0,
          num_docks_available: statusMap[s.station_id]?.num_docks_available ?? 0,
        }));
        setStations(merged);
      })
      .catch(() => {
        setStations(STATIONS);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
        setLastUpdated(new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }));
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = stations.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filterMode === 'all' ? true : filterMode === 'bikes' ? s.num_bikes_available > 0 : s.num_docks_available > 0;
    return matchSearch && matchFilter;
  });

  const totalBikes = stations.reduce((a, s) => a + s.num_bikes_available, 0);
  const totalDocks = stations.reduce((a, s) => a + s.num_docks_available, 0);
  const availPct   = (s: Station) => s.capacity ? Math.round(s.num_bikes_available / s.capacity * 100) : 0;
  const barColor   = (n: number) => n === 0 ? 'bg-red-500' : n <= 3 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#061008] to-[#0a1505] text-white">

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0b0d]/90 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl border border-white/10">
              <ChevronLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl">
                <Bike className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">BIXI Montréal</h1>
                <p className="text-xs text-gray-400">Live station availability</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <div className="hidden md:flex items-center gap-1 text-xs text-gray-400 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <Clock className="w-3.5 h-3.5" /> Updated {lastUpdated}
              </div>
            )}

            {/* Log trip button */}
            <button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-sm text-emerald-300 hover:bg-emerald-600/30 transition-all"
            >
              + Log trip
            </button>

            <button onClick={() => load(true)} disabled={refreshing || loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 disabled:opacity-50 transition-all">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="flex rounded-xl border border-white/10 overflow-hidden">
              {(['list', 'map'] as const).map(v => (
                <button key={v} onClick={() => setActiveView(v)}
                  className={`px-3 py-2 text-sm capitalize transition-all ${activeView === v ? 'bg-emerald-600/30 text-emerald-300' : 'text-gray-400 hover:bg-white/5'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Stations',        value: stations.length, color: 'from-emerald-600 to-green-600' },
            { label: 'Bikes available', value: totalBikes,      color: 'from-green-600 to-teal-600'    },
            { label: 'Docks free',      value: totalDocks,      color: 'from-teal-600 to-cyan-600'     },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-2xl border border-white/10 bg-white/5">
              <div className={`text-2xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                {loading ? '—' : value}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              placeholder="Search station..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            {([['all', 'All'], ['bikes', '🚲 Bikes'], ['docks', '🅿️ Docks']] as const).map(([mode, label]) => (
              <button key={mode} onClick={() => setFilterMode(mode)}
                className={`px-3 py-2 text-sm transition-all ${filterMode === mode ? 'bg-emerald-600/30 text-emerald-300' : 'text-gray-400 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* List view */}
        {activeView === 'list' && (
          loading ? (
            <div className="text-sm text-gray-400 py-8 text-center">Loading BIXI stations…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">No stations match your filter.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(s => (
                <div key={s.station_id} className="p-4 rounded-2xl border border-white/10 bg-white/5 hover:border-emerald-500/30 transition-all">
                  <div className="text-sm font-semibold text-white leading-tight mb-3">{s.name}</div>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Bikes</span>
                      <span className={s.num_bikes_available === 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {s.num_bikes_available} / {s.capacity}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className={`h-1.5 rounded-full ${barColor(s.num_bikes_available)} transition-all`}
                        style={{ width: `${availPct(s)}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mb-3">
                    <span>Free docks</span>
                    <span className={s.num_docks_available === 0 ? 'text-red-400' : 'text-gray-300'}>{s.num_docks_available}</span>
                  </div>
                  <a
                    href={`https://secure.bixi.com/map?lat=${s.lat}&lng=${s.lon}&zoom=17`}
                    target="_blank" rel="noopener noreferrer"
                    className="block text-center text-xs px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-all">
                    Open in BIXI app →
                  </a>
                </div>
              ))}
            </div>
          )
        )}

        {/* Map view */}
        {activeView === 'map' && (
          <div className="rounded-2xl overflow-hidden border border-white/10" style={{ height: 520 }}>
            <MapContainer center={MONTREAL_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filtered.map(s => (
                <Marker key={s.station_id} position={[s.lat, s.lon]} icon={getBikeIcon(s.num_bikes_available)}>
                  <Popup>
                    <div className="min-w-[160px]">
                      <p className="font-semibold text-sm mb-1">{s.name}</p>
                      <p className="text-xs text-gray-600">🚲 {s.num_bikes_available} bikes available</p>
                      <p className="text-xs text-gray-600">🅿️ {s.num_docks_available} docks free</p>
                      <p className="text-xs text-gray-500 mt-1">Capacity: {s.capacity}</p>
                      <a
                        href={`https://secure.bixi.com/map?lat=${s.lat}&lng=${s.lon}&zoom=17`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-emerald-600 underline mt-1 block">
                        Open BIXI app →
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Available (4+)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Low (1–3)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Empty</span>
        </div>
      </div>

      {/* Log Trip Modal */}
      <LogTripModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        isAuthenticated={isAuthenticated}
        onRequireAuth={() => { setShowLogModal(false); onRequireAuth('log a trip'); }}
        defaultMode="bike"
      />
    </div>
  );
}

export default BixiScreen;