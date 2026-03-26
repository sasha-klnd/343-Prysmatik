import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Calendar, ChevronLeft, Clock, CreditCard, DollarSign, MapPin, Users,
  SlidersHorizontal, Cigarette, PawPrint, Music, MessageCircle, X
} from 'lucide-react';
import { apiFetch } from '@/api/client';

type Props = {
  onBack: () => void;
  isAuthenticated: boolean;
  onRequireAuth: (action: string) => void;
};

type SafeUser = { id: number; name: string; created_at?: string };

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
  price_per_seat_cad?: number | null;
};

type MyBooking = {
  id: number;
  ride_post_id: number;
  status: string;
  payment_status?: string;
  amount_due_cad?: number | null;
  paid_at?: string | null;
  seats_requested: number;
  created_at: string;
};

type MyRequestedRow = { booking: MyBooking; ride: Ride };

function fmtDate(iso: string) { return new Date(iso).toISOString().slice(0, 10); }
function fmtTime(iso: string) { return new Date(iso).toTimeString().slice(0, 5); }

// How many of the user's pref tags match the ride?
function prefMatchScore(ride: Ride, filters: ActiveFilters): number {
  if (!ride.ridePreferences) return 0;
  const rp = ride.ridePreferences;
  let score = 0;
  if (filters.noSmoking && !rp.allowSmoking) score++;
  if (filters.petsOk    && rp.allowPets)     score++;
  if (filters.musicOk   && rp.musicOk)       score++;
  return score;
}

interface ActiveFilters {
  noSmoking: boolean;
  petsOk:    boolean;
  musicOk:   boolean;
}

const PREF_TAGS: { key: keyof ActiveFilters; label: string; icon: React.ReactNode; queryKey: string }[] = [
  { key: 'noSmoking', label: 'No smoking', icon: <Cigarette className="w-3.5 h-3.5" />, queryKey: 'no_smoking' },
  { key: 'petsOk',    label: 'Pets OK',    icon: <PawPrint  className="w-3.5 h-3.5" />, queryKey: 'pets_ok'    },
  { key: 'musicOk',   label: 'Music OK',   icon: <Music      className="w-3.5 h-3.5" />, queryKey: 'music_ok'   },
];

