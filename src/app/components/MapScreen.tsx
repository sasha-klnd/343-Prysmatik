import { useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Bus, Bike, Car, Footprints, Layers, ChevronLeft } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';

// Fix for default marker icons in React-Leaflet
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapScreenProps {
  onBack: () => void;
}

export function MapScreen({ onBack }: MapScreenProps) {
  const [showBikes, setShowBikes] = useState(true);
  const [showParking, setShowParking] = useState(true);
  const [showTransit, setShowTransit] = useState(true);

  // Montréal route data - Mile End to Vieux-Montréal
  const routeSegments = [
    {
      type: 'walk',
      color: '#10b981',
      coords: [
        [45.5230, -73.5980], // Mile End start
        [45.5225, -73.5975],
        [45.5220, -73.5970]
      ] as [number, number][]
    },
    {
      type: 'bus',
      color: '#6366f1',
      coords: [
        [45.5220, -73.5970],
        [45.5180, -73.5890],
        [45.5140, -73.5810],
        [45.5100, -73.5730]
      ] as [number, number][]
    },
    {
      type: 'walk',
      color: '#10b981',
      coords: [
        [45.5100, -73.5730],
        [45.5095, -73.5720],
        [45.5088, -73.5710] // Vieux-Montréal
      ] as [number, number][]
    }
  ];

  // BIXI bike stations in Montréal
  const bikeStations = [
    { id: 1, position: [45.5225, -73.5985] as [number, number], name: 'Mile End / Parc', available: 8 },
    { id: 2, position: [45.5180, -73.5895] as [number, number], name: 'Plateau Mont-Royal', available: 3 },
    { id: 3, position: [45.5140, -73.5820] as [number, number], name: 'Quartier Latin', available: 12 },
    { id: 4, position: [45.5095, -73.5715] as [number, number], name: 'Vieux-Port', available: 5 }
  ];

  // Parking locations in Montréal
  const parkingLocations = [
    { id: 1, position: [45.5215, -73.5965] as [number, number], name: 'Stationnement Mile End', type: 'paid', price: '$4/hr' },
    { id: 2, position: [45.5160, -73.5850] as [number, number], name: 'Rue St-Denis (Gratuit)', type: 'free', price: 'Gratuit' },
    { id: 3, position: [45.5105, -73.5740] as [number, number], name: 'Stationnement Vieux-Port', type: 'paid', price: '$6/hr' }
  ];

  const center: [number, number] = [45.5160, -73.5850]; // Center of Montréal route

  return (
    <div className="h-screen flex flex-col bg-[#0a0b0d]">
      {/* Header */}
      <div className="bg-[#141518] border-b border-white/10 p-4 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors border border-white/10"
          >
            <ChevronLeft className="w-5 h-5 text-gray-300" />
          </button>
          <h2 className="text-lg font-semibold text-white">Route Visualization</h2>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-gray-400" />
          <button
            onClick={() => setShowBikes(!showBikes)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              showBikes 
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'
            }`}
          >
            Bikes
          </button>
          <button
            onClick={() => setShowParking(!showParking)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              showParking 
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'
            }`}
          >
            Parking
          </button>
          <button
            onClick={() => setShowTransit(!showTransit)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              showTransit 
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' 
                : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'
            }`}
          >
            Transit
          </button>
        </div>
      </div>

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

          {/* Route segments */}
          {routeSegments.map((segment, idx) => (
            <Polyline
              key={idx}
              positions={segment.coords}
              pathOptions={{
                color: segment.color,
                weight: 5,
                opacity: 0.8
              }}
            />
          ))}

          {/* Start and End markers */}
          <Marker position={routeSegments[0].coords[0]} icon={defaultIcon}>
            <Popup>
              <div className="p-2">
                <div className="font-semibold">Mile End</div>
                <div className="text-sm text-gray-600">Starting point</div>
              </div>
            </Popup>
          </Marker>
          <Marker position={routeSegments[routeSegments.length - 1].coords[routeSegments[routeSegments.length - 1].coords.length - 1]} icon={defaultIcon}>
            <Popup>
              <div className="p-2">
                <div className="font-semibold">Vieux-Montréal</div>
                <div className="text-sm text-gray-600">Destination</div>
              </div>
            </Popup>
          </Marker>

          {/* Bike Stations */}
          {showBikes && bikeStations.map((station) => (
            <Marker key={station.id} position={station.position} icon={defaultIcon}>
              <Popup>
                <div className="p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Bike className="w-4 h-4 text-emerald-600" />
                    <div className="font-semibold">{station.name}</div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {station.available} vélos disponibles
                  </div>
                  <div className={`text-xs mt-1 ${
                    station.available > 5 ? 'text-emerald-600' : 'text-orange-600'
                  }`}>
                    {station.available > 5 ? 'Bonne disponibilité' : 'Disponibilité limitée'}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Parking Locations */}
          {showParking && parkingLocations.map((parking) => (
            <Marker key={parking.id} position={parking.position} icon={defaultIcon}>
              <Popup>
                <div className="p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Car className="w-4 h-4 text-purple-600" />
                    <div className="font-semibold">{parking.name}</div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {parking.price}
                  </div>
                  <div className={`text-xs mt-1 ${
                    parking.type === 'free' ? 'text-emerald-600' : 'text-indigo-600'
                  }`}>
                    {parking.type === 'free' ? 'Stationnement gratuit' : 'Stationnement payant'}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 glass-effect rounded-2xl p-5 max-w-xs shadow-2xl">
          <h3 className="font-semibold text-white mb-4">Route Legend</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-1 bg-emerald-500 rounded"></div>
              <Footprints className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-gray-300">Marche (8 min)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-1 bg-indigo-500 rounded"></div>
              <Bus className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-gray-300">Bus #55 (18 min)</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-sm text-gray-400">
              Total: <span className="text-white font-semibold">28 minutes</span> • <span className="text-white font-semibold">$3.50</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
