import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Calendar, ChevronLeft, Clock, MapPin, Users,
  SlidersHorizontal, Cigarette, PawPrint, Music, MessageCircle, X, CheckCircle
} from 'lucide-react';
import { apiFetch } from '@/api/client';
import { fmtDate, fmtTime } from './timeUtils';

type Props = {
  onBack: () => void;
  isAuthenticated: boolean;
  onRequireAuth: (action: string) => void;
  onShowParking?: (destination: string) => void;
};

type SafeUser = { id: number; name: string; created_at?: string; avg_driver_rating?: number | null; total_ratings?: number };

type RidePreferences = {
  allowSmoking: boolean;
  allowPets:    boolean;
  musicOk:      boolean;
  chatty:       boolean;
};

type Ride = {
  id: number;
  departure:          string;
  destination:        string;
  departure_datetime: string;
  seats_available:    number;
  status:             'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
  creator:            SafeUser;
  requests_count?:    number;
  meetup_lat?:        number | null;
  meetup_lng?:        number | null;
  ridePreferences?:   RidePreferences;
};

interface ActiveFilters {
  noSmoking: boolean;
  petsOk:    boolean;
  musicOk:   boolean;
}

const PREF_TAGS: { key: keyof ActiveFilters; label: string; icon: React.ReactNode }[] = [
  { key: 'noSmoking', label: 'No smoking', icon: <Cigarette className="w-3.5 h-3.5" /> },
  { key: 'petsOk',    label: 'Pets OK',    icon: <PawPrint  className="w-3.5 h-3.5" /> },
  { key: 'musicOk',   label: 'Music OK',   icon: <Music      className="w-3.5 h-3.5" /> },
];

function prefMatchScore(ride: Ride, filters: ActiveFilters): number {
  if (!ride.ridePreferences) return 0;
  const rp = ride.ridePreferences;
  let score = 0;
  if (filters.noSmoking && !rp.allowSmoking) score++;
  if (filters.petsOk    && rp.allowPets)     score++;
  if (filters.musicOk   && rp.musicOk)       score++;
  return score;
}

const EMPTY_FORM = {
  departure: '', destination: '', date: '', time: '',
  seatsAvailable: 1, meetupAddress: '',
  allowSmoking: false, allowPets: false, musicOk: true, chatty: true,
};

