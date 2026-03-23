import { useEffect, useRef, useState } from 'react';
import {
  Bus, Bike, Car, Footprints, Users,
  ChevronLeft, Loader, MapPin, Clock, DollarSign, Leaf,
  Navigation, ChevronDown, ChevronUp
} from 'lucide-react';

export interface ActiveTripPlan {
  title:           string;
  mode:            string;
  from:            string;
  to:              string;
  distance_km:     number;
  duration_min:    number;
  cost_cad:        number;
  co2_saved_kg:    number;
  money_saved_cad: number;
  sustainability:  string;
  steps?:          Array<{ mode: string; duration: string; detail: string }>;
}

interface MapScreenProps {
  onBack:      () => void;
  activePlan?: ActiveTripPlan | null;
}

// Extend window to hold the Google Maps callback
declare global {
  interface Window {
    __googleMapsLoaded?: () => void;
    google?: any;
  }
}

const GOOGLE_MODE_MAP: Record<string, string> = {
  transit:  'TRANSIT',
  bike:     'BICYCLING',
  walking:  'WALKING',
  car:      'DRIVING',
  carpool:  'DRIVING',
};

const MODE_COLORS: Record<string, string> = {
  transit: '#6366f1', bike: '#10b981',
  car: '#8b5cf6', walking: '#06b6d4', carpool: '#f59e0b',
};

const MODE_ICONS: Record<string, any> = {
  transit: Bus, bike: Bike, car: Car, walking: Footprints, carpool: Users,
};

// Default view: Montréal city center
const MTL_CENTER = { lat: 45.5017, lng: -73.5673 };

