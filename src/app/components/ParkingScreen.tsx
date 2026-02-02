import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Car, ChevronLeft, DollarSign, Clock, MapPin, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';

const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface ParkingScreenProps {
  onBack: () => void;
}

interface ParkingLocation {
  id: string;
  name: string;
  type: 'free' | 'paid';
  position: [number, number];
  price?: string;
  timeLimit?: string;
  availability: 'high' | 'medium' | 'low';
  availabilityNote: string;
  totalSpots: number;
  rules: string[];
  peakHours: string;
}

export function ParkingScreen({ onBack }: ParkingScreenProps) {
  const [selectedParking, setSelectedParking] = useState<ParkingLocation | null>(null);

  // Montréal parking locations
  const parkingLocations: ParkingLocation[] = [
    {
      id: '1',
      name: 'Stationnement Vieux-Port',
      type: 'paid',
      position: [45.5088, -73.5710],
      price: '$6/heure',
      timeLimit: 'Sans limite',
      availability: 'high',
      availabilityNote: 'Haute disponibilité',
      totalSpots: 320,
      rules: ['Accès 24/7', 'Hauteur max: 2m', 'Bornes de recharge disponibles'],
      peakHours: 'Lun-Ven 8h-18h'
    },
    {
      id: '2',
      name: 'Rue Saint-Laurent',
      type: 'free',
      position: [45.5160, -73.5850],
      timeLimit: '2 heures',
      availability: 'low',
      availabilityNote: 'Faible disponibilité aux heures de pointe',
      totalSpots: 38,
      rules: ['Lun-Sam 8h-18h seulement', 'Limite de 2h', 'Pas de stationnement de nuit'],
      peakHours: 'Lun-Ven 9h-17h'
    },
    {
      id: '3',
      name: 'Stationnement Quartier Latin',
      type: 'paid',
      position: [45.5140, -73.5820],
      price: '$5/heure',
      timeLimit: 'Sans limite',
      availability: 'medium',
      availabilityNote: 'Disponibilité modérée',
      totalSpots: 185,
      rules: ['Stationnement couvert', 'Caméras de sécurité', 'Service de voiturier disponible'],
      peakHours: 'Lun-Ven 7h-19h'
    },
    {
      id: '4',
      name: 'Avenue du Parc',
      type: 'free',
      position: [45.5225, -73.5985],
      timeLimit: '3 heures',
      availability: 'medium',
      availabilityNote: 'Disponibilité modérée',
      totalSpots: 42,
      rules: ['Lun-Ven seulement', 'Limite de 3h', 'Vignette résidents après 18h'],
      peakHours: 'Lun-Ven 8h-18h'
    },
    {
      id: '5',
      name: 'Stationnement Complexe Desjardins',
      type: 'paid',
      position: [45.5095, -73.5640],
      price: '$4/heure',
      timeLimit: 'Sans limite',
      availability: 'high',
      availabilityNote: 'Haute disponibilité',
      totalSpots: 420,
      rules: ['Forfait matinal: $12 toute la journée', 'Stationnement couvert', 'Accessible PMR'],
      peakHours: 'Lun-Ven 7h-10h'
    }
  ];

  const center: [number, number] = [45.5160, -73.5750];

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'high': return 'text-emerald-400 bg-emerald-600/20 border-emerald-500/30';
      case 'medium': return 'text-amber-400 bg-amber-600/20 border-amber-500/30';
      case 'low': return 'text-red-400 bg-red-600/20 border-red-500/30';
      default: return 'text-gray-400 bg-gray-600/20 border-gray-500/30';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0b0d]">
      {/* Header */}
      <div className="glass-effect border-b border-white/10 p-6 backdrop-blur-2xl z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/10"
          >
            <ChevronLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Car className="w-7 h-7 text-purple-400" />
              Smart parking
            </h2>
            <p className="text-sm text-gray-400">Find the best parking in Montreal</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={center}
            zoom={14}
            className="h-full w-full"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {parkingLocations.map((location) => (
              <Marker
                key={location.id}
                position={location.position}
                icon={defaultIcon}
                eventHandlers={{
                  click: () => setSelectedParking(location)
                }}
              >
                <Popup>
                  <div className="p-2">
                    <div className="font-semibold flex items-center gap-2">
                      <Car className="w-4 h-4 text-purple-600" />
                      {location.name}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {location.type === 'paid' ? location.price : 'Free'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-96 bg-[#0f1012] border-l border-white/10 overflow-y-auto">
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-white mb-4">Available parking</h3>

            {parkingLocations.map((location, idx) => (
              <motion.div
                key={location.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => setSelectedParking(location)}
                className={`glass-effect rounded-2xl p-5 border cursor-pointer transition-all shadow-lg ${selectedParking?.id === location.id
                    ? 'border-indigo-500/50 glow-effect'
                    : 'border-white/10 hover:border-white/20'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${location.type === 'paid'
                        ? 'bg-gradient-to-br from-purple-600 to-pink-600'
                        : 'bg-gradient-to-br from-emerald-600 to-green-600'
                      }`}>
                      <Car className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{location.name}</h4>
                      <p className="text-sm text-gray-400">{location.totalSpots} spots</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${getAvailabilityColor(location.availability)}`}>
                    {location.availability === 'high' ? 'Available' : location.availability === 'medium' ? 'Moderate' : 'Low'}
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <DollarSign className="w-4 h-4 text-purple-400" />
                    <span>{location.type === 'paid' ? location.price : 'Free'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>{location.timeLimit}</span>
                  </div>
                </div>

                {selectedParking?.id === location.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-4 pt-4 border-t border-white/10 space-y-3"
                  >
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Peak hours</p>
                      <p className="text-sm text-gray-300">{location.peakHours}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Rules</p>
                      <ul className="space-y-1">
                        {location.rules.map((rule, idx) => (
                          <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button className="w-full py-2.5 mt-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold transition-all shadow-lg shadow-indigo-600/20">
                      Get directions
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