export function CarpoolScreen({ onBack, isAuthenticated, onRequireAuth, onShowParking }: Props) {
  const [rides,            setRides]            = useState<Ride[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [showFilters,      setShowFilters]      = useState(false);
  const [selectedRide,     setSelectedRide]     = useState<Ride | null>(null);
  const [offerSuccess,     setOfferSuccess]     = useState<{ destination: string } | null>(null);
  const [requestedRideIds, setRequestedRideIds] = useState<Set<number>>(new Set());

  const [filters, setFilters] = useState<ActiveFilters>({
    noSmoking: false, petsOk: false, musicOk: false,
  });

  const [form, setForm] = useState(EMPTY_FORM);

  const canSubmit = useMemo(() => (
    form.departure.trim().length > 0 &&
    form.destination.trim().length > 0 &&
    form.date.trim().length > 0 &&
    form.time.trim().length > 0 &&
    Number.isFinite(form.seatsAvailable) &&
    form.seatsAvailable >= 1 &&
    form.seatsAvailable <= 8
  ), [form]);

  // ── Data loading ─────────────────────────────────────────────────────────────
  const buildQS = (f: ActiveFilters) => {
    const p = new URLSearchParams();
    if (f.noSmoking) p.set('no_smoking', '1');
    if (f.petsOk)    p.set('pets_ok',    '1');
    if (f.musicOk)   p.set('music_ok',   '1');
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const loadRides = async (f: ActiveFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      setRides(await apiFetch(`/rides${buildQS(f)}`));
    } catch (e: any) {
      setError(e?.message || 'Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRides(); }, []);

  const toggleFilter = (key: keyof ActiveFilters) => {
    const next = { ...filters, [key]: !filters[key] };
    setFilters(next);
    loadRides(next);
  };

  // ── Offer a ride ─────────────────────────────────────────────────────────────
  const offerRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return onRequireAuth('offer a ride');
    if (!canSubmit) { setError('Please fill all required fields.'); return; }

    const dt = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(dt.getTime())) { setError('Invalid date or time.'); return; }
    if (dt < new Date()) { setError('You cannot offer a ride in the past.'); return; }

    try {
      setError(null);
      await apiFetch('/rides', {
        method: 'POST',
        body: JSON.stringify({
          departure:       form.departure.trim(),
          destination:     form.destination.trim(),
          date:            form.date,
          time:            form.time,
          seats_available: form.seatsAvailable,
          ridePreferences: {
            allowSmoking: form.allowSmoking,
            allowPets:    form.allowPets,
            musicOk:      form.musicOk,
            chatty:       form.chatty,
          },
        }),
      });
      const dest = form.destination.trim();
      setForm(EMPTY_FORM);
      await loadRides();
      if (onShowParking) setOfferSuccess({ destination: dest });
    } catch (e: any) {
      setError(e?.message || 'Failed to post ride');
    }
  };

  // ── Request a ride ───────────────────────────────────────────────────────────
  const requestRide = async (ride: Ride) => {
    if (!isAuthenticated) return onRequireAuth('request a ride');
    if (ride.status !== 'OPEN' || ride.seats_available <= 0) {
      setError('This ride is not open for requests.');
      return;
    }
    try {
      setError(null);
      await apiFetch(`/rides/${ride.id}/request`, {
        method: 'POST',
        body: JSON.stringify({ seats_requested: 1 }),
      });
      setRequestedRideIds(prev => new Set([...prev, ride.id]));
      await loadRides();
    } catch (e: any) {
      setError(e?.message || 'Failed to request ride');
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Main screen ──────────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0b1020] to-[#110a1a] text-white">
        <div className="max-w-5xl mx-auto p-4 sm:p-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-gray-200 hover:bg-white/5"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-2xl font-bold">Carpool</h1>

            <button
              onClick={() => setShowFilters(v => !v)}
              className={`ml-auto flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                activeFilterCount > 0
                  ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300'
                  : 'border-white/10 text-gray-400 hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={() => loadRides()}
              className="px-3 py-2 rounded-xl border border-white/10 text-gray-200 hover:bg-white/5 text-sm"
            >
              Refresh
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mb-5 p-4 rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Filter by ride preferences</h3>
                <button
                  onClick={() => {
                    const reset: ActiveFilters = { noSmoking: false, petsOk: false, musicOk: false };
                    setFilters(reset);
                    loadRides(reset);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {PREF_TAGS.map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => toggleFilter(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ${
                      filters[key]
                        ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-600/10 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-300 mt-0.5 shrink-0" />
              <div className="text-sm text-red-200 flex-1">{error}</div>
              <button onClick={() => setError(null)}>
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          )}

          {/* Parking suggestion banner */}
          {offerSuccess && onShowParking && (
            <div className="mb-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-600/10 flex items-center gap-3 flex-wrap">
              <span className="text-2xl">🅿️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-200">Ride posted!</p>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Would you like to see available parking near{' '}
                  <span className="font-medium text-white">{offerSuccess.destination}</span>?
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { onShowParking(offerSuccess.destination); setOfferSuccess(null); }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 text-xs font-semibold transition-all"
                >
                  Show parking
                </button>
                <button
                  onClick={() => setOfferSuccess(null)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 text-xs transition-all"
                >
                  No thanks
                </button>
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* ── Offer a ride form ──────────────────────────────────────────── */}
            <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
              <h2 className="font-semibold mb-4">Offer a ride</h2>
              <form onSubmit={offerRide} className="grid gap-2">

                <label className="text-xs text-gray-400">Departure *</label>
                <input
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="e.g. Downtown Montréal"
                  value={form.departure}
                  onChange={e => setForm(p => ({ ...p, departure: e.target.value }))}
                />

                <label className="text-xs text-gray-400 mt-1">Destination *</label>
                <input
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="e.g. Concordia University"
                  value={form.destination}
                  onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
                />

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <label className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Date *
                    </label>
                    <input
                      type="date"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                      value={form.date}
                      onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Time *
                    </label>
                    <input
                      type="time"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                      value={form.time}
                      onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                    />
                  </div>
                </div>

                <label className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Seats available *
                </label>
                <input
                  type="number" min={1} max={8}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  value={form.seatsAvailable}
                  onChange={e => setForm(p => ({ ...p, seatsAvailable: Number(e.target.value) }))}
                />

                {/* Ride preferences */}
                <div className="mt-3 p-3 rounded-xl border border-white/10 bg-white/5">
                  <p className="text-xs text-gray-400 mb-2 font-medium">Ride preferences</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { field: 'allowSmoking', label: 'Smoking OK',  icon: <Cigarette     className="w-3.5 h-3.5" /> },
                      { field: 'allowPets',    label: 'Pets OK',     icon: <PawPrint      className="w-3.5 h-3.5" /> },
                      { field: 'musicOk',      label: 'Music OK',    icon: <Music         className="w-3.5 h-3.5" /> },
                      { field: 'chatty',       label: 'Chatty ride', icon: <MessageCircle className="w-3.5 h-3.5" /> },
                    ] as const).map(({ field, label, icon }) => (
                      <button
                        key={field}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, [field]: !p[field as keyof typeof p] }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                          (form as any)[field]
                            ? 'bg-indigo-600/30 border-indigo-500/40 text-indigo-300'
                            : 'bg-white/5 border-white/10 text-gray-500'
                        }`}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm disabled:opacity-50"
                  disabled={!canSubmit || loading}
                >
                  Offer Ride
                </button>

                {!isAuthenticated && (
                  <p className="text-xs text-gray-500 mt-1">Sign in to offer or request rides.</p>
                )}
              </form>
            </div>

            {/* ── Available rides ────────────────────────────────────────────── */}
            <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Available rides</h2>
                {activeFilterCount > 0 && (
                  <span className="text-xs text-indigo-400 bg-indigo-600/20 border border-indigo-500/30 px-2 py-1 rounded-lg">
                    {rides.length} match{rides.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="text-sm text-gray-400">Loading rides…</div>
              ) : rides.length === 0 ? (
                <div className="text-sm text-gray-400">
                  {activeFilterCount > 0 ? 'No rides match your current filters.' : 'No rides yet. Be the first to offer one!'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {rides.map(r => {
                    const isOpen           = r.status === 'OPEN' && r.seats_available > 0;
                    const alreadyRequested = requestedRideIds.has(r.id);
                    const score            = prefMatchScore(r, filters);
                    const rp               = r.ridePreferences;

                    return (
                      <div key={r.id} className="p-4 border border-white/10 rounded-2xl hover:border-white/20 transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => setSelectedRide(r)}
                              className="font-semibold text-sm text-left hover:text-indigo-300 transition-colors w-full leading-snug"
                            >
                              {r.departure} <span className="text-gray-500">→</span> {r.destination}
                              <span className="ml-1 text-[10px] text-indigo-400">(tap for details)</span>
                            </button>

                            <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {fmtDate(r.departure_datetime)} {fmtTime(r.departure_datetime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {r.seats_available} seat{r.seats_available !== 1 ? 's' : ''}
                              </span>
                              <span className="text-gray-500">
                              Driver: {r.creator.name}
                              {r.creator.avg_driver_rating != null && (
                                <span className="ml-1 text-amber-400">
                                  ★ {r.creator.avg_driver_rating.toFixed(1)}
                                  <span className="text-gray-600 text-[10px]"> ({r.creator.total_ratings})</span>
                                </span>
                              )}
                            </span>
                            </div>

                            {/* Preference tags */}
                            {rp && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {rp.allowSmoking && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400 border border-amber-500/20 flex items-center gap-0.5"><Cigarette className="w-2.5 h-2.5" /> Smoking OK</span>}
                                {rp.allowPets    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5"><PawPrint className="w-2.5 h-2.5" /> Pets OK</span>}
                                {rp.musicOk      && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center gap-0.5"><Music className="w-2.5 h-2.5" /> Music</span>}
                                {rp.chatty       && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/20 flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> Chatty</span>}
                              </div>
                            )}

                            {/* Match score */}
                            {activeFilterCount > 0 && score > 0 && (
                              <div className="mt-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/25 text-indigo-300 border border-indigo-500/30">
                                  ✓ {score}/{activeFilterCount} preference{activeFilterCount !== 1 ? 's' : ''} match
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Request button */}
                          <button
                            onClick={() => requestRide(r)}
                            disabled={!isOpen || alreadyRequested}
                            className={`shrink-0 px-3 py-1.5 rounded-xl text-sm transition-all border ${
                              alreadyRequested
                                ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400 cursor-default'
                                : !isOpen
                                  ? 'border-white/10 text-gray-500 opacity-40 cursor-default'
                                  : 'border-white/10 text-gray-200 hover:bg-white/5'
                            }`}
                          >
                            {alreadyRequested
                              ? <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Requested</span>
                              : isOpen ? 'Request' : r.status === 'FULL' ? 'Full' : r.status}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ride Detail Modal ─────────────────────────────────────────────────── */}
      {selectedRide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedRide(null)} />
          <div className="relative w-full max-w-md bg-[#141518] border border-white/15 rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">Ride Details</h2>
              <button onClick={() => setSelectedRide(null)} className="p-2 rounded-xl hover:bg-white/10 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider">From</p>
                <p className="text-white font-semibold break-words">{selectedRide.departure}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider">To</p>
                <p className="text-white font-semibold break-words">{selectedRide.destination}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-gray-500 mb-1">Date & Time</p>
                  <p className="text-sm text-white font-medium">{fmtDate(selectedRide.departure_datetime)}</p>
                  <p className="text-sm text-indigo-300">{fmtTime(selectedRide.departure_datetime)}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-gray-500 mb-1">Availability</p>
                  <p className="text-sm text-white font-medium">
                    {selectedRide.seats_available} seat{selectedRide.seats_available !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-400">{selectedRide.status}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-gray-500 mb-1">Driver</p>
                <p className="text-sm text-white font-medium">{selectedRide.creator.name}</p>
                {selectedRide.creator.avg_driver_rating != null && (
                  <div className="flex items-center gap-1 mt-1">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className="text-base leading-none"
                        style={{color: s <= Math.round(selectedRide.creator.avg_driver_rating!) ? '#f59e0b' : '#374151'}}>
                        ★
                      </span>
                    ))}
                    <span className="text-xs text-gray-400 ml-1">
                      {selectedRide.creator.avg_driver_rating.toFixed(1)} ({selectedRide.creator.total_ratings} ratings)
                    </span>
                  </div>
                )}
              </div>

              {selectedRide.ridePreferences && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Ride Preferences</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRide.ridePreferences.allowSmoking
                      ? <span className="text-xs px-2 py-1 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/20 flex items-center gap-1"><Cigarette className="w-3 h-3" /> Smoking OK</span>
                      : <span className="text-xs px-2 py-1 rounded-lg bg-gray-600/20 text-gray-400 border border-gray-500/20">No smoking</span>}
                    {selectedRide.ridePreferences.allowPets
                      ? <span className="text-xs px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><PawPrint className="w-3 h-3" /> Pets OK</span>
                      : <span className="text-xs px-2 py-1 rounded-lg bg-gray-600/20 text-gray-400 border border-gray-500/20">No pets</span>}
                    {selectedRide.ridePreferences.musicOk
                      ? <span className="text-xs px-2 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center gap-1"><Music className="w-3 h-3" /> Music OK</span>
                      : <span className="text-xs px-2 py-1 rounded-lg bg-gray-600/20 text-gray-400 border border-gray-500/20">No music</span>}
                    {selectedRide.ridePreferences.chatty
                      ? <span className="text-xs px-2 py-1 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/20 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Chatty</span>
                      : <span className="text-xs px-2 py-1 rounded-lg bg-gray-600/20 text-gray-400 border border-gray-500/20">Quiet ride</span>}
                  </div>
                </div>
              )}

              <button
                onClick={() => { requestRide(selectedRide); setSelectedRide(null); }}
                disabled={
                  selectedRide.status !== 'OPEN' ||
                  selectedRide.seats_available === 0 ||
                  requestedRideIds.has(selectedRide.id)
                }
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {requestedRideIds.has(selectedRide.id) ? (
                  <><CheckCircle className="w-4 h-4" /> Already requested</>
                ) : selectedRide.status === 'OPEN' && selectedRide.seats_available > 0 ? (
                  'Request this ride'
                ) : (
                  'Not available'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CarpoolScreen;
