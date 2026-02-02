import { useState } from 'react';
import { Users, MapPin, Clock, Star, Shield, ChevronLeft, Calendar, DollarSign, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { AuthGateModal } from '@/app/components/AuthGateModal';

interface CarpoolScreenProps {
  onBack: () => void;
  isAuthenticated?: boolean;
  onRequireAuth?: (action: string) => void;
}

interface RideOffer {
  id: string;
  driver: {
    name: string;
    rating: number;
    verified: boolean;
    trips: number;
  };
  match: 'great' | 'good' | 'fair';
  pickupZone: string;
  departureWindow: string;
  seatsAvailable: number;
  cost: string;
  preferences: string[];
}

export function CarpoolScreen({ onBack, isAuthenticated = false, onRequireAuth }: CarpoolScreenProps) {
  const [view, setView] = useState<'find' | 'offer'>('find');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState('');

  const rideOffers: RideOffer[] = [
    {
      id: '1',
      driver: {
        name: 'Sophie L.',
        rating: 4.9,
        verified: true,
        trips: 187
      },
      match: 'great',
      pickupZone: 'Mile End (0.2 km)',
      departureWindow: '8h15 - 8h30',
      seatsAvailable: 2,
      cost: '$5.00',
      preferences: ['Non-fumeur', 'Musique OK', 'Animaux bienvenus']
    },
    {
      id: '2',
      driver: {
        name: 'Marc D.',
        rating: 4.8,
        verified: true,
        trips: 143
      },
      match: 'good',
      pickupZone: 'Plateau Mont-Royal (0.6 km)',
      departureWindow: '8h00 - 8h15',
      seatsAvailable: 3,
      cost: '$4.00',
      preferences: ['Non-fumeur', 'Calme préféré']
    },
    {
      id: '3',
      driver: {
        name: 'Amélie R.',
        rating: 4.7,
        verified: false,
        trips: 56
      },
      match: 'good',
      pickupZone: 'Quartier Latin (1.0 km)',
      departureWindow: '8h30 - 8h45',
      seatsAvailable: 1,
      cost: '$5.50',
      preferences: ['Non-fumeur', 'Conversation bienvenue']
    }
  ];

  const getMatchColor = (match: string) => {
    switch (match) {
      case 'great': return 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30';
      case 'good': return 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30';
      case 'fair': return 'bg-amber-600/20 text-amber-400 border-amber-500/30';
      default: return 'bg-gray-600/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleRequestRide = () => {
    if (!isAuthenticated) {
      setAuthAction('request this ride');
      setShowAuthModal(true);
    } else {
      // Handle ride request
      alert('Ride request sent!');
    }
  };

  const handleOfferRide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setAuthAction('offer a ride');
      setShowAuthModal(true);
    } else {
      // Handle offer submission
      alert('Ride posted successfully!');
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
        actionType={authAction}
      />

      {/* Header */}
      <div className="glass-effect border-b border-white/10 p-6 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/10"
              >
                <ChevronLeft className="w-5 h-5 text-gray-300" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users className="w-7 h-7 text-amber-400" />
                  Carpooling
                </h2>
                <p className="text-sm text-gray-400">Share your rides in Montreal</p>
              </div>
            </div>
          </div>

          {/* Toggle View */}
          <div className="flex gap-3">
            <button
              onClick={() => setView('find')}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${view === 'find'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                }`}
            >
              Find a ride
            </button>
            <button
              onClick={() => setView('offer')}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${view === 'offer'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                }`}
            >
              Offer a ride
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {view === 'find' ? (
          <div className="space-y-6">
            {/* Privacy Notice */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-effect rounded-2xl p-5 border border-indigo-500/30"
            >
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-indigo-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    <span className="font-semibold text-indigo-400">Privacy:</span> Your exact location is never shared.
                    Only an approximate area (500m radius) is visible.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Ride Offers */}
            <div className="space-y-4">
              {rideOffers.map((offer, idx) => (
                <motion.div
                  key={offer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-effect rounded-2xl p-6 border border-white/10 hover:border-indigo-500/30 transition-all shadow-2xl"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">{offer.driver.name[0]}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{offer.driver.name}</span>
                          {offer.driver.verified && (
                            <Shield className="w-4 h-4 text-indigo-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span>{offer.driver.rating}</span>
                          </div>
                          <span>•</span>
                          <span>{offer.driver.trips} rides</span>
                        </div>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${getMatchColor(offer.match)}`}>
                      {offer.match === 'great' ? 'Excellent match' : offer.match === 'good' ? 'Good match' : 'Fair match'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-indigo-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-400">Pickup area</div>
                        <div className="text-white font-medium">{offer.pickupZone}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-purple-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-400">Departure window</div>
                        <div className="text-white font-medium">{offer.departureWindow}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-emerald-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-400">Available seats</div>
                        <div className="text-white font-medium">{offer.seatsAvailable} seat{offer.seatsAvailable > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <DollarSign className="w-5 h-5 text-amber-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-400">Cost per person</div>
                        <div className="text-white font-medium">{offer.cost}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-2">Preferences</div>
                    <div className="flex flex-wrap gap-2">
                      {offer.preferences.map((pref, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300"
                        >
                          {pref}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleRequestRide}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold transition-all duration-200 shadow-lg shadow-indigo-600/20"
                  >
                    Request this ride
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-effect rounded-2xl p-8 border border-white/10 shadow-2xl"
          >
            <h3 className="text-2xl font-bold text-white mb-6">Offer a ride</h3>
            <form onSubmit={handleOfferRide} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Departure point
                  </label>
                  <input
                    type="text"
                    placeholder="Mile End, Montreal"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Destination
                  </label>
                  <input
                    type="text"
                    placeholder="Old Montreal"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Departure time
                  </label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Available seats
                </label>
                <select className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                  <option>1 seat</option>
                  <option>2 seats</option>
                  <option>3 seats</option>
                  <option>4 seats</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold transition-all duration-200 shadow-lg shadow-indigo-600/20"
              >
                Post my ride
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
