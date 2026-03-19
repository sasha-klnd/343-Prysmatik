import { useState } from 'react';
import { X, Bike, Bus, Users, Footprints, Car, CheckCircle, Leaf, DollarSign } from 'lucide-react';
import { apiFetch } from '@/api/client';

interface LogTripModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  isAuthenticated: boolean;
  onRequireAuth:   () => void;
  defaultMode?:    'bike' | 'transit' | 'carpool' | 'walking' | 'car';
}

const MODES = [
  { key: 'bike',    label: 'BIXI / Bike',   icon: Bike,      color: 'from-emerald-600 to-green-600',  border: 'border-emerald-500/40' },
  { key: 'transit', label: 'Public Transit', icon: Bus,       color: 'from-blue-600 to-indigo-600',    border: 'border-blue-500/40'    },
  { key: 'carpool', label: 'Carpool',        icon: Users,     color: 'from-amber-600 to-orange-600',   border: 'border-amber-500/40'   },
  { key: 'walking', label: 'Walking',        icon: Footprints,color: 'from-cyan-600 to-teal-600',      border: 'border-cyan-500/40'    },
  { key: 'car',     label: 'Personal Car',   icon: Car,       color: 'from-purple-600 to-pink-600',    border: 'border-purple-500/40'  },
] as const;

type Mode = typeof MODES[number]['key'];

// Typical Montréal trip distance presets
const DISTANCE_PRESETS = [
  { label: 'Short (2 km)',   value: 2   },
  { label: 'Medium (5 km)',  value: 5   },
  { label: 'Long (10 km)',   value: 10  },
  { label: 'Custom',         value: 0   },
];

interface TripResult {
  co2_saved_vs_car:   number;
  money_saved_vs_car: number;
  co2_kg:             number;
  cost_cad:           number;
}

export function LogTripModal({
  isOpen, onClose, isAuthenticated, onRequireAuth, defaultMode = 'bike'
}: LogTripModalProps) {
  const [mode,         setMode]         = useState<Mode>(defaultMode);
  const [distPreset,   setDistPreset]   = useState<number>(5);
  const [customDist,   setCustomDist]   = useState('');
  const [isCustom,     setIsCustom]     = useState(false);
  const [note,         setNote]         = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [result,       setResult]       = useState<TripResult | null>(null);

  if (!isOpen) return null;

  const distance = isCustom ? parseFloat(customDist) || 0 : distPreset;

  const handleLog = async () => {
    if (!isAuthenticated) { onRequireAuth(); return; }
    if (distance <= 0)    { setError('Please select or enter a distance.'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/trips/log', {
        method: 'POST',
        body: JSON.stringify({ mode, distance_km: distance, note: note || undefined }),
      });
      setResult(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to log trip');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    setNote('');
    setIsCustom(false);
    setCustomDist('');
    setDistPreset(5);
    setMode(defaultMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#141518] border border-white/15 rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Log a trip</h2>
            <p className="text-xs text-gray-400 mt-0.5">Track your real impact on CO₂ and cost</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Success state */}
          {result ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Trip logged!</h3>
              <p className="text-sm text-gray-400 mb-5">Your impact has been recorded.</p>

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

              <button
                onClick={handleClose}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm transition-all hover:opacity-90"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Mode selector */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Transport mode</p>
                <div className="grid grid-cols-5 gap-2">
                  {MODES.map(({ key, label, icon: Icon, color, border }) => (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                        mode === key
                          ? `bg-gradient-to-br ${color} bg-opacity-20 ${border} border opacity-100`
                          : 'border-white/10 bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${color}`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[10px] text-white text-center leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Distance */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Distance</p>
                <div className="grid grid-cols-4 gap-2">
                  {DISTANCE_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        if (preset.value === 0) {
                          setIsCustom(true);
                        } else {
                          setIsCustom(false);
                          setDistPreset(preset.value);
                        }
                      }}
                      className={`py-2 px-1 rounded-xl border text-xs transition-all ${
                        (preset.value === 0 ? isCustom : !isCustom && distPreset === preset.value)
                          ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {isCustom && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0.1"
                      max="500"
                      step="0.1"
                      placeholder="e.g. 7.5"
                      value={customDist}
                      onChange={e => setCustomDist(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                    />
                    <span className="text-sm text-gray-400">km</span>
                  </div>
                )}
              </div>

              {/* Optional note */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Note (optional)</p>
                <input
                  type="text"
                  placeholder="e.g. McGill to Plateau"
                  value={note}
                  maxLength={100}
                  onChange={e => setNote(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-600/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              {/* Preview */}
              {distance > 0 && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 flex items-center justify-between">
                  <span>
                    {MODES.find(m => m.key === mode)?.label} · {distance} km
                  </span>
                  <span className="text-gray-500">Impact will be calculated on save</span>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleLog}
                disabled={loading || distance <= 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? 'Logging…' : 'Log this trip'}
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
