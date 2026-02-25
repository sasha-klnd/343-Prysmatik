import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, ChevronLeft, Clock, MapPin, Users } from 'lucide-react';
import { apiFetch } from '@/api/client';

type Props = {
  onBack: () => void;
  isAuthenticated: boolean;
  onRequireAuth: (action: string) => void;
};

type SafeUser = { id: number; name: string; created_at?: string };

type Ride = {
  id: number;
  departure: string;
  destination: string;
  departure_datetime: string; // ISO string
  seats_available: number;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
  creator: SafeUser;
  requests_count?: number;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

export function CarpoolScreen({ onBack, isAuthenticated, onRequireAuth }: Props) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    departure: '',
    destination: '',
    date: '',
    time: '',
    seatsAvailable: 1,
  });

  const canSubmit = useMemo(() => {
    return (
      form.departure.trim().length > 0 &&
      form.destination.trim().length > 0 &&
      form.date.trim().length > 0 &&
      form.time.trim().length > 0 &&
      Number.isFinite(form.seatsAvailable) &&
      form.seatsAvailable >= 1 &&
      form.seatsAvailable <= 8
    );
  }, [form]);

  const loadRides = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch('/rides');
      setRides(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRides();
  }, []);

  const offerRide = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) return onRequireAuth("offer a ride");

    if (!canSubmit) {
      setError(
        "Please fill out departure, destination, date, time, and a valid seat count (1–8)."
      );
      return;
    }

    // ✅ Validate date/time
    const dt = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(dt.getTime())) {
      setError("Invalid date or time.");
      return;
    }

    if (dt < new Date()) {
      setError("You cannot offer a ride in the past.");
      return;
    }

    try {
      setError(null);

      await apiFetch("/rides", {
        method: "POST",
        body: JSON.stringify({
          departure: form.departure.trim(),
          destination: form.destination.trim(),
          date: form.date,
          time: form.time,
          seats_available: form.seatsAvailable, // ✅ snake_case for backend
        }),
      });

      setForm({
        departure: "",
        destination: "",
        date: "",
        time: "",
        seatsAvailable: 1,
      });

      await loadRides();
    } catch (e: any) {
      setError(e?.message || "Failed to post ride");
    }
  };

  const requestRide = async (ride: Ride) => {
    if (!isAuthenticated) return onRequireAuth('request a ride');

    if (ride.status !== 'OPEN' || ride.seats_available <= 0) {
      setError('This ride is not currently open for requests.');
      return;
    }

    try {
      setError(null);
      await apiFetch(`/rides/${ride.id}/request`, {
        method: 'POST',
        body: JSON.stringify({ seats_requested: 1 }),
      });
      await loadRides();
      alert('Request sent!');
    } catch (e: any) {
      setError(e?.message || 'Failed to request ride');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0b1020] to-[#110a1a] text-white">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-gray-200 hover:bg-white/5"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold">Carpool</h1>
          <button
            onClick={loadRides}
            className="ml-auto px-3 py-2 rounded-xl border border-white/10 text-gray-200 hover:bg-white/5"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-600/10 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-300 mt-0.5" />
            <div className="text-sm text-red-200">{error}</div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
            <h2 className="font-semibold mb-3">Offer a ride</h2>
            <form onSubmit={offerRide} className="grid gap-2">
              <label className="text-xs text-gray-300">Departure</label>
              <input
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                placeholder="e.g., Downtown"
                value={form.departure}
                onChange={(e) => setForm((p) => ({ ...p, departure: e.target.value }))}
              />

              <label className="text-xs text-gray-300 mt-2">Destination</label>
              <input
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                placeholder="e.g., Concordia"
                value={form.destination}
                onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs text-gray-300 flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Time
                  </label>
                  <input
                    type="time"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                    value={form.time}
                    onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                  />
                </div>
              </div>

              <label className="text-xs text-gray-300 mt-2 flex items-center gap-1">
                <Users className="w-4 h-4" /> Seats available
              </label>
              <input
                type="number"
                min={1}
                max={8}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                value={form.seatsAvailable}
                onChange={(e) => setForm((p) => ({ ...p, seatsAvailable: Number(e.target.value) }))}
              />

              <button
                className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-50"
                disabled={!canSubmit || loading}
              >
                Offer Ride
              </button>

              {!isAuthenticated && (
                <p className="text-xs text-gray-400 mt-2">
                  You can browse rides while logged out, but you need to sign in to offer or request.
                </p>
              )}
            </form>
          </div>

          <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
            <h2 className="font-semibold mb-3">Available rides</h2>

            {loading ? (
              <div className="text-sm text-gray-300">Loading…</div>
            ) : rides.length === 0 ? (
              <div className="text-sm text-gray-300">No rides yet. Be the first to offer one.</div>
            ) : (
              <div className="space-y-3">
                {rides.map((r) => {
                  const isOpen = r.status === 'OPEN' && r.seats_available > 0;
                  return (
                    <div key={r.id} className="p-4 border border-white/10 rounded-2xl flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {r.departure} → {r.destination}
                        </div>
                        <div className="mt-1 text-sm text-gray-300 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {fmtDate(r.departure_datetime)} {fmtTime(r.departure_datetime)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            Seats: {r.seats_available}
                          </span>
                          <span className="text-gray-400">
                            Driver: {r.creator.name} (#{r.creator.id})
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => requestRide(r)}
                        disabled={!isOpen}
                        className="shrink-0 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        {isOpen ? 'Request' : r.status === 'FULL' ? 'Full' : r.status}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CarpoolScreen;