export function CarpoolScreen({ onBack, isAuthenticated, onRequireAuth }: Props) {
  const [rides,   setRides]   = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [myRequested, setMyRequested] = useState<MyRequestedRow[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);

  const [filters, setFilters] = useState<ActiveFilters>({
    noSmoking: false,
    petsOk:    false,
    musicOk:   false,
  });

  // Offer form
  const [form, setForm] = useState({
    departure:       '',
    destination:     '',
    date:            '',
    time:            '',
    seatsAvailable:  1,
    meetupAddress:   '',
    pricePerSeatCad: '' as string | number,
    // Ride preferences
    allowSmoking:    false,
    allowPets:       false,
    musicOk:         true,
    chatty:          true,
  });

  const canSubmit = useMemo(() => (
    form.departure.trim().length > 0 &&
    form.destination.trim().length > 0 &&
    form.date.trim().length > 0 &&
    form.time.trim().length > 0 &&
    Number.isFinite(form.seatsAvailable) &&
    form.seatsAvailable >= 1 &&
    form.seatsAvailable <= 8
  ), [form]);

  // Build query string from active filters
  const buildQueryString = (f: ActiveFilters) => {
    const params = new URLSearchParams();
    if (f.noSmoking) params.set('no_smoking', '1');
    if (f.petsOk)    params.set('pets_ok',    '1');
    if (f.musicOk)   params.set('music_ok',   '1');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const loadRides = async (f: ActiveFilters = filters) => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch(`/rides${buildQueryString(f)}`);
      setRides(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRides(); }, []);

  const loadMyRequested = async () => {
    if (!isAuthenticated) {
      setMyRequested([]);
      return;
    }
    try {
      setLoadingMine(true);
      const data = await apiFetch('/rides/mine/requested');
      setMyRequested(Array.isArray(data) ? data : []);
    } catch {
      setMyRequested([]);
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    loadMyRequested();
  }, [isAuthenticated]);

  const toggleFilter = (key: keyof ActiveFilters) => {
    const next = { ...filters, [key]: !filters[key] };
    setFilters(next);
    loadRides(next);
  };

  const offerRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return onRequireAuth('offer a ride');
    if (!canSubmit) { setError('Please fill all required fields.'); return; }

    const dt = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(dt.getTime())) { setError('Invalid date or time.'); return; }
    if (dt < new Date()) { setError('You cannot offer a ride in the past.'); return; }

    try {
      setError(null);
      const rawPrice = String(form.pricePerSeatCad).trim();
      const payload: Record<string, unknown> = {
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
      };
      if (rawPrice !== '') {
        const n = Number(rawPrice);
        if (!Number.isFinite(n) || n < 0) {
          setError('Price per seat must be a non-negative number.');
          return;
        }
        payload.pricePerSeatCad = n;
      }
      await apiFetch('/rides', { method: 'POST', body: JSON.stringify(payload) });
      setForm({ departure: '', destination: '', date: '', time: '', seatsAvailable: 1, meetupAddress: '', pricePerSeatCad: '', allowSmoking: false, allowPets: false, musicOk: true, chatty: true });
      await loadRides();
    } catch (e: any) {
      setError(e?.message || 'Failed to post ride');
    }
  };

  const requestRide = async (ride: Ride) => {
    if (!isAuthenticated) return onRequireAuth('request a ride');
    if (ride.status !== 'OPEN' || ride.seats_available <= 0) { setError('This ride is not open.'); return; }
    try {
      setError(null);
      await apiFetch(`/rides/${ride.id}/request`, { method: 'POST', body: JSON.stringify({ seats_requested: 1 }) });
      await loadRides();
      await loadMyRequested();
      alert('Request sent! The driver will review it.');
    } catch (e: any) {
      setError(e?.message || 'Failed to request ride');
    }
  };

  const payBooking = async (bookingId: number) => {
    if (!isAuthenticated) return onRequireAuth('complete payment');
    try {
      setError(null);
      setPayingId(bookingId);
      await apiFetch(`/rides/bookings/${bookingId}/pay`, { method: 'POST' });
      await loadMyRequested();
      await loadRides();
      alert('Payment completed — your seat is confirmed.');
    } catch (e: any) {
      setError(e?.message || 'Payment failed');
    } finally {
      setPayingId(null);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const awaitingPay = myRequested.filter(
    (row) => row.booking.status === 'AWAITING_PAYMENT' && row.booking.payment_status === 'PENDING'
  );
  const otherActive = myRequested.filter(
    (row) =>
      row.booking.status === 'PENDING' ||
      row.booking.status === 'ACCEPTED'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0b1020] to-[#110a1a] text-white">
      <div className="max-w-5xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-gray-200 hover:bg-white/5">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold">Carpool</h1>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`ml-auto flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
              activeFilterCount > 0
                ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300'
                : 'border-white/10 text-gray-400 hover:bg-white/5'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters {activeFilterCount > 0 && <span className="bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">{activeFilterCount}</span>}
          </button>

          <button onClick={() => loadRides()} className="px-3 py-2 rounded-xl border border-white/10 text-gray-200 hover:bg-white/5 text-sm">
            Refresh
          </button>
        </div>

        {/* Preference filter panel (Issue 9) */}
        {showFilters && (
          <div className="mb-5 p-4 rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-200">Filter by ride preferences</h3>
              <button onClick={() => { const reset = { noSmoking: false, petsOk: false, musicOk: false }; setFilters(reset); loadRides(reset); }} className="text-xs text-gray-400 hover:text-gray-200">
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

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-600/10 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-300 mt-0.5 shrink-0" />
            <div className="text-sm text-red-200 flex-1">{error}</div>
            <button onClick={() => setError(null)}><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        {/* How paid carpool works */}
        <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-indigo-950/30">
          <p className="text-sm text-gray-200">
            <span className="font-semibold text-indigo-300">Payments: </span>
            Set a <strong className="text-white">price per seat</strong> when you offer a ride (or leave it free).
            After a driver <strong className="text-white">approves</strong> a paid ride, complete payment below or in <strong className="text-white">My Rides</strong>.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── Offer a ride form ─────────────────────────────────────── */}
          <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
            <h2 className="font-semibold mb-4">Offer a ride</h2>
            <form onSubmit={offerRide} className="grid gap-2">

              <label className="text-xs text-gray-400">Departure *</label>
              <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="e.g. Downtown Montréal"
                value={form.departure} onChange={e => setForm(p => ({ ...p, departure: e.target.value }))} />

              <label className="text-xs text-gray-400 mt-1">Destination *</label>
              <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="e.g. Concordia University"
                value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} />

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <label className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date *</label>
                  <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                    value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Time *</label>
                  <input type="time" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                    value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
                </div>
              </div>

              <label className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> Seats available *</label>
              <input type="number" min={1} max={8} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                value={form.seatsAvailable} onChange={e => setForm(p => ({ ...p, seatsAvailable: Number(e.target.value) }))} />

              <label className="text-xs text-gray-400 mt-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Price per seat (CAD)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="0 = free"
                value={form.pricePerSeatCad}
                onChange={e => setForm(p => ({ ...p, pricePerSeatCad: e.target.value }))}
              />
              <p className="text-[10px] text-gray-500">Leave empty or 0 for a free ride. Passengers pay after you approve their request.</p>

              {/* Issue 8: ride preferences on the offer form */}
              <div className="mt-3 p-3 rounded-xl border border-white/10 bg-white/5">
                <p className="text-xs text-gray-400 mb-2 font-medium">Ride preferences</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { field: 'allowSmoking', label: 'Smoking OK',  icon: <Cigarette className="w-3.5 h-3.5" /> },
                    { field: 'allowPets',    label: 'Pets OK',      icon: <PawPrint  className="w-3.5 h-3.5" /> },
                    { field: 'musicOk',      label: 'Music OK',    icon: <Music      className="w-3.5 h-3.5" /> },
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

          {/* ── Available rides ───────────────────────────────────────── */}
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
                {rides.map((r) => {
                  const isOpen = r.status === 'OPEN' && r.seats_available > 0;
                  const score = prefMatchScore(r, filters);
                  const rp = r.ridePreferences;

                  return (
                    <div key={r.id} className="p-4 border border-white/10 rounded-2xl hover:border-white/20 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate">
                            {r.departure} → {r.destination}
                          </div>
                          <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {fmtDate(r.departure_datetime)} {fmtTime(r.departure_datetime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {r.seats_available} seat{r.seats_available !== 1 ? 's' : ''}
                            </span>
                            {r.price_per_seat_cad != null && r.price_per_seat_cad > 0 ? (
                              <span className="flex items-center gap-1 text-amber-300/90">
                                <DollarSign className="w-3 h-3" /> {Number(r.price_per_seat_cad).toFixed(2)} / seat
                              </span>
                            ) : (
                              <span className="text-emerald-400/90 text-[11px]">Free</span>
                            )}
                            <span className="text-gray-500">Driver: {r.creator.name}</span>
                          </div>

                          {/* Ride preference tags (Issue 9 — match score) */}
                          {rp && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {rp.allowSmoking && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400 border border-amber-500/20 flex items-center gap-0.5"><Cigarette className="w-2.5 h-2.5" /> Smoking OK</span>}
                              {rp.allowPets    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5"><PawPrint className="w-2.5 h-2.5" /> Pets OK</span>}
                              {rp.musicOk      && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center gap-0.5"><Music className="w-2.5 h-2.5" /> Music</span>}
                              {rp.chatty       && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/20 flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> Chatty</span>}
                            </div>
                          )}

                          {/* Match score badge (Issue 9) */}
                          {activeFilterCount > 0 && score > 0 && (
                            <div className="mt-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/25 text-indigo-300 border border-indigo-500/30">
                                ✓ {score}/{activeFilterCount} preference{activeFilterCount !== 1 ? 's' : ''} match
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => requestRide(r)}
                          disabled={!isOpen}
                          className="shrink-0 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 disabled:opacity-40 text-sm transition-all"
                        >
                          {isOpen ? 'Request' : r.status === 'FULL' ? 'Full' : r.status}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Your requests & pay (same flow as My Rides, surfaced here) */}
        {isAuthenticated && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                Your requests &amp; payment
              </h2>
              <button
                type="button"
                onClick={() => loadMyRequested()}
                className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5"
              >
                {loadingMine ? 'Loading…' : 'Refresh status'}
              </button>
            </div>

            {awaitingPay.length > 0 && (
              <div className="p-4 rounded-2xl border border-amber-500/35 bg-amber-950/25 space-y-3">
                <p className="text-xs font-medium text-amber-200/90 uppercase tracking-wide">Payment required</p>
                {awaitingPay.map(({ booking: b, ride: r }) => (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-amber-500/25 bg-black/20"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">
                        {r.departure} → {r.destination}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {fmtDate(r.departure_datetime)} {fmtTime(r.departure_datetime)} · {b.seats_requested} seat{b.seats_requested !== 1 ? 's' : ''}
                      </div>
                      {b.amount_due_cad != null && (
                        <div className="text-sm text-amber-200 mt-2">
                          Amount due:{' '}
                          <span className="font-bold">${Number(b.amount_due_cad).toFixed(2)} CAD</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => payBooking(b.id)}
                      disabled={payingId === b.id}
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4" />
                      {payingId === b.id ? 'Processing…' : 'Pay now (demo)'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {otherActive.length > 0 && (
              <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-xs text-gray-400 mb-3">Other active requests</p>
                <ul className="space-y-2 text-sm">
                  {otherActive.slice(0, 8).map(({ booking: b, ride: r }) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-gray-300 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <span className="truncate">
                        {r.departure} → {r.destination}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {b.status === 'PENDING' && 'Waiting for driver'}
                        {b.status === 'ACCEPTED' &&
                          (b.payment_status === 'PAID' ? 'Paid — confirmed' : 'Confirmed (free ride)')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!loadingMine && awaitingPay.length === 0 && otherActive.length === 0 && (
              <p className="text-sm text-gray-500 px-1">
                You have no open carpool requests. Request a seat above — if it&apos;s a paid ride, a <strong className="text-gray-400">Pay now</strong> button will appear here after the driver approves.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CarpoolScreen;
