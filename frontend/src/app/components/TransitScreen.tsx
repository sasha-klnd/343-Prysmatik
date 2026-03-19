import { useState } from 'react';
import { LogTripModal } from '@/app/components/LogTripModal';
import { Bus, ChevronLeft, ExternalLink, MapPin, Clock, DollarSign, Info, Train, ArrowRight } from 'lucide-react';

interface TransitScreenProps {
  onBack: () => void;
  isAuthenticated?: boolean;
  onRequireAuth?: (action: string) => void;
}

// Montreal STM metro lines
const METRO_LINES = [
  {
    number: '1',
    name: 'Ligne Verte',
    color: '#00A651',
    termini: ['Angrignon', 'Honoré-Beaugrand'],
    stations: 27,
    description: 'East–west across Montréal island, serving downtown and the Plateau.',
  },
  {
    number: '2',
    name: 'Ligne Orange',
    color: '#F68712',
    termini: ['Côte-Vertu', 'Montmorency'],
    stations: 31,
    description: 'Longest line — loops through downtown, Mile End, and Laval.',
  },
  {
    number: '4',
    name: 'Ligne Jaune',
    color: '#FFD700',
    termini: ['Berri-UQAM', 'Longueuil'],
    stations: 3,
    description: 'Short cross-river link to the South Shore (Longueuil).',
  },
  {
    number: '5',
    name: 'Ligne Bleue',
    color: '#0072BC',
    termini: ['Snowdon', 'Saint-Michel'],
    stations: 12,
    description: 'East–west across northern Montréal, serving Côte-des-Neiges and Rosemont.',
  },
];

const USEFUL_LINKS = [
  { label: 'STM Trip Planner', url: 'https://www.stm.info/en/info/networks/metro', icon: MapPin },
  { label: 'Real-time Status', url: 'https://www.stm.info/en/info/service-status/metro', icon: Clock },
  { label: 'Fares & Passes',   url: 'https://www.stm.info/en/info/fares', icon: DollarSign },
  { label: 'Bus Routes',       url: 'https://www.stm.info/en/info/networks/bus', icon: Bus },
];

const FARE_TABLE = [
  { label: 'Single fare (adult)', price: '$3.75' },
  { label: '10-trip booklet',     price: '$31.50' },
  { label: 'Monthly pass',        price: '$103.00' },
  { label: 'Reduced (students)',  price: '$70.50/mo' },
  { label: '65+ seniors',         price: '$70.50/mo' },
];

export function TransitScreen({ onBack, isAuthenticated = false, onRequireAuth = () => {} }: TransitScreenProps) {
  const [activeTab,    setActiveTab]    = useState<'metro' | 'fares' | 'links'>('metro');
  const [showLogModal, setShowLogModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#070a14] to-[#050818] text-white">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-[#0a0b0d]/90 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/5 rounded-xl border border-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
                <Bus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Public Transit</h1>
                <p className="text-xs text-gray-400">STM — Société de transport de Montréal</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-sm text-blue-300 hover:bg-blue-600/30 transition-all"
            >
              + Log trip
            </button>
            <a
              href="https://www.stm.info"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 text-sm transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open STM</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* ── Quick stats ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Metro lines', value: '4', sub: 'Green, Orange, Yellow, Blue' },
            { label: 'Metro stations', value: '68', sub: 'Across the island' },
            { label: 'Bus routes', value: '200+', sub: '24h service available' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="p-4 rounded-2xl border border-white/10 bg-white/5">
              <div className="text-2xl font-bold text-blue-400">{value}</div>
              <div className="text-xs text-white font-medium mt-0.5">{label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Navigation notice ───────────────────────────────────────── */}
        <div className="mb-6 p-4 rounded-2xl border border-blue-500/20 bg-blue-600/10 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <span className="font-semibold">Real-time schedules</span> are provided by the STM directly.
            Use the STM trip planner for personalized departure times and live status.
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5 border-b border-white/10 pb-3">
          {([['metro', 'Metro Lines'], ['fares', 'Fares'], ['links', 'Quick Links']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Metro lines tab ─────────────────────────────────────────── */}
        {activeTab === 'metro' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {METRO_LINES.map(line => (
              <div
                key={line.number}
                className="p-5 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: line.color + '33', border: `2px solid ${line.color}` }}
                  >
                    <span style={{ color: line.color }}>{line.number}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{line.name}</div>
                    <div className="text-xs text-gray-400">{line.stations} stations</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{line.termini[0]}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{line.termini[1]}</span>
                </div>

                <p className="text-xs text-gray-400">{line.description}</p>

                <a
                  href={`https://www.stm.info/en/info/networks/metro`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  View schedule <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* ── Fares tab ───────────────────────────────────────────────── */}
        {activeTab === 'fares' && (
          <div className="max-w-md">
            <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400" /> STM Fare Overview (2024)
              </h3>
              <div className="divide-y divide-white/10">
                {FARE_TABLE.map(({ label, price }) => (
                  <div key={label} className="flex justify-between items-center py-3">
                    <span className="text-sm text-gray-300">{label}</span>
                    <span className="text-sm font-semibold text-white">{price}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-blue-600/10 border border-blue-500/20 text-xs text-blue-300">
                Fares are subject to change. Verify current pricing at stm.info.
              </div>

              <a
                href="https://www.stm.info/en/info/fares"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 text-sm transition-all"
              >
                Full fare guide <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* ── Quick links tab ─────────────────────────────────────────── */}
        {activeTab === 'links' && (
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            {USEFUL_LINKS.map(({ label, url, icon: Icon }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 hover:border-blue-500/30 hover:bg-blue-600/10 transition-all group"
              >
                <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl group-hover:bg-blue-600/30 transition-colors">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm text-gray-200 group-hover:text-white font-medium">{label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-500 ml-auto group-hover:text-blue-400 transition-colors" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Log Trip Modal */}
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