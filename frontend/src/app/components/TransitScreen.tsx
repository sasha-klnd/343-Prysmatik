import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bus, ChevronLeft, Search, Loader, Clock, Train,
  MapPin, RefreshCcw, ArrowRight, Zap, DollarSign,
  MessageCircle, AlertCircle, CheckCircle, ExternalLink,
} from 'lucide-react';
import { apiFetch } from '@/api/client';
import { LogTripModal } from '@/app/components/LogTripModal';

interface TransitScreenProps {
  onBack: () => void;
  isAuthenticated?: boolean;
  onRequireAuth?: (action: string) => void;
  /** Navigate to chat with a pre-filled message */
  onAskAI?: (message: string) => void;
}

interface Stop { stop_id: string; name: string; lat: number; lng: number; lines: string[] }
interface Departure {
  route_id: string; trip_id: string;
  departure_unix: number; delay_sec: number;
  minutes_away: number; on_time: boolean;
}

const LINE_COLORS: Record<string, string> = {
  Orange: '#F68712', Green: '#00A651', Blue: '#0072BC',
  Yellow: '#FFD700', Bus: '#6366f1', Train: '#8b5cf6',
};

const FARE_TABLE = [
  { label: 'Single fare (adult)', price: '$3.75' },
  { label: '10-trip booklet',     price: '$31.50' },
  { label: 'Monthly pass',        price: '$103.00' },
  { label: 'Reduced (students)',  price: '$70.50/mo' },
  { label: '65+ seniors',         price: '$70.50/mo' },
];

