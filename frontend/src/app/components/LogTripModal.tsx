import { useState } from 'react';
import { X, Bike, Bus, Footprints, Car, CheckCircle, Leaf, DollarSign, MapPin, ArrowRight, Loader } from 'lucide-react';
import { apiFetch } from '@/api/client';

interface LogTripModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  isAuthenticated: boolean;
  onRequireAuth:   () => void;
  defaultMode?:    'bike' | 'transit' | 'walking' | 'car';
  prefillFrom?:    string;
  prefillTo?:      string;
}

// Carpool is intentionally excluded — those trips are auto-logged when booking approved
const MODES = [
  { key: 'bike',    label: 'BIXI / Bike',    icon: Bike,       color: 'from-emerald-600 to-green-600', border: 'border-emerald-500/40' },
  { key: 'transit', label: 'Public Transit', icon: Bus,        color: 'from-blue-600 to-indigo-600',   border: 'border-blue-500/40'    },
  { key: 'walking', label: 'Walking',         icon: Footprints, color: 'from-cyan-600 to-teal-600',     border: 'border-cyan-500/40'    },
  { key: 'car',     label: 'Personal Car',   icon: Car,        color: 'from-purple-600 to-pink-600',   border: 'border-purple-500/40'  },
] as const;

type Mode = typeof MODES[number]['key'];

interface RoutePreview {
  distance_km:      number;
  co2_kg:           number;
  co2_saved_kg:     number;
  cost_cad:         number;
  money_saved_cad:  number;
}

interface TripResult {
  co2_saved_vs_car:   number;
  money_saved_vs_car: number;
  co2_kg:             number;
  cost_cad:           number;
}

export function LogTripModal({
  isOpen, onClose, isAuthenticated, onRequireAuth,
  defaultMode = 'transit', prefillFrom = '', prefillTo = ''
}: LogTripModalProps) {
  const [mode,     setMode]     = useState<Mode>(defaultMode);
  const [from,     setFrom]     = useState(prefillFrom);
  const [to,       setTo]       = useState(prefillTo);
  const [note,     setNote]     = useState('');
  const [preview,  setPreview]  = useState<RoutePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [logging,  setLogging]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<TripResult | null>(null);

  if (!isOpen) return null;

  const handlePreview = async () => {
    if (!from.trim() || !to.trim()) {
      setPreviewError('Please enter both origin and destination.');
      return;
    }
    setPreviewing(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const data = await apiFetch(
        `/calculate/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}`
      );
      setPreview(data);
    } catch (e: any) {
      setPreviewError(e?.message || 'Could not calculate route. Try adding "Montréal" to your address.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleLog = async () => {
    if (!isAuthenticated) { onRequireAuth(); return; }
    if (!preview) { setError('Please calculate the route first.'); return; }

    setLogging(true);
    setError(null);
    try {
      const res = await apiFetch('/trips/log', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          distance_km: preview.distance_km,
          note: note || `${from} → ${to}`,
        }),
      });
      setResult(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to log trip');
    } finally {
      setLogging(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    setPreview(null);
    setPreviewError(null);
    setNote('');
    setFrom(prefillFrom);
    setTo(prefillTo);
    setMode(defaultMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-[#141518] border border-white/15 rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Log a trip</h2>
            <p className="text-xs text-gray-400 mt-0.5">Track your real CO₂ and cost impact</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Success state */}
          {result ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Trip logged!</h3>
              <p className="text-sm text-gray-400 mb-5">Your impact has been recorded in your profile.</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-4 rounded-2xl bg-emerald-600/10 border border-emerald-500/20">
                  <div className="flex items-center gap-1.5 justify-center mb-1">
                    <Leaf className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400">CO₂ saved</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-300">
                    {result.co2_saved_vs_car >= 0
                      ? `+${result.co2_saved_vs_car.toFixed(2)} kg`
                      : `${result.co2_saved_vs_car.toFixed(2)} kg`}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">vs solo car</div>
                </div>
                <div className="p-4 rounded-2xl bg-green-600/10 border border-green-500/20">
                  <div className="flex items-center gap-1.5 justify-center mb-1">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">Money saved</span>
                  </div>
                  <div className="text-2xl font-bold text-green-300">
                    {result.money_saved_vs_car >= 0
                      ? `+$${result.money_saved_vs_car.toFixed(2)}`
                      : `-$${Math.abs(result.money_saved_vs_car).toFixed(2)}`}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">vs solo car</div>
                </div>
              </div>

              <button onClick={handleClose}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 transition-all">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Mode selector — no carpool (auto-logged) */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Transport mode</p>
                <p className="text-xs text-gray-500 mb-3">
                  🚗 Carpool trips are logged automatically when your booking is approved.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MODES.map(({ key, label, icon: Icon, color, border }) => (
                    <button key={key} onClick={() => { setMode(key); setPreview(null); }}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                        mode === key
                          ? `bg-gradient-to-br ${color} bg-opacity-20 ${border} border opacity-100`
                          : 'border-white/10 bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100'
                      }`}>
                      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${color}`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[10px] text-white text-center leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* From / To */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Route</p>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="From (e.g. McGill University)"
                    value={from}
                    onChange={e => { setFrom(e.target.value); setPreview(null); }}
                    className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div className="flex justify-center">
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="To (e.g. Plateau-Mont-Royal)"
                    value={to}
                    onChange={e => { setTo(e.target.value); setPreview(null); }}
                    className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <button
                  onClick={handlePreview}
                  disabled={previewing || !from.trim() || !to.trim()}
                  className="w-full py-2 rounded-xl bg-white/10 border border-white/10 text-sm text-gray-300 hover:bg-white/15 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  {previewing ? <><Loader className="w-4 h-4 animate-spin" /> Calculating…</> : 'Calculate route'}
                </button>
              </div>

              {previewError && (
                <p className="text-sm text-amber-400 bg-amber-600/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  {previewError}
                </p>
              )}

              {/* Route preview */}
              {preview && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Distance</span>
                    <span className="text-white font-semibold">{preview.distance_km} km</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Trip cost</span>
                    <span className="text-white font-semibold">${preview.cost_cad.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">CO₂ emitted</span>
                    <span className="text-white font-semibold">{preview.co2_kg.toFixed(3)} kg</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm">
                    <span className="text-emerald-400">CO₂ saved vs car</span>
                    <span className="text-emerald-300 font-bold">+{preview.co2_saved_kg.toFixed(2)} kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">Money saved vs car</span>
                    <span className="text-green-300 font-bold">
                      {preview.money_saved_cad >= 0 ? '+' : ''}${preview.money_saved_cad.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Optional note */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Note (optional)</p>
                <input
                  type="text"
                  placeholder="e.g. Morning commute"
                  value={note}
                  maxLength={100}
                  onChange={e => setNote(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-600/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
              )}

              <button
                onClick={handleLog}
                disabled={logging || !preview}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {logging ? <><Loader className="w-4 h-4 animate-spin" /> Logging…</> : 'Log this trip'}
              </button>

              {!isAuthenticated && (
                <p className="text-xs text-center text-gray-500">You need to sign in to log trips.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
