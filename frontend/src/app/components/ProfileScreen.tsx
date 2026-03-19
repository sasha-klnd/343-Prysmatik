import { useEffect, useState } from 'react';
import { apiFetch } from '@/api/client';
import { ChevronLeft, User, Sliders, Save, Settings, Bell, Globe, Shield, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { AuthGateModal } from '@/app/components/AuthGateModal';

interface ProfileScreenProps {
  onBack: () => void;
  onLogout?: () => void;
  userData?: { name: string; email: string } | null;
  isAuthenticated?: boolean;
  onRequireAuth?: (action: string) => void;
}

export function ProfileScreen({ onBack, onLogout, userData, isAuthenticated = false, onRequireAuth }: ProfileScreenProps) {
  const [maxWalkingTime, setMaxWalkingTime] = useState(15);
  const [budgetSensitivity, setBudgetSensitivity] = useState(50);
  const [preferredModes, setPreferredModes] = useState({
    transit: true,
    bike: true,
    carpool: false,
    driving: false,
    walking: true
  });
  const [useByDefault, setUseByDefault] = useState(true);
  const [accessibility, setAccessibility] = useState({
    wheelchairAccessible: false,
    elevatorRequired: false,
    avoidStairs: false
  });
  const [carpoolPreferences, setCarpoolPreferences] = useState({
    allowSmoking: false,
    allowPets: false,
    musicOk: true,
    chatty: true,
  });
  const [myStats, setMyStats] = useState<{
    total_trips: number;
    co2_saved_kg: number;
    money_saved_cad: number;
    rides_offered: number;
    rides_taken: number;
  } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved preferences when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const prefs = await apiFetch('/users/me/preferences');
        if (typeof prefs?.maxWalkingTime === 'number') setMaxWalkingTime(prefs.maxWalkingTime);
        if (typeof prefs?.budgetSensitivity === 'number') setBudgetSensitivity(prefs.budgetSensitivity);
        if (prefs?.preferredModes) setPreferredModes(prefs.preferredModes);
        if (prefs?.accessibility) setAccessibility(prefs.accessibility);
        if (typeof prefs?.useByDefault === 'boolean') setUseByDefault(prefs.useByDefault);
        if (prefs?.carpoolPreferences) setCarpoolPreferences(prefs.carpoolPreferences);

        // Issue 14: load real CO2 / cost stats
        try {
          const stats = await apiFetch('/trips/my-stats');
          setMyStats(stats);
        } catch {}
      } catch (e: any) {
        setError(e?.message || 'Failed to load preferences');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isAuthenticated]);

  const handleSave = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else {
      (async () => {
        setIsLoading(true);
        setError(null);
        try {
          await apiFetch('/users/me/preferences', {
            method: 'PUT',
            body: JSON.stringify({
              maxWalkingTime,
              budgetSensitivity,
              preferredModes: preferredModes,
              accessibility,
              useByDefault,
              carpoolPreferences,
            }),
          });
          alert('Preferences saved successfully!');
        } catch (e: any) {
          setError(e?.message || 'Failed to save preferences');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
  };

  const handleSignUp = () => {
    setShowAuthModal(false);
    if (onRequireAuth) {
      onRequireAuth('create an account');
    }
  };

  const handleLogin = () => {
    setShowAuthModal(false);
    if (onRequireAuth) {
      onRequireAuth('sign in');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0f1012] to-[#141518]">
      {/* Auth Gate Modal */}
      <AuthGateModal
        isOpen={showAuthModal}
        onClose={handleAuthModalClose}
        onSignUp={handleSignUp}
        onLogin={handleLogin}
        actionType="save your preferences"
      />

      {/* Header */}
      <div className="glass-effect border-b border-white/10 p-6 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/10"
              >
                <ChevronLeft className="w-5 h-5 text-gray-300" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <User className="w-7 h-7 text-indigo-400" />
                  {isAuthenticated ? 'My Profile' : 'Preferences'}
                </h2>
                <p className="text-sm text-gray-400">
                  {isAuthenticated ? 'Personalize your UrbiX experience' : 'Guest mode • Sign in to save'}
                </p>
              </div>
            </div>
            {isAuthenticated && onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-gray-300 hover:text-white"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden md:inline">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-3xl shadow-2xl border border-white/10 p-8"
        >
          {/* Profile Info - Only show if authenticated */}
          {isAuthenticated && userData ? (
            <div className="mb-8 pb-8 border-b border-white/10">
              <div className="flex items-center gap-5 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-600/30">
                  {userData.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{userData.name}</h3>
                  <p className="text-sm text-gray-400">{userData.email}</p>
                  <p className="text-xs text-indigo-400 mt-1">
                    Member since {userData.created_at
                      ? new Date(userData.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Quick Stats — real data from backend */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Trips',
                    value: myStats ? String(myStats.total_trips) : '—',
                    color: 'text-indigo-400',
                  },
                  {
                    label: 'CO₂ saved',
                    value: myStats ? `${myStats.co2_saved_kg.toFixed(1)} kg` : '—',
                    color: 'text-emerald-400',
                  },
                  {
                    label: 'Money saved',
                    value: myStats ? `$${myStats.money_saved_cad.toFixed(0)}` : '—',
                    color: 'text-green-400',
                  },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Guest mode notice
            <div className="mb-8 pb-8 border-b border-white/10">
              <div className="glass-effect rounded-2xl p-5 border border-indigo-500/30">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-indigo-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      <span className="font-semibold text-indigo-400">Guest mode:</span> You can customize your preferences, but sign in to save them permanently.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preferences */}
          <div className="space-y-8">
            {/* Max Walking Time */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <label className="text-base font-bold text-white">
                  Maximum walking time
                </label>
              </div>
              <div className="space-y-3">
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={maxWalkingTime}
                  onChange={(e) => setMaxWalkingTime(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-sm text-gray-400">
                  <span>5 min</span>
                  <span className="font-bold text-indigo-400">{maxWalkingTime} min</span>
                  <span>30 min</span>
                </div>
              </div>
            </div>

            {/* Budget Sensitivity */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-purple-400" />
                <label className="text-base font-bold text-white">
                  Budget sensitivity
                </label>
              </div>
              <div className="space-y-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={budgetSensitivity}
                  onChange={(e) => setBudgetSensitivity(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Price doesn't matter</span>
                  <span className="font-bold text-purple-400">{budgetSensitivity}%</span>
                  <span>Very sensitive</span>
                </div>
              </div>
            </div>

            {/* Preferred Transport Modes */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-emerald-400" />
                <label className="text-base font-bold text-white">
                  Preferred transport modes
                </label>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'transit', label: 'Public transit (STM)', gradient: 'from-indigo-600 to-blue-600' },
                  { key: 'bike', label: 'Bike (BIXI)', gradient: 'from-emerald-600 to-green-600' },
                  { key: 'walking', label: 'Walking', gradient: 'from-cyan-600 to-teal-600' },
                  { key: 'carpool', label: 'Carpooling', gradient: 'from-amber-600 to-orange-600' },
                  { key: 'driving', label: 'Personal car', gradient: 'from-purple-600 to-pink-600' }
                ].map((mode) => (
                  <label
                    key={mode.key}
                    className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer transition-all group"
                  >
                    <input
                      type="checkbox"
                      checked={preferredModes[mode.key as keyof typeof preferredModes]}
                      onChange={(e) => setPreferredModes({ ...preferredModes, [mode.key]: e.target.checked })}
                      className="w-5 h-5 rounded accent-indigo-600"
                    />
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity`}>
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="flex-1 text-white font-medium">{mode.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Accessibility */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-cyan-400" />
                <label className="text-base font-bold text-white">
                  Accessibility
                </label>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'wheelchairAccessible', label: 'Wheelchair accessible' },
                  { key: 'elevatorRequired', label: 'Elevator required' },
                  { key: 'avoidStairs', label: 'Avoid stairs' }
                ].map((option) => (
                  <label
                    key={option.key}
                    className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={accessibility[option.key as keyof typeof accessibility]}
                      onChange={(e) => setAccessibility({ ...accessibility, [option.key]: e.target.checked })}
                      className="w-5 h-5 rounded accent-cyan-600"
                    />
                    <span className="flex-1 text-white font-medium">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Default Preference */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-amber-400" />
                <label className="text-base font-bold text-white">
                  Default settings
                </label>
              </div>
              <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={useByDefault}
                  onChange={(e) => setUseByDefault(e.target.checked)}
                  className="w-5 h-5 rounded accent-amber-600"
                />
                <div className="flex-1">
                  <span className="text-white font-medium block">Use my default preferences</span>
                  <span className="text-sm text-gray-400">Automatically apply these preferences to all searches</span>
                </div>
              </label>
            </div>

            {/* Issue 14: Real CO2 / Cost stats cards */}
            {isAuthenticated && myStats && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🌿</span>
                  <label className="text-base font-bold text-white">My impact</label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'CO₂ saved', value: `${myStats.co2_saved_kg.toFixed(1)} kg`, sub: 'vs solo driving', color: 'text-emerald-400' },
                    { label: 'Money saved', value: `$${myStats.money_saved_cad.toFixed(0)}`, sub: 'vs solo driving', color: 'text-green-400' },
                    { label: 'Trips taken', value: myStats.rides_taken, sub: 'as passenger', color: 'text-blue-400' },
                    { label: 'Rides offered', value: myStats.rides_offered, sub: 'as driver', color: 'text-indigo-400' },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-white mt-0.5">{label}</div>
                      <div className="text-xs text-gray-500">{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Issue 8: Carpool lifestyle preferences */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🚗</span>
                <label className="text-base font-bold text-white">Carpool preferences</label>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'allowSmoking', label: 'Smoking OK',   sub: 'Allow smoking in your car/ride' },
                  { key: 'allowPets',    label: 'Pets OK',       sub: 'Allow pets in your car/ride' },
                  { key: 'musicOk',      label: 'Music OK',     sub: 'Music playing during the ride' },
                  { key: 'chatty',       label: 'Chatty ride',  sub: 'Enjoy conversation during rides' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={carpoolPreferences[opt.key as keyof typeof carpoolPreferences]}
                      onChange={e => setCarpoolPreferences(p => ({ ...p, [opt.key]: e.target.checked }))}
                      className="w-5 h-5 rounded accent-indigo-600"
                    />
                    <div className="flex-1">
                      <span className="text-white font-medium block">{opt.label}</span>
                      <span className="text-xs text-gray-400">{opt.sub}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                onClick={handleSave}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-500 hover:via-purple-500 hover:to-cyan-500 text-white font-bold transition-all duration-200 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save preferences
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