export function MapScreen({ onBack, activePlan }: MapScreenProps) {
  const mapRef        = useRef<HTMLDivElement>(null);
  const googleMapRef  = useRef<any>(null);
  const rendererRef   = useRef<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [steps,         setSteps]         = useState<any[]>([]);
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const [apiKey,        setApiKey]        = useState<string | null>(null);
  const [showPanel,     setShowPanel]     = useState(false); // mobile side panel toggle

  // ── Fetch API key from backend env ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/config/maps-key')
      .then(r => r.json())
      .then(d => setApiKey(d?.data?.key || null))
      .catch(() => setApiKey(null));
  }, []);

  // ── Load Google Maps JS SDK once we have the key ───────────────────────────
  useEffect(() => {
    if (!apiKey) return;
    if (window.google?.maps) { initMap(); return; }

    // Load the script once
    if (!document.getElementById('google-maps-script')) {
      window.__googleMapsLoaded = () => initMap();
      const script = document.createElement('script');
      script.id  = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=__googleMapsLoaded`;
      script.async = true;
      script.defer = true;
      script.onerror = () => setError('Failed to load Google Maps.');
      document.head.appendChild(script);
    } else {
      // Script already loading — wait for callback
      window.__googleMapsLoaded = () => initMap();
    }
  }, [apiKey]);

  // ── Re-render route when plan changes ─────────────────────────────────────
  useEffect(() => {
    if (googleMapRef.current) renderRoute();
  }, [activePlan]);

  // ── Initialize map ─────────────────────────────────────────────────────────
  const initMap = () => {
    if (!mapRef.current || !window.google?.maps) return;

    const isDark = true; // match UrbiX dark theme
    const map = new window.google.maps.Map(mapRef.current, {
      center:    MTL_CENTER,
      zoom:      13,
      mapTypeId: 'roadmap',
      styles:    isDark ? DARK_STYLE : [],
      disableDefaultUI:   false,
      zoomControl:        true,
      streetViewControl:  false,
      mapTypeControl:     false,
      fullscreenControl:  false,
    });

    googleMapRef.current = map;

    // DirectionsRenderer — draws the route on the map
    rendererRef.current = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers:    false,
      polylineOptions: {
        strokeColor:   '#6366f1',
        strokeWeight:  5,
        strokeOpacity: 0.85,
      },
    });

    setLoading(false);
    if (activePlan) renderRoute();
  };

  // ── Render a route using Google Directions API ─────────────────────────────
  const renderRoute = () => {
    if (!window.google?.maps || !rendererRef.current || !activePlan) return;

    const isCarpool  = activePlan.mode === 'carpool';
    const color      = MODE_COLORS[activePlan.mode] || '#6366f1';

    rendererRef.current.setOptions({
      polylineOptions: { strokeColor: color, strokeWeight: 5, strokeOpacity: 0.85 },
    });

    const service = new window.google.maps.DirectionsService();

    if (isCarpool) {
      // For carpool: show the driving route between pickup and dropoff
      // + add custom markers for pickup/dropoff
      service.route(
        {
          origin:      activePlan.from + ', Montreal, QC, Canada',
          destination: activePlan.to   + ', Montreal, QC, Canada',
          travelMode:  window.google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (result: any, status: string) => {
          if (status === 'OK') {
            // Use custom markers instead of default A/B pins
            rendererRef.current.setOptions({
              suppressMarkers: true,
              polylineOptions: { strokeColor: color, strokeWeight: 5, strokeOpacity: 0.85 },
            });
            rendererRef.current.setDirections(result);

            const leg = result.routes[0]?.legs[0];

            // Add custom pickup marker (green car icon)
            new window.google.maps.Marker({
              position: leg.start_location,
              map:      googleMapRef.current,
              icon: {
                path:        window.google.maps.SymbolPath.CIRCLE,
                scale:       10,
                fillColor:   '#10b981',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              title: '🟢 Carpool Pickup: ' + activePlan.from,
              label: { text: '🚗', fontSize: '16px' },
            });

            // Add custom dropoff marker (red)
            new window.google.maps.Marker({
              position: leg.end_location,
              map:      googleMapRef.current,
              icon: {
                path:        window.google.maps.SymbolPath.CIRCLE,
                scale:       10,
                fillColor:   '#ef4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              title: '🔴 Carpool Drop-off: ' + activePlan.to,
              label: { text: '📍', fontSize: '16px' },
            });

            setError(null);
            // Build carpool-specific steps
            const carpoolSteps = [
              { instruction: `🚗 Meet your driver at ${activePlan.from}`, distance: '', duration: '' },
              ...(leg?.steps || []).map((s: any) => ({
                instruction: (s.html_instructions || '').replace(/<[^>]+>/g, ''),
                distance:    s.distance?.text || '',
                duration:    s.duration?.text || '',
              })),
              { instruction: `📍 Drop-off at ${activePlan.to}`, distance: '', duration: leg?.duration?.text || '' },
            ];
            setSteps(carpoolSteps.filter(s => s.instruction));
          } else {
            setError(`Could not load carpool route (${status}).`);
          }
        }
      );
    } else {
      // All other modes — standard Directions API
      const travelMode = GOOGLE_MODE_MAP[activePlan.mode] || 'DRIVING';
      rendererRef.current.setOptions({ suppressMarkers: false });

      service.route(
        {
          origin:      activePlan.from + ', Montreal, QC, Canada',
          destination: activePlan.to   + ', Montreal, QC, Canada',
          travelMode:  window.google.maps.TravelMode[travelMode],
          provideRouteAlternatives: false,
        },
        (result: any, status: string) => {
          if (status === 'OK') {
            rendererRef.current.setDirections(result);
            setError(null);
            const leg = result.routes[0]?.legs[0];
            if (leg?.steps) {
              const allSteps: any[] = [];
              for (const s of leg.steps) {
                if (s.steps && s.steps.length > 0) {
                  for (const sub of s.steps) {
                    allSteps.push({
                      instruction: (sub.html_instructions || sub.instructions || '').replace(/<[^>]+>/g, ''),
                      distance:    sub.distance?.text || '',
                      duration:    sub.duration?.text || '',
                      mode:        sub.travel_mode || s.travel_mode,
                    });
                  }
                } else {
                  allSteps.push({
                    instruction: (s.html_instructions || s.instructions || '').replace(/<[^>]+>/g, ''),
                    distance:    s.distance?.text || '',
                    duration:    s.duration?.text || '',
                    mode:        s.travel_mode,
                  });
                }
              }
              setSteps(allSteps.filter(s => s.instruction));
            }
          } else if (status === 'ZERO_RESULTS') {
            setError(`No ${activePlan.mode} route found between these locations.`);
          } else {
            setError(`Could not load route (${status}).`);
          }
        }
      );
    }
  };

  const ModeIcon   = activePlan ? (MODE_ICONS[activePlan.mode] || Bus) : MapPin;
  const modeColor  = activePlan ? (MODE_COLORS[activePlan.mode] || '#6366f1') : '#6366f1';
  const isCarpool  = activePlan?.mode === 'carpool';

  return (
    <div className="h-screen flex flex-col bg-[#0a0b0d]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#141518] border-b border-white/10 px-5 py-3.5 flex items-center justify-between backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl border border-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              {activePlan ? (
                <>
                  <ModeIcon className="w-4 h-4" style={{ color: modeColor }} />
                  {activePlan.title}
                </>
              ) : (
                <><MapPin className="w-4 h-4 text-indigo-400" /> Route Map</>
              )}
            </h2>
            {activePlan && (
              <p className="text-xs text-gray-400 mt-0.5">
                {isCarpool ? '📍 Pickup: ' : ''}{activePlan.from}
                {' → '}
                {isCarpool ? '🔴 Drop-off: ' : ''}{activePlan.to}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader className="w-3.5 h-3.5 animate-spin" /> Loading map…
            </div>
          )}
          {activePlan && (
            <button
              onClick={() => setShowPanel(v => !v)}
              className="lg:hidden px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium hover:bg-white/10 transition-all"
            >
              {showPanel ? 'Hide details' : 'Trip details'}
            </button>
          )}
        </div>
      </div>

      {/* ── Main content: map + side panel ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map container */}
        <div ref={mapRef} className="flex-1 h-full" />

        {/* ── Side panel ──────────────────────────────────────────────────── */}
        {activePlan && (
          <div className={`${showPanel ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 bg-[#0f1012] border-t lg:border-t-0 lg:border-l border-white/10 flex-col overflow-hidden lg:shrink-0 absolute lg:relative bottom-0 left-0 right-0 z-20 max-h-[60vh] lg:max-h-none`}>

            {/* Trip summary */}
            <div className="p-4 border-b border-white/10 space-y-2.5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: modeColor + '22', border: `1px solid ${modeColor}44` }}>
                  <ModeIcon className="w-4 h-4" style={{ color: modeColor }} />
                </div>
                <span className="text-sm font-semibold text-white">{activePlan.title}</span>
              </div>

              {error && (
                <div className="text-xs text-amber-400 bg-amber-600/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {[
                { icon: Clock,       label: 'Duration',     value: `${activePlan.duration_min} min` },
                { icon: MapPin,      label: 'Distance',     value: `${activePlan.distance_km} km` },
                { icon: DollarSign,  label: 'Cost',         value: `$${activePlan.cost_cad.toFixed(2)}` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}

              <div className="border-t border-white/10 pt-2.5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400 flex items-center gap-1"><Leaf className="w-3 h-3" /> CO₂ saved</span>
                  <span className="text-emerald-300 font-bold">+{activePlan.co2_saved_kg.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-400">Money saved</span>
                  <span className="text-green-300 font-bold">
                    {activePlan.money_saved_cad >= 0 ? '+' : ''}${activePlan.money_saved_cad.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Carpool labels */}
              {isCarpool && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-emerald-600/10 border border-emerald-500/20">
                    <span className="text-emerald-400">🟢</span>
                    <span className="text-gray-300"><span className="text-white font-medium">Pickup:</span> {activePlan.from}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-red-600/10 border border-red-500/20">
                    <span className="text-red-400">🔴</span>
                    <span className="text-gray-300"><span className="text-white font-medium">Drop-off:</span> {activePlan.to}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step-by-step directions */}
            {steps.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={() => setStepsExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all border-b border-white/10"
                >
                  <span className="flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" />
                    Step-by-step ({steps.length} steps)
                  </span>
                  {stepsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {stepsExpanded && (
                  <div className="divide-y divide-white/5">
                    {steps.map((step, i) => (
                      <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-all">
                        <div className="w-5 h-5 rounded-full bg-indigo-600/30 flex items-center justify-center text-[10px] text-indigo-300 font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-200 leading-snug">{step.instruction}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{step.distance} · {step.duration}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No plan / loading state */}
            {steps.length === 0 && !error && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center text-gray-600">
                  <Navigation className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Directions loading…</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Default state — no plan selected */}
        {!activePlan && !loading && (
          <div className="absolute bottom-6 left-6 bg-[#0f1012]/95 border border-white/15 backdrop-blur-xl rounded-2xl p-5 max-w-xs shadow-2xl z-10">
            <MapPin className="w-5 h-5 text-indigo-400 mb-2" />
            <p className="text-sm text-white font-semibold mb-1">No trip selected</p>
            <p className="text-xs text-gray-400">Go back to the AI assistant, select a trip plan and click <span className="text-indigo-400 font-medium">Map</span> to see your route here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Google Maps dark theme style ───────────────────────────────────────────────
const DARK_STYLE = [
  { elementType: 'geometry',              stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke',    stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill',      stylers: [{ color: '#8899aa' }] },
  { featureType: 'road',           elementType: 'geometry',           stylers: [{ color: '#2d3561' }] },
  { featureType: 'road',           elementType: 'geometry.stroke',    stylers: [{ color: '#212a37' }] },
  { featureType: 'road',           elementType: 'labels.text.fill',   stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway',   elementType: 'geometry',           stylers: [{ color: '#3a4a8a' }] },
  { featureType: 'road.highway',   elementType: 'geometry.stroke',    stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway',   elementType: 'labels.text.fill',   stylers: [{ color: '#f3d19c' }] },
  { featureType: 'water',          elementType: 'geometry',           stylers: [{ color: '#0e1626' }] },
  { featureType: 'water',          elementType: 'labels.text.fill',   stylers: [{ color: '#515c6d' }] },
  { featureType: 'poi',            elementType: 'geometry',           stylers: [{ color: '#1a2035' }] },
  { featureType: 'poi.park',       elementType: 'geometry',           stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'poi.park',       elementType: 'labels.text.fill',   stylers: [{ color: '#6b9a76' }] },
  { featureType: 'transit',        elementType: 'geometry',           stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station',elementType: 'labels.text.fill',   stylers: [{ color: '#d59563' }] },
  { featureType: 'administrative', elementType: 'geometry',           stylers: [{ color: '#2d3561' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.locality',elementType: 'labels.text.fill', stylers: [{ color: '#c4c4c4' }] },
  { featureType: 'landscape',      elementType: 'geometry',           stylers: [{ color: '#16213e' }] },
];
