import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bus, Bike, Car, Footprints, Users, Sparkles, ChevronRight,
  MapPin, DollarSign, Accessibility, Cigarette, PawPrint, Music, MessageCircle, Zap
} from 'lucide-react';
import { apiFetch } from '@/api/client';

interface OnboardingScreenProps {
  onComplete: () => void;
  userName: string;
}

type Step = 'modes' | 'walking' | 'budget' | 'accessibility' | 'carpool';

const STEPS: Step[] = ['modes', 'walking', 'budget', 'accessibility', 'carpool'];

const STEP_LABELS: Record<Step, string> = {
  modes:         'Transport modes',
  walking:       'Walking distance',
  budget:        'Budget sensitivity',
  accessibility: 'Accessibility',
  carpool:       'Carpool preferences',
};

export function OnboardingScreen({ onComplete, userName }: OnboardingScreenProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Preferences state
  const [modes, setModes] = useState({
    transit: true, bike: true, carpool: false, driving: false, walking: true,
  });
  const [maxWalkingTime,    setMaxWalkingTime]    = useState(15);
  const [budgetSensitivity, setBudgetSensitivity] = useState(50);
  const [accessibility, setAccessibility] = useState({
    wheelchairAccessible: false, elevatorRequired: false, avoidStairs: false,
  });
  const [carpoolPrefs, setCarpoolPrefs] = useState({
    allowSmoking: false, allowPets: false, musicOk: true, chatty: true,
  });

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  const toggleMode = (key: keyof typeof modes) =>
    setModes(p => ({ ...p, [key]: !p[key] }));

  const toggleAccess = (key: keyof typeof accessibility) =>
    setAccessibility(p => ({ ...p, [key]: !p[key] }));

  const toggleCarpool = (key: keyof typeof carpoolPrefs) =>
    setCarpoolPrefs(p => ({ ...p, [key]: !p[key] }));

  const handleNext = async () => {
    if (!isLast) { setStepIdx(i => i + 1); return; }

    // Final step — save all preferences
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/users/me/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          maxWalkingTime,
          budgetSensitivity,
          useByDefault: true,
          preferredModes: modes,
          accessibility,
          carpoolPreferences: carpoolPrefs,
        }),
      });
      onComplete();
    } catch (e: any) {
      setError(e?.message || 'Failed to save preferences. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0f1012] to-[#141518] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="max-w-xl w-full relative z-10">
        {/* Logo + welcome */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl blur-lg opacity-50" />
              <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-2.5 rounded-xl">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-2xl font-bold gradient-text">UrbiX</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome, {userName.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-400 text-sm">
            Let's set up your preferences so UrbiX can personalise every recommendation for you.
          </p>
        </motion.div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                i <= stepIdx ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-white/10'
              }`} />
              <span className={`text-[10px] hidden sm:block transition-colors ${
                i === stepIdx ? 'text-indigo-400' : i < stepIdx ? 'text-gray-500' : 'text-gray-700'
              }`}>{STEP_LABELS[s]}</span>
            </div>
          ))}
        </div>

        {/* Step card */}
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="glass-effect rounded-3xl p-7 border border-white/10 shadow-2xl mb-6">

            {/* ── MODES ── */}
            {step === 'modes' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bus className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">Which transport modes do you prefer?</h2>
                </div>
                <p className="text-sm text-gray-400 mb-5">Select all that apply. The AI will prioritize these in your plans.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { key: 'transit', label: 'Public Transit', icon: Bus,        desc: 'STM bus & metro'     },
                    { key: 'bike',    label: 'Bike / BIXI',    icon: Bike,       desc: 'Cycling routes'      },
                    { key: 'walking', label: 'Walking',         icon: Footprints, desc: 'Pedestrian paths'    },
                    { key: 'carpool', label: 'Carpool',          icon: Users,      desc: 'Shared rides'        },
                    { key: 'driving', label: 'Personal Car',    icon: Car,        desc: 'Drive yourself'      },
                  ] as const).map(({ key, label, icon: Icon, desc }) => (
                    <button key={key} onClick={() => toggleMode(key)}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                        modes[key]
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}>
                      <div className={`p-2 rounded-xl ${modes[key] ? 'bg-indigo-600/30' : 'bg-white/10'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="text-xs text-gray-500">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── WALKING ── */}
            {step === 'walking' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-bold text-white">How far are you willing to walk?</h2>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                  The AI won't suggest options that require more walking than this per segment.
                </p>
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-white">{maxWalkingTime}</span>
                  <span className="text-gray-400 ml-1">min</span>
                  <p className="text-xs text-gray-500 mt-1">≈ {Math.round(maxWalkingTime / 60 * 5 * 10) / 10} km</p>
                </div>
                <input type="range" min={5} max={45} step={5}
                  value={maxWalkingTime} onChange={e => setMaxWalkingTime(Number(e.target.value))}
                  className="w-full accent-indigo-500" />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>5 min (minimal)</span><span>45 min (extensive)</span>
                </div>
              </div>
            )}

            {/* ── BUDGET ── */}
            {step === 'budget' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">How cost-sensitive are you?</h2>
                </div>
                <p className="text-sm text-gray-400 mb-6">This affects how the AI sorts and recommends options.</p>
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-white">{budgetSensitivity}</span>
                  <span className="text-gray-400 ml-1">/ 100</span>
                  <p className={`text-sm mt-1 font-medium ${
                    budgetSensitivity >= 70 ? 'text-amber-400' :
                    budgetSensitivity >= 40 ? 'text-blue-400' : 'text-purple-400'
                  }`}>
                    {budgetSensitivity >= 70 ? '💸 Very cost-sensitive — cheapest options first'
                     : budgetSensitivity >= 40 ? '⚖️ Balanced — cost vs comfort'
                     : '🚀 Comfort first — speed and convenience prioritized'}
                  </p>
                </div>
                <input type="range" min={0} max={100} step={10}
                  value={budgetSensitivity} onChange={e => setBudgetSensitivity(Number(e.target.value))}
                  className="w-full accent-indigo-500" />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>0 (comfort first)</span><span>100 (cheapest first)</span>
                </div>
              </div>
            )}

            {/* ── ACCESSIBILITY ── */}
            {step === 'accessibility' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Accessibility className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-bold text-white">Any accessibility needs?</h2>
                </div>
                <p className="text-sm text-gray-400 mb-5">Select all that apply. Routes will be filtered accordingly.</p>
                <div className="space-y-3">
                  {([
                    { key: 'wheelchairAccessible', label: 'Wheelchair accessible routes only',    desc: 'Only stations and buses with full accessibility' },
                    { key: 'elevatorRequired',      label: 'Elevator access required',             desc: 'All transit stops must have working elevators'   },
                    { key: 'avoidStairs',           label: 'Prefer to avoid stairs',               desc: 'Use ramps or elevators when available'            },
                  ] as const).map(({ key, label, desc }) => (
                    <button key={key} onClick={() => toggleAccess(key)}
                      className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                        accessibility[key]
                          ? 'bg-blue-600/20 border-blue-500/50 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}>
                      <div className={`mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                        accessibility[key] ? 'bg-blue-500 border-blue-500' : 'border-white/30'
                      }`}>
                        {accessibility[key] && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                      </div>
                    </button>
                  ))}
                  <p className="text-xs text-gray-600 text-center pt-1">No accessibility needs? Just click Next.</p>
                </div>
              </div>
            )}

            {/* ── CARPOOL PREFS ── */}
            {step === 'carpool' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-bold text-white">Carpool preferences</h2>
                </div>
                <p className="text-sm text-gray-400 mb-5">
                  These tell the AI which rides to suggest (and which to skip) when carpooling.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { key: 'allowSmoking', label: 'Smoking OK',   icon: Cigarette,      activeColor: 'bg-amber-600/20 border-amber-500/40 text-amber-300'   },
                    { key: 'allowPets',    label: 'Pets OK',      icon: PawPrint,       activeColor: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' },
                    { key: 'musicOk',      label: 'Music OK',     icon: Music,          activeColor: 'bg-blue-600/20 border-blue-500/40 text-blue-300'       },
                    { key: 'chatty',       label: 'Chatty ride',  icon: MessageCircle,  activeColor: 'bg-purple-600/20 border-purple-500/40 text-purple-300'  },
                  ] as const).map(({ key, label, icon: Icon, activeColor }) => (
                    <button key={key} onClick={() => toggleCarpool(key)}
                      className={`flex items-center gap-2.5 p-3.5 rounded-2xl border transition-all ${
                        carpoolPrefs[key]
                          ? activeColor
                          : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'
                      }`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center mt-4">
                  Highlighted = preferred. These will be used to filter carpool suggestions.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="text-sm text-red-400 text-center mb-4">{error}</p>
        )}

        <button onClick={handleNext} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:opacity-90 disabled:opacity-50 text-white font-semibold text-base transition-all shadow-lg shadow-indigo-600/20">
          {saving ? 'Saving…' : isLast ? (
            <><Sparkles className="w-5 h-5" /> Finish &amp; start planning</>
          ) : (
            <>Next <ChevronRight className="w-5 h-5" /></>
          )}
        </button>

        <p className="text-center text-xs text-gray-600 mt-3">
          Step {stepIdx + 1} of {STEPS.length} · You can always update these in your Profile
        </p>
      </div>
    </div>
  );
}
