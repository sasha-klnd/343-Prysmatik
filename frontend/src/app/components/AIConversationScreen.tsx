import { useState, useRef, useEffect } from 'react';
import {
  Bus, Bike, Car, Footprints, Users, Sparkles, Send,
  ChevronDown, ChevronUp, DollarSign, Clock, Leaf,
  ArrowRight, Zap, Loader, CheckCircle, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '@/api/client';

// Module-level flag — survives React re-renders and CSS show/hide navigation
let _hasInitialized = false;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TripPlan {
  id: string;
  title: string;
  isBest: boolean;
  mode: 'transit' | 'bike' | 'walking' | 'car' | 'carpool';
  from: string;
  to: string;
  distance_km: number;
  duration_min: number;
  cost_cad: number;
  co2_kg: number;
  co2_saved_kg: number;
  money_saved_cad: number;
  sustainability: 'high' | 'medium' | 'low';
  explanation: string;
  steps: Array<{ mode: string; duration: string; detail: string }>;
}

interface AIConversationScreenProps {
  initialPrompt: string;
  onViewMap: () => void;
  isAuthenticated?: boolean;
  onRequireAuth?: (action: string) => void;
  onSelectPlan?: (plan: TripPlan) => void;
  userData?: { name: string } | null;
  sessionKey?: number;
  onShowParking?: (destination: string) => void;
  onNavigateToMyRides?: () => void;
  /** Pre-filled message from Transit/Parking/Carpool screens — sent automatically once */
  pendingMessage?: string | null;
  onPendingMessageConsumed?: () => void;
  /** Bumped in App.tsx every time user navigates back to conversation — triggers prefs re-check */
  lastActiveAt?: number;
  /** The prefs object from the moment user clicked Save in ProfileScreen — triggers change detection */
  savedPrefs?: any;
  onSavedPrefsConsumed?: () => void;
}

const MODE_ICONS: Record<string, any> = {
  transit: Bus, bike: Bike, car: Car, walking: Footprints, carpool: Users,
};
const MODE_COLORS: Record<string, string> = {
  transit: 'text-blue-400', bike: 'text-emerald-400',
  car: 'text-purple-400', walking: 'text-cyan-400', carpool: 'text-amber-400',
};

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are UrbiX, an expert smart urban mobility assistant for Montréal, Canada.
Your job is to help users plan the best possible trip by combining all available transport modes.

BEHAVIOR RULES:
1. If the user has NOT clearly stated both origin AND destination, ask for them politely before generating plans.
2. Read and remember EVERYTHING the user says across the entire conversation. If they mention preferences (no smoking, likes biking, active person, time constraints, budget, accessibility needs, etc.) keep those in mind for all future plans in this session.
3. When you have enough information, generate 2–4 trip plans. Re-generate plans whenever the user refines their request.
4. Always prefer eco-friendly options. Mark isBest: true on the best balance of speed, cost, and sustainability.
5. Consider combining modes (e.g. walk + bike, transit + walk, carpool + walk).

USER PREFERENCE SIGNALS TO DETECT:
- "I'm active" / "I like biking" → prioritize bike/walking options
- "no smokers" / "non-smoking" → filter out smoking-allowed carpools
- "music OK" / "chatty" / "quiet ride" → note for carpool matching
- "I have X minutes" / "in a hurry" → optimize for speed
- "cheap" / "save money" → optimize for cost
- "eco" / "green" / "low carbon" → optimize for CO2
- "wheelchair" / "accessibility" → avoid options with stairs/barriers
- "I'm open to walk" → increase acceptable walking distance
- Rainy weather comments → deprioritize biking

OUTPUT FORMAT:
When generating plans, respond with a JSON object ONLY (no extra text, no markdown):
{
  "message": "conversational response acknowledging user preferences",
  "plans": [
    {
      "id": "1",
      "title": "BIXI Bike",
      "isBest": false,
      "mode": "bike",
      "from": "short geocodable place name, e.g. Concordia University or Brossard",
      "to": "short geocodable place name, e.g. McGill University or Plateau-Mont-Royal",
      "distance_km": 3.2,
      "duration_min": 15,
      "cost_cad": 7.25,
      "co2_kg": 0.0,
      "co2_saved_kg": 0.61,
      "money_saved_cad": -6.83,
      "sustainability": "high",
      "explanation": "Why this suits the user based on their stated preferences",
      "steps": [
        { "mode": "Walk", "duration": "2 min", "detail": "Walk to nearest BIXI station" },
        { "mode": "Bike", "duration": "13 min", "detail": "Ride via de Maisonneuve protected lane" }
      ]
    }
  ]
}

CARPOOL PLANS — MANDATORY EXTRA FIELDS:
For any plan with mode="carpool", you MUST include two additional fields:
  "ride_id": 42,           ← the numeric ride ID from the CARPOOL RIDES context above (REQUIRED)
  "title": "Walk + Carpool + Transit"  ← derive from your steps array (connector + Carpool + connector)

STEP MODE NAMES — use exactly these short labels so the title renders cleanly:
  "Walk" | "Bike" | "BIXI" | "Transit" | "Carpool" | "Car"
  Never use long phrases like "Walking to pickup" as the mode — put that in detail instead.

When asking a clarifying question (no plans yet), respond with:
{ "message": "your question here", "plans": [] }

When refining existing plans based on new preferences, respond with:
{ "message": "Updated based on your preference! Here are refined options:", "plans": [...new plans...] }

IMPORTANT — from/to field rules:
- Use SHORT, simple place names that Nominatim/OpenStreetMap can geocode easily.
- GOOD: "Concordia University", "McGill University", "Plateau-Mont-Royal", "Brossard", "Vieux-Port"
- BAD: "Guy-Concordia University, 1455 De Maisonneuve Blvd W, Montréal, QC H3G 1M8"
- Never include street numbers, postal codes, or full addresses in the from/to fields.
- The from/to fields are used for map rendering — keep them as recognizable landmark names.
- CARPOOL EXCEPTION: for carpool plans, set "from" and "to" to the EXACT departure/destination
  strings from the CARPOOL RIDES context above (copy verbatim — do not paraphrase or shorten).

PREFERENCE CONTRADICTION DETECTION — CRITICAL:
If the user says something that conflicts with their stored preferences, you MUST detect it
and include a "preference_update" field in your JSON response.

Contradiction examples:
- User says "I want the cheapest option" / "I'm on a tight budget" BUT budgetSensitivity is low (0–30, meaning cost is NOT a priority) → suggest raising it to 70+
- User says "I love biking" / "I'll bike" BUT prefer_bike is false → suggest enabling bike
- User says "I never take transit" / "I hate the metro" BUT prefer_transit is true → suggest disabling transit
- User says "I'm in a hurry" / "fastest route only" BUT max_walking_time is very high (> 30 min) → suggest lowering it
- User says "I want eco-friendly" / "I care about CO2" BUT prefer_driving is true and prefer_transit/bike are false → suggest eco modes
- User says "I'm open to carpool" / "I'll share a ride" BUT prefer_carpool is false → suggest enabling carpool

When you detect a contradiction, add this field to your JSON (alongside message and plans):
"preference_update": {
  "field": "prefer_bike",
  "current_value": false,
  "suggested_value": true,
  "reason": "You mentioned you love biking but your preferences have cycling disabled."
}

Only include preference_update when there is a CLEAR, EXPLICIT contradiction between what the user
just said and their stored preferences. Do NOT include it for vague or indirect statements.
The field name must match EXACTLY one of these keys (camelCase, as used by the backend):
preferBike, preferTransit, preferCarpool, preferDriving, preferWalking,
maxWalkingTime, budgetSensitivity, allowSmoking, allowPets, musicOk, chatty.

MONTRÉAL COST/CO2 CONSTANTS:
- Transit (STM): $3.75 flat fare, 0.041 kg CO2/km
- Bike (BIXI): $7.25/day, 0 kg CO2 (first 45 min free per trip)
- Car solo: $0.18/km, 0.192 kg CO2/km
- Walking: free, 0 kg CO2 (suggest only if ≤ 35 min walk = ~2.5 km)
- Carpool: split car cost by occupants, same CO2 split`;

// ─── Route extractor ──────────────────────────────────────────────────────────
function extractRoute(text: string): { origin: string; destination: string } | null {
  const patterns = [
    /(?:from|de)\s+([^,\n]+?)\s+(?:to|à|vers|->|toward)\s+([^,\n?!.]+)/i,
    /(?:go|get|travel|head)\s+(?:from\s+)?([^,\n]+?)\s+(?:to|à|vers)\s+([^,\n?!.]+)/i,
    /([^,\n]+?)\s+(?:->|to|vers)\s+([^,\n?!.]+)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m && m[1] && m[2]) {
      const origin = m[1].trim();
      const dest   = m[2].trim();
      // Filter out very short matches that are likely false positives
      if (origin.length > 3 && dest.length > 3) {
        return { origin, destination: dest };
      }
    }
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AIConversationScreen({
  initialPrompt, onViewMap,
  isAuthenticated = false,
  onRequireAuth = () => {},
  onSelectPlan,
  userData,
  sessionKey = 0,
  onShowParking,
  onNavigateToMyRides,
  pendingMessage,
  onPendingMessageConsumed,
  lastActiveAt = 0,
  savedPrefs,
  onSavedPrefsConsumed,
}: AIConversationScreenProps) {
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [plans,           setPlans]           = useState<TripPlan[]>([]);
  const [inputValue,      setInputValue]      = useState('');
  const [loading,         setLoading]         = useState(false);
  const [expandedPlan,    setExpandedPlan]    = useState<string | null>(null);
  // Single logged plan per session — simpler than a Set, avoids stale-state bugs
  const [loggedPlanId,    setLoggedPlanId]    = useState<string | null>(null);
  const [loggingPlan,     setLoggingPlan]     = useState<string | null>(null);
  const [showPlans,       setShowPlans]       = useState(true);
  const [userPrefs,       setUserPrefs]       = useState<any>(null);
  const [prefUpdate,      setPrefUpdate]      = useState<{field:string; current_value:any; suggested_value:any; reason:string} | null>(null);
  const [updatingPref,    setUpdatingPref]    = useState(false);
  const [routeDisplay,    setRouteDisplay]    = useState<{origin:string; destination:string} | null>(null);
  // Carpool ride request confirmation
  const [carpoolConfirm,  setCarpoolConfirm]  = useState<{planId: string; rideId: number; departure: string; destination: string} | null>(null);
  const [requestingRide,  setRequestingRide]  = useState(false);
  // Trip logging: track the DB trip id so we can replace it
  const [loggedTripId,    setLoggedTripId]    = useState<number | null>(null);
  const [replaceConfirm,  setReplaceConfirm]  = useState<TripPlan | null>(null);
  const [replacingTrip,   setReplacingTrip]   = useState(false);
  // Prefs change detection: snapshot the prefs used for last AI call
  const [prefsChanged,    setPrefsChanged]    = useState(false);
  const prefsSnapshot = useRef<string>('');

  // Track detected route across the conversation
  const detectedRoute = useRef<{ origin: string; destination: string } | null>(null);

  // Reset conversation when sessionKey changes (e.g. after logout)
  useEffect(() => {
    if (sessionKey === 0) return; // initial mount, don't reset
    _hasInitialized = false;
    setMessages([]);
    setPlans([]);
    setLoggedPlanId(null);
    setLoggedTripId(null);
    setReplaceConfirm(null);
    setPrefsChanged(false);
    prefsSnapshot.current = '';
    setRouteDisplay(null);
    setPrefUpdate(null);
    detectedRoute.current = null;
  }, [sessionKey]);

  // Fetch user preferences on mount and whenever the user is authenticated.
  useEffect(() => {
    if (!isAuthenticated) { setUserPrefs(null); prefsSnapshot.current = ''; return; }
    apiFetch('/users/me/preferences')
      .then((prefs: any) => setUserPrefs(prefs))
      .catch(() => {});
  }, [isAuthenticated]);

  // React to savedPrefs — fired the moment user clicks Save in ProfileScreen.
  // Compare the saved prefs against the snapshot of what was used in the last AI call.
  // Only show the banner if: we already have plans AND the prefs actually changed.
  useEffect(() => {
    if (!savedPrefs || !isAuthenticated) return;
    const newSnapshot = JSON.stringify(savedPrefs);
    setUserPrefs(savedPrefs);
    if (prefsSnapshot.current && prefsSnapshot.current !== newSnapshot && plans.length > 0) {
      setPrefsChanged(true);
    }
    onSavedPrefsConsumed?.();
  // savedPrefs is a new object reference on every save — that's our trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPrefs]);

  // Keep lastActiveAt effect as a secondary fallback (e.g. for back-button navigation)
  // but only re-fetch, don't trigger the banner — the savedPrefs effect handles that.
  useEffect(() => {
    if (!isAuthenticated || lastActiveAt === 0) return;
    apiFetch('/users/me/preferences')
      .then((prefs: any) => { setUserPrefs(prefs); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastActiveAt]);

  // Fire a pending message from another screen (Transit/Parking "Ask AI" buttons)
  useEffect(() => {
    if (!pendingMessage) return;
    // Small delay so the component fully mounts and scrolls correctly
    const t = setTimeout(() => {
      callAI(pendingMessage, messages);
      onPendingMessageConsumed?.();
    }, 100);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);
  // hasInitialized is module-level (_hasInitialized) to survive remounts
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // ── Call AI with full conversation history ──────────────────────────────────
  const callAI = async (userMessage: string, history: Message[]) => {
    setLoading(true);
    // Show user message immediately — don't wait for AI response
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Try to detect route from the new message, update if found
    const routeInMessage = extractRoute(userMessage);
    if (routeInMessage) {
      detectedRoute.current = routeInMessage;
      setRouteDisplay(routeInMessage);
    }

    // Also scan full history for route if still unknown
    if (!detectedRoute.current) {
      for (const msg of history) {
        const r = extractRoute(msg.content);
        if (r) {
          detectedRoute.current = r;
          setRouteDisplay(r);
          break;
        }
      }
    }

    try {
      const data = await apiFetch('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          system:           SYSTEM_PROMPT,
          origin:           detectedRoute.current?.origin      || '',
          destination:      detectedRoute.current?.destination || '',
          // Only send user preferences to the AI when the user is logged in
          user_preferences: isAuthenticated ? (userPrefs || {}) : {},
          current_user_id:  (userData as any)?.id || null,
          messages: [
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
        }),
      });

      const rawText = data.content?.[0]?.text || '{}';

      let parsed: { message: string; plans: TripPlan[] } = { message: rawText, plans: [] };
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = { message: rawText, plans: [] };
      }

      // ── Derive multi-modal title from steps ───────────────────────────────
      // e.g. steps [Walk, Carpool, Transit] → title "Walk + Carpool + Transit"
      const deriveTitle = (plan: TripPlan): string => {
        if (plan.mode !== 'carpool') return plan.title;
        if (!plan.steps || plan.steps.length <= 1) return plan.title;
        const modes = plan.steps
          .map(s => s.mode.trim())
          .filter((m, i, arr) => arr.indexOf(m) === i); // dedupe consecutive
        if (modes.length <= 1) return plan.title;
        return modes.join(' + ');
      };

      // ── Live-hydrate carpool plans from the backend ────────────────────────
      // Re-fetch each ride_id in parallel so we always show current seats/time/prefs.
      const matchedRides: any[] = data.matched_carpool_rides || [];
      const carpoolRideIds: number[] = [];

      if (parsed.plans) {
        parsed.plans.forEach(plan => {
          const rid = (plan as any).ride_id as number | undefined;
          if (plan.mode === 'carpool' && rid && !carpoolRideIds.includes(rid)) {
            carpoolRideIds.push(rid);
          }
        });
      }

      // Fetch live data for all carpool rides in parallel (silently, best-effort)
      const liveRideMap: Record<number, any> = {};
      if (carpoolRideIds.length > 0) {
        await Promise.allSettled(
          carpoolRideIds.map(async id => {
            try {
              const live = await apiFetch(`/rides/${id}`);
              liveRideMap[id] = live;
            } catch { /* ride may have been deleted */ }
          })
        );
      }

      // Also build a fallback map from the AI snapshot (cheaper, for non-live fields)
      const snapshotMap: Record<number, any> = {};
      matchedRides.forEach(r => { snapshotMap[r.id] = r; });

      // ── Check user carpool preferences (only when logged in) ───────────────
      const cp = (isAuthenticated && userPrefs)
        ? (userPrefs.carpoolPreferences ?? {})
        : null;

      // Normalise ride preference fields: backend to_dict() returns ridePreferences.allowSmoking
      // (camelCase, nested), but some paths use snake_case top-level fields.
      // This helper reads both so the check always works regardless of data source.
      const getRidePrefs = (ride: any) => {
        const rp = ride.ridePreferences ?? {};
        return {
          allowSmoking: rp.allowSmoking  ?? ride.allow_smoking ?? false,
          allowPets:    rp.allowPets     ?? ride.allow_pets    ?? false,
          musicOk:      rp.musicOk       ?? ride.music_ok      ?? true,
          chatty:       rp.chatty        ?? ride.chatty        ?? true,
        };
      };

      const rideMatchesUserPrefs = (ride: any): boolean => {
        if (!cp) return true; // not logged in → no filtering
        const rp = getRidePrefs(ride);
        if (!cp.allowSmoking && rp.allowSmoking) return false;
        if (!cp.musicOk      && !rp.musicOk)     return false;
        if (cp.allowPets     && !rp.allowPets)   return false;
        return true;
      };

      // ── Enrich, derive title, filter ───────────────────────────────────────
      const filteredOutMessages: string[] = [];

      if (parsed.plans) {
        const enriched: TripPlan[] = [];

        for (const plan of parsed.plans) {
          if (plan.mode !== 'carpool') {
            enriched.push({ ...plan, title: deriveTitle(plan) });
            continue;
          }

          const rideId = (plan as any).ride_id as number | undefined;
          const live   = rideId ? liveRideMap[rideId]    : null;
          const snap   = rideId ? snapshotMap[rideId]    : null;
          const ride   = live ?? snap; // prefer live; fall back to snapshot

          if (!ride) {
            // No ride data at all — keep plan as-is
            enriched.push({ ...plan, title: deriveTitle(plan) });
            continue;
          }

          // Ride was deleted or is no longer open
          if (live && live.status !== 'OPEN') {
            filteredOutMessages.push(
              `A carpool match (${ride.departure ?? plan.from} → ${ride.destination ?? plan.to}) is no longer available (status: ${live.status}).`
            );
            continue;
          }

          // Live preferences don't match user's current prefs — flag it, but KEEP the ride
          const prefMismatch = live && !rideMatchesUserPrefs(live);

          // Build a clean explanation using live data where available
          const driver    = ride.creator?.name ?? ride.driver ?? 'Unknown driver';
          const departs   = live
            ? live.departure_datetime ?? live.datetime
            : ride.datetime;
          const seatsLeft = live != null ? live.seats_available : ride.seats;

          // Build preference summary from live data (or snapshot), normalising field names
          const prefTags: string[] = [];
          const rp = getRidePrefs(live ?? snap ?? {});
          if (rp.allowSmoking) prefTags.push('smoking OK');
          if (rp.allowPets)    prefTags.push('pets OK');
          if (rp.musicOk)      prefTags.push('music OK');
          if (rp.chatty)       prefTags.push('chatty');

          // Strip any stale "| Driver:..." suffix the AI may have injected
          const baseExplanation = plan.explanation.replace(/\|\s*Driver:.*$/s, '').trim();

          // Append a preferences warning line if needed
          const prefWarning = prefMismatch
            ? '⚠️ Preferences don\'t fully match your settings — review before requesting.'
            : null;

          const liveNote = [
            `Driver: ${driver}`,
            departs ? `Departs: ${departs.slice(0, 16).replace('T', ' ')}` : null,
            seatsLeft != null ? `${seatsLeft} seat${seatsLeft !== 1 ? 's' : ''} available` : null,
            prefTags.length > 0 ? `Preferences: ${prefTags.join(', ')}` : null,
          ].filter(Boolean).join(' · ');

          const fullExplanation = [baseExplanation, liveNote, prefWarning]
            .filter(Boolean).join('\n');

          enriched.push({
            ...plan,
            from:        live ? live.departure  : (snap?.departure  ?? plan.from),
            to:          live ? live.destination : (snap?.destination ?? plan.to),
            title:       deriveTitle(plan),
            explanation: fullExplanation,
          });
        }

        parsed.plans = enriched;
      }

      // ── Assemble messages ──────────────────────────────────────────────────
      const assistantMsg: Message = { role: 'assistant', content: parsed.message };
      setMessages(prev => {
        const next = [...prev, assistantMsg];
        // Append filtered-out notices as a separate assistant message
        if (filteredOutMessages.length > 0) {
          next.push({
            role: 'assistant',
            content: '⚠️ ' + filteredOutMessages.join(' '),
          });
        }
        return next;
      });

      // Detect preference contradiction — show update prompt if AI flagged one
      if ((parsed as any).preference_update) {
        setPrefUpdate((parsed as any).preference_update);
      } else {
        setPrefUpdate(null);
      }

      // Only replace plans if new ones were returned — otherwise keep current plans visible
      if (parsed.plans && parsed.plans.length > 0) {
        setPlans(parsed.plans);
        setLoggedPlanId(null);   // reset logged state for new plan set
        setLoggedTripId(null);   // new plans → no previously logged trip
      }
      // Snapshot prefs used for this call so we can detect future changes
      if (userPrefs) {
        prefsSnapshot.current = JSON.stringify(userPrefs);
        setPrefsChanged(false);
      }

    } catch (e) {
      // User message already shown — just add error response
      setMessages(prev => [...prev,
        { role: 'assistant', content: "I'm having trouble connecting right now. Please try again." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Guard: only ever call the AI once for the initial prompt.
    // hasInitialized is a ref so it survives re-renders and navigation.
    // Even if App.tsx re-renders and passes the same initialPrompt again,
    // this block will NOT fire a second time.
    if (initialPrompt && !_hasInitialized) {
      _hasInitialized = true;
      callAI(initialPrompt, []);
    }
  }, []); // Empty deps — intentionally run only on first mount

  const handleUpdatePref = async () => {
    if (!prefUpdate || !isAuthenticated) return;
    setUpdatingPref(true);
    try {
      const updated = await apiFetch('/users/me/preferences/ai-update', {
        method: 'POST',
        body: JSON.stringify({ field: prefUpdate.field, value: prefUpdate.suggested_value }),
      });
      setUserPrefs(updated.preferences);
      setPrefUpdate(null);
      // Add a confirmation message to the chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Done! I've updated your "${prefUpdate.field}" preference to ${prefUpdate.suggested_value}. Your future trip suggestions will reflect this change.`
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e?.message || 'Failed to update preference. Please try again.'}` }]);
    } finally {
      setUpdatingPref(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;
    const msg = inputValue.trim();
    setInputValue('');
    callAI(msg, messages);
  };

  // ── Log a trip (or request a carpool ride) ───────────────────────────────────
  const logTrip = async (plan: TripPlan) => {
    if (!isAuthenticated) { onRequireAuth('log this trip'); return; }

    const rideId = (plan as any).ride_id as number | undefined;

    // Carpool plan with a real DB ride → prompt user to request the ride instead
    if (plan.mode === 'carpool' && rideId) {
      setCarpoolConfirm({
        planId: plan.id,
        rideId,
        departure:   plan.from,
        destination: plan.to,
      });
      return;
    }

    // If user already logged a different trip this session → confirm replace
    if (loggedTripId !== null && loggedPlanId !== plan.id) {
      setReplaceConfirm(plan);
      return;
    }

    await doLogTrip(plan);
  };

  // Normalize AI-generated mode names to valid backend modes
  const normalizeMode = (mode: string): string => {
    const map: Record<string, string> = {
      bixi: 'bike', bicycle: 'bike', cycling: 'bike', 'e-bike': 'bike',
      walk: 'walking', foot: 'walking', pedestrian: 'walking',
      bus: 'transit', metro: 'transit', stm: 'transit', subway: 'transit', train: 'transit',
      drive: 'car', driving: 'car', automobile: 'car',
      rideshare: 'carpool', 'ride-share': 'carpool', ridesharing: 'carpool',
    };
    return map[mode.toLowerCase()] ?? mode.toLowerCase();
  };

  const VALID_MODES = ['carpool', 'transit', 'bike', 'walking', 'car'];

  const doLogTrip = async (plan: TripPlan, replacingId?: number | null) => {
    setLoggingPlan(plan.id);
    if (replacingId != null) setReplacingTrip(true);
    try {
      // Delete the previously logged trip first if replacing
      const idToDelete = replacingId !== undefined ? replacingId : null;
      if (idToDelete !== null) {
        try {
          await apiFetch(`/trips/${idToDelete}`, { method: 'DELETE' });
        } catch {
          // If the trip was already deleted or not found, continue anyway
        }
        setLoggedPlanId(null);
        setLoggedTripId(null);
      }

      // Normalize mode so the backend always accepts it
      const rawMode  = plan.mode ?? '';
      const mode     = normalizeMode(rawMode);
      const safeMode = VALID_MODES.includes(mode) ? mode : 'transit';

      const result = await apiFetch('/trips/log', {
        method: 'POST',
        body: JSON.stringify({
          mode:        safeMode,
          distance_km: plan.distance_km || 1,
          note:        `${plan.from} → ${plan.to}`,
        }),
      });
      setLoggedTripId(result.trip?.id ?? null);
      setLoggedPlanId(plan.id);
      setReplaceConfirm(null);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e?.message || 'Failed to log trip. Please try again.'}` }]);
    } finally {
      setLoggingPlan(null);
      setReplacingTrip(false);
    }
  };

  const confirmCarpoolRequest = async () => {
    if (!carpoolConfirm) return;
    setRequestingRide(true);
    try {
      await apiFetch(`/rides/${carpoolConfirm.rideId}/request`, {
        method: 'POST',
        body: JSON.stringify({ seats_requested: 1 }),
      });
      setLoggedPlanId(carpoolConfirm.planId);
      setCarpoolConfirm(null);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Ride request sent for ${carpoolConfirm.departure} → ${carpoolConfirm.destination}! The driver will review it. Check My Rides to track the status.`,
      }]);
      // Brief delay so the success message renders before navigating away
      setTimeout(() => onNavigateToMyRides?.(), 1500);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e?.message || 'Failed to request ride. Please try again.'}` }]);
    } finally {
      setRequestingRide(false);
    }
  };

  const getSustainabilityStyle = (level: string) => {
    if (level === 'high')   return 'text-emerald-400 bg-emerald-600/20 border-emerald-500/30';
    if (level === 'medium') return 'text-amber-400 bg-amber-600/20 border-amber-500/30';
    return 'text-red-400 bg-red-600/20 border-red-500/30';
  };

  // ── Plan card ───────────────────────────────────────────────────────────────
  const PlanCard = ({ plan, idx }: { plan: TripPlan; idx: number }) => {
    const ModeIcon = MODE_ICONS[plan.mode] || Bus;
    const isLogged  = loggedPlanId === plan.id;
    const isLogging = loggingPlan === plan.id;

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 + idx * 0.1 }}
        className={`glass-effect rounded-2xl shadow-2xl border transition-all ${
          plan.isBest ? 'border-indigo-500/50' : 'border-white/10 hover:border-white/20'
        }`}
      >
        {plan.isBest && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold px-6 py-2.5 rounded-t-2xl flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> AI Recommended
          </div>
        )}

        <div className="p-5">
          {/* Title row */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <ModeIcon className={`w-4 h-4 ${MODE_COLORS[plan.mode] || 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{plan.title}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {plan.duration_min} min</span>
                  <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${plan.cost_cad.toFixed(2)}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {plan.distance_km} km</span>
                </div>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-xl text-xs font-medium border flex items-center gap-1 shrink-0 ${getSustainabilityStyle(plan.sustainability)}`}>
              <Leaf className="w-3 h-3" />
              {plan.sustainability === 'high' ? 'Eco' : plan.sustainability === 'medium' ? 'Moderate' : 'High CO₂'}
            </span>
          </div>

          {/* Impact preview */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/10 border border-emerald-500/15 text-center">
              <div className="text-emerald-300 font-bold text-sm">+{plan.co2_saved_kg.toFixed(2)} kg</div>
              <div className="text-[10px] text-gray-500">CO₂ saved vs car</div>
            </div>
            <div className="p-2.5 rounded-xl bg-green-600/10 border border-green-500/15 text-center">
              <div className="text-green-300 font-bold text-sm">
                {plan.money_saved_cad >= 0 ? '+' : ''}${plan.money_saved_cad.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500">money saved vs car</div>
            </div>
          </div>

          <p className="text-gray-400 text-sm mb-3 leading-relaxed">{plan.explanation}</p>

          {/* Steps toggle */}
          <button
            onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
            className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1.5 mb-3 transition-colors"
          >
            Step-by-step
            {expandedPlan === plan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {expandedPlan === plan.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
                <div className="space-y-2">
                  {plan.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600/30 flex items-center justify-center text-xs text-indigo-300 font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white">{step.mode}</span>
                        <span className="text-xs text-gray-500 mx-1.5">·</span>
                        <span className="text-xs text-gray-400">{step.duration}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {/* Log / Request button */}
            <button
              onClick={() => logTrip(plan)}
              disabled={isLogged || isLogging}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 min-w-0 ${
                isLogged
                  ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 cursor-default'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white disabled:opacity-40'
              }`}
            >
              {isLogging ? (
                <><Loader className="w-4 h-4 animate-spin" /> Logging…</>
              ) : isLogged ? (
                <><CheckCircle className="w-4 h-4" /> {plan.mode === 'carpool' ? 'Requested!' : 'Logged!'}</>
              ) : plan.mode === 'carpool' && (plan as any).ride_id ? (
                <>Request this ride</>
              ) : (
                <>Log my impact</>
              )}
            </button>

            {/* View on Map button */}
            <button
              onClick={() => onSelectPlan && onSelectPlan(plan)}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0"
            >
              <MapPin className="w-4 h-4" />
              Map
            </button>

            {/* Parking suggestion for car or carpool plans */}
            {(plan.mode === 'car' || plan.mode === 'carpool') && onShowParking && plan.to && (
              <button
                onClick={() => onShowParking(plan.to)}
                className="px-3 py-2.5 rounded-xl text-sm font-semibold border border-amber-500/30 bg-amber-600/10 hover:bg-amber-600/20 text-amber-300 hover:text-amber-200 transition-all flex items-center gap-1.5 shrink-0"
                title={`Find parking near ${plan.to}`}
              >
                🅿️ Parking
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0b0d] flex flex-col lg:flex-row">

      {/* Replace previously logged trip confirmation */}
      {replaceConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setReplaceConfirm(null)} />
          <div className="relative w-full max-w-sm glass-effect border border-white/15 rounded-3xl shadow-2xl p-6 z-10">
            <div className="text-2xl mb-2">🔄</div>
            <h3 className="text-lg font-bold text-white mb-1">Replace logged trip?</h3>
            <p className="text-sm text-gray-400 mb-4">
              You already logged your impact for another option this session. Would you like to switch to{' '}
              <span className="text-white font-semibold">{replaceConfirm.title}</span> instead?
            </p>
            <p className="text-xs text-gray-500 mb-5">
              The previous trip will be removed from your history and this one will be logged.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => doLogTrip(replaceConfirm, loggedTripId)}
                disabled={replacingTrip || loggingPlan !== null}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {replacingTrip || loggingPlan ? 'Updating…' : 'Yes, change it'}
              </button>
              <button
                onClick={() => setReplaceConfirm(null)}
                className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-sm transition-all"
              >
                Keep current
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carpool ride request confirmation modal */}
      {carpoolConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCarpoolConfirm(null)} />
          <div className="relative w-full max-w-sm glass-effect border border-white/15 rounded-3xl shadow-2xl p-6 z-10">
            <div className="text-2xl mb-2">🚗</div>
            <h3 className="text-lg font-bold text-white mb-1">Request this ride?</h3>
            <p className="text-sm text-gray-400 mb-4">
              <span className="text-white font-medium">{carpoolConfirm.departure}</span>
              {' → '}
              <span className="text-white font-medium">{carpoolConfirm.destination}</span>
            </p>
            <p className="text-xs text-gray-500 mb-5">
              The driver will be notified and can approve or reject your request. You can track it in My Rides.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmCarpoolRequest}
                disabled={requestingRide}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {requestingRide ? 'Sending…' : 'Yes, request ride'}
              </button>
              <button
                onClick={() => setCarpoolConfirm(null)}
                className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile toggle */}
      <button
        onClick={() => setShowPlans(!showPlans)}
        className="lg:hidden fixed bottom-6 right-6 z-50 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-full shadow-2xl flex items-center gap-2"
      >
        {showPlans ? '💬 Chat' : '📋 Plans'}<ArrowRight className="w-4 h-4" />
      </button>

      {/* ── Left panel — Chat ─────────────────────────────────────────────── */}
      <div
        className={`${showPlans ? 'hidden lg:flex' : 'flex'} w-full lg:w-2/5 bg-[#0f1012] border-r border-white/10 flex-col`}
        style={{ height: '100svh', position: 'sticky', top: 0 }}
      >
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg blur-md opacity-50" />
              <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">UrbiX Assistant</h2>
              {routeDisplay && (
                <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {routeDisplay.origin} → {routeDisplay.destination}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && messages.length === 0 && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-3 text-gray-400">
                <Loader className="w-5 h-5 animate-spin" />
                <span className="text-sm">Analyzing your request…</span>
              </div>
            </div>
          )}

          {messages.map((message, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : 'glass-effect text-gray-200 border border-white/10'
              }`}>
                {message.content}
              </div>
            </motion.div>
          ))}

          {loading && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="glass-effect border border-white/10 rounded-2xl px-5 py-3.5 flex items-center gap-2 text-gray-400 text-sm">
                <Loader className="w-4 h-4 animate-spin" /> Thinking…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Bottom bar: banners + input — fixed height, never shifts layout ── */}
        <div className="shrink-0 border-t border-white/10">
          {/* Prefs-changed banner (user updated profile and came back) */}
          <AnimatePresence>
            {prefsChanged && isAuthenticated && plans.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mx-4 mt-3 p-3 rounded-xl border border-indigo-500/30 bg-indigo-600/10">
                  <p className="text-xs text-indigo-300 mb-2">
                    ✨ <span className="font-semibold">Your preferences have changed.</span> Want updated options based on your new settings?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setPrefsChanged(false); callAI('Please show me updated options based on my new preferences.', messages); }}
                      className="flex-1 py-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-600/40 transition-all"
                    >
                      Yes, refresh my options
                    </button>
                    <button onClick={() => setPrefsChanged(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10 transition-all">
                      Not now
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preference contradiction banner */}
          <AnimatePresence>
            {prefUpdate && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mx-4 mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-600/10">
                  <p className="text-xs text-amber-300 mb-2">
                    ⚠️ <span className="font-semibold">Preference conflict:</span> {prefUpdate.reason}
                  </p>
                  <p className="text-xs text-gray-400 mb-2">
                    Current: <span className="text-white font-medium">{String(prefUpdate.current_value)}</span>
                    {' → '}Suggested: <span className="text-amber-300 font-medium">{String(prefUpdate.suggested_value)}</span>
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleUpdatePref} disabled={updatingPref || !isAuthenticated}
                      className="flex-1 py-1.5 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-600/40 disabled:opacity-50 transition-all">
                      {updatingPref ? 'Updating…' : 'Yes, update my preferences'}
                    </button>
                    <button onClick={() => setPrefUpdate(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10 transition-all">
                      Keep current
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input form — always at a fixed position, never shifts */}
          <form onSubmit={handleSend} className="p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Where do you want to go? Or refine your trip…"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:outline-none text-white placeholder:text-gray-500 text-sm"
              />
              <button type="submit" disabled={!inputValue.trim() || loading}
                className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl transition-all shrink-0">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Right panel — Plans ────────────────────────────────────────────── */}
      <div className={`${showPlans ? 'flex' : 'hidden lg:flex'} flex-1 overflow-y-auto p-4 lg:p-8 bg-[#0a0b0d] flex-col`}>
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <h2 className="text-3xl font-bold text-white">Your Travel Plans</h2>
            {plans.length > 0 && (
              <span className="text-xs text-gray-500 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
                Click "Use this trip" to log your impact
              </span>
            )}
          </div>

          {plans.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-500">
              <Zap className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="text-sm leading-relaxed">
                Tell me where you want to go and I'll find the best options.<br />
                <span className="text-indigo-400 mt-2 block">
                  Try: "I want to go from McGill to Plateau, I like biking and have 30 minutes"
                </span>
              </p>
            </div>
          )}

          {loading && plans.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Loader className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
              <p className="text-sm">Finding the best routes for you…</p>
            </div>
          )}

          <div className="space-y-5 pb-8">
            {plans.map((plan, idx) => (
              <PlanCard key={plan.id} plan={plan} idx={idx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