export function TransitScreen({
  onBack, isAuthenticated = false, onRequireAuth = () => {}, onAskAI,
}: TransitScreenProps) {
  const [query,        setQuery]        = useState('');
  const [stops,        setStops]        = useState<Stop[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [departures,   setDepartures]   = useState<Departure[]>([]);
  const [loadingDeps,  setLoadingDeps]  = useState(false);
  const [stmLive,      setStmLive]      = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null);
  const [countdown,    setCountdown]    = useState(30);
  const [showFares,    setShowFares]    = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const refreshTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check STM status on mount
  useEffect(() => {
    apiFetch('/stm/status').then(d => setStmLive(d.configured)).catch(() => {});
  }, []);

  // Debounced stop search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) { setStops([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const d = await apiFetch(`/stm/stops?q=${encodeURIComponent(query)}`);
        setStops(d.stops || []);
      } catch { setStops([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  // Fetch departures for selected stop
  const fetchDepartures = useCallback(async (stop: Stop) => {
    setLoadingDeps(true);
    setError(null);
    try {
      const d = await apiFetch(`/stm/next-departures?stop_id=${stop.stop_id}&limit=8`);
      setDepartures(d.departures || []);
      setLastRefresh(new Date());
      setCountdown(30);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch departures');
    } finally {
      setLoadingDeps(false);
    }
  }, []);

  // Auto-refresh every 30s when a stop is selected
  useEffect(() => {
    if (!selectedStop) return;
    fetchDepartures(selectedStop);

    refreshTimer.current = setInterval(() => fetchDepartures(selectedStop), 30_000);
    countdownTimer.current = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1_000);

    return () => {
      if (refreshTimer.current)  clearInterval(refreshTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [selectedStop, fetchDepartures]);

  const selectStop = (stop: Stop) => {
    setSelectedStop(stop);
    setQuery(stop.name);
    setStops([]);
    setDepartures([]);
  };

  const handleAskAI = (msg: string) => {
    if (onAskAI) onAskAI(msg);
    else onBack();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#070a14] to-[#050818] text-white">

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0b0d]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl border border-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
                <Bus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Public Transit</h1>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${stmLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                  <p className="text-xs text-gray-400">{stmLive ? 'STM real-time connected' : 'STM — Montréal'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAskAI('Help me plan a transit route in Montréal')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-sm transition-all"
            >
              <Zap className="w-3.5 h-3.5" /> Ask AI
            </button>
            <button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 text-sm transition-all"
            >
              + Log trip
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stop search */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            {searching && <Loader className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search a stop — name or number (e.g. Berri-UQAM or 51515)…"
              className="w-full pl-12 pr-12 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:outline-none text-white placeholder:text-gray-500 text-sm"
            />
          </div>

          {/* Stop suggestions dropdown */}
          {stops.length > 0 && (
            <div className="absolute top-full mt-2 w-full z-30 bg-[#141518] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {stops.map(stop => (
                <button
                  key={stop.stop_id}
                  onClick={() => selectStop(stop)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                >
                  <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{stop.name}</p>
                    <p className="text-xs text-gray-500">Stop #{stop.stop_id}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {stop.lines.slice(0, 3).map(l => (
                      <span
                        key={l}
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ backgroundColor: (LINE_COLORS[l] || '#6b7280') + '33', color: LINE_COLORS[l] || '#9ca3af' }}
                      >
                        {l[0]}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected stop — live departures */}
        {selectedStop ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Stop header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedStop.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500">Stop #{selectedStop.stop_id}</span>
                  {selectedStop.lines.map(l => (
                    <span
                      key={l}
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: (LINE_COLORS[l] || '#6b7280') + '22', color: LINE_COLORS[l] || '#9ca3af', border: `1px solid ${(LINE_COLORS[l] || '#6b7280')}44` }}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {lastRefresh && (
                  <span className="text-xs text-gray-500">Refresh in {countdown}s</span>
                )}
                <button
                  onClick={() => fetchDepartures(selectedStop)}
                  disabled={loadingDeps}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <RefreshCcw className={`w-4 h-4 text-gray-400 ${loadingDeps ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Departures */}
            <div className="p-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/30 bg-red-600/10 text-sm text-red-300 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {loadingDeps && departures.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Loader className="w-4 h-4 animate-spin text-blue-400" />
                  Fetching live departures…
                </div>
              ) : !stmLive ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-600/10 text-sm text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    STM real-time API not configured — add STM_API_KEY to your .env for live departures.
                  </div>
                  <button
                    onClick={() => handleAskAI(`When is the next bus/metro at ${selectedStop.name} (stop ${selectedStop.stop_id})?`)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Ask AI about this stop
                  </button>
                </div>
              ) : departures.length === 0 ? (
                <div className="text-sm text-gray-400 py-4">
                  No upcoming departures found for this stop right now.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {departures.map((dep, i) => {
                    const depTime = new Date(dep.departure_unix * 1000);
                    const timeStr = depTime.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const isNow   = dep.minutes_away <= 1;
                    const isSoon  = dep.minutes_away <= 5;
                    return (
                      <div
                        key={`${dep.trip_id}-${i}`}
                        className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                          isNow ? 'border-emerald-500/40 bg-emerald-600/10' :
                          isSoon ? 'border-amber-500/30 bg-amber-600/10' :
                          'border-white/8 bg-white/3'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ backgroundColor: '#1e40af33', border: '1px solid #1e40af66' }}
                          >
                            <span className="text-blue-300 text-[11px] font-bold leading-tight text-center px-0.5">
                              {dep.route_id}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">Route {dep.route_id}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {dep.on_time ? (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                                  <CheckCircle className="w-3 h-3" /> On time
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-400">
                                  {dep.delay_sec > 0 ? `+${Math.round(dep.delay_sec/60)} min late` : `${Math.round(Math.abs(dep.delay_sec)/60)} min early`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`text-lg font-bold ${isNow ? 'text-emerald-400' : isSoon ? 'text-amber-400' : 'text-white'}`}>
                            {isNow ? 'Now' : `${dep.minutes_away} min`}
                          </p>
                          <p className="text-xs text-gray-500">{timeStr}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ask AI button */}
              <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleAskAI(`Plan a transit route from my current location using stop ${selectedStop.name} (${selectedStop.stop_id})`)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-sm transition-all"
                >
                  <Zap className="w-4 h-4" />
                  Plan a route from here
                </button>
                <a
                  href={`https://www.stm.info/en/info/networks/bus`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 text-sm transition-all"
                >
                  <ExternalLink className="w-4 h-4" /> STM Schedule
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Prompt state — no stop selected yet */
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Train className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Search any STM stop</h2>
            <p className="text-sm text-gray-400 mb-4">
              Type a metro station name, bus stop, or stop number above to see live departures.
            </p>
            <button
              onClick={() => handleAskAI('What transit options are available in Montréal?')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-sm transition-all"
            >
              <MessageCircle className="w-4 h-4" /> Ask AI to plan my route
            </button>
          </div>
        )}

        {/* Quick access — popular metro stations */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Popular stations</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Berri-UQAM',       id: '51515', lines: ['Orange','Green','Yellow'] },
              { name: 'McGill',            id: '51507', lines: ['Orange'] },
              { name: 'Guy-Concordia',     id: '51509', lines: ['Orange'] },
              { name: 'Jean-Talon',        id: '51543', lines: ['Orange','Blue'] },
              { name: 'Mont-Royal',        id: '51540', lines: ['Orange'] },
              { name: 'Snowdon',           id: '51547', lines: ['Orange','Blue'] },
              { name: 'Lionel-Groulx',     id: '51511', lines: ['Orange','Green'] },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => selectStop({ stop_id: s.id, name: s.name, lat: 0, lng: 0, lines: s.lines })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-blue-600/10 transition-all text-sm text-gray-300 hover:text-white"
              >
                {s.lines.slice(0, 2).map(l => (
                  <span key={l} className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: LINE_COLORS[l] || '#6b7280' }} />
                ))}
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible fares */}
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <button
            onClick={() => setShowFares(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">STM Fares (2025)</span>
            </div>
            <ArrowRight className={`w-4 h-4 text-gray-400 transition-transform ${showFares ? 'rotate-90' : ''}`} />
          </button>
          {showFares && (
            <div className="px-5 pb-5 border-t border-white/10">
              <div className="divide-y divide-white/8 mt-3">
                {FARE_TABLE.map(({ label, price }) => (
                  <div key={label} className="flex justify-between items-center py-2.5">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className="text-sm font-semibold text-white">{price}</span>
                  </div>
                ))}
              </div>
              <a href="https://www.stm.info/en/info/fares" target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                Verify current fares at stm.info <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      <LogTripModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        isAuthenticated={isAuthenticated}
        onRequireAuth={() => { setShowLogModal(false); onRequireAuth('log a trip'); }}
        defaultMode="transit"
      />
    </div>
  );
}

export default TransitScreen;
