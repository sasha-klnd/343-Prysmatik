import { useEffect, useState, useCallback } from 'react';
import { AIPromptScreen } from '@/app/components/AIPromptScreen';
import { AIConversationScreen } from '@/app/components/AIConversationScreen';
import { MapScreen, ActiveTripPlan } from '@/app/components/MapScreen';
import { CarpoolScreen } from '@/app/components/CarpoolScreen';
import { ParkingScreen } from '@/app/components/ParkingScreen';
import { BixiScreen } from '@/app/components/BixiScreen';
import { TransitScreen } from '@/app/components/TransitScreen';
import { ProfileScreen } from '@/app/components/ProfileScreen';
import { AdminDashboard } from '@/app/components/AdminDashboard';
import { AdminLoginScreen } from '@/app/components/AdminLoginScreen';
import { UserSignUpScreen } from '@/app/components/UserSignUpScreen';
import { UserLoginScreen } from '@/app/components/UserLoginScreen';
import { MyRidesScreen } from '@/app/components/MyRidesScreen';
import { OnboardingScreen } from '@/app/components/OnboardingScreen';
import { VerifyEmailScreen } from '@/app/components/VerifyEmailScreen';
import { Navigation } from '@/app/components/Navigation';

import { apiFetch, clearToken, saveAuthTokens } from '@/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen =
  | 'prompt' | 'conversation' | 'map' | 'carpool' | 'parking'
  | 'bixi' | 'transit'
  | 'profile' | 'admin' | 'admin-login'
  | 'user-signup' | 'user-login' | 'my-rides' | 'onboarding' | 'verify-email';

interface UserData {
  id?: number;
  name: string;
  email?: string;
  phone?: string | null;
  created_at?: string;
}

// ── Hash ↔ Screen mapping ────────────────────────────────────────────────────
const HASH_TO_SCREEN: Record<string, Screen> = {
  '/':            'prompt',
  '/chat':        'conversation',
  '/map':         'map',
  '/carpool':     'carpool',
  '/parking':     'parking',
  '/bixi':        'bixi',
  '/transit':     'transit',
  '/profile':     'profile',
  '/my-rides':    'my-rides',
  '/admin':       'admin',
  '/admin/login': 'admin-login',
  '/login':       'user-login',
  '/signup':      'user-signup',
  '/onboarding':  'onboarding',
  '/verify-email': 'verify-email',
};

const SCREEN_TO_HASH: Record<Screen, string> = Object.fromEntries(
  Object.entries(HASH_TO_SCREEN).map(([h, s]) => [s, h])
) as Record<Screen, string>;

function parseHash(): Screen {
  const raw = window.location.hash.slice(1).split('?')[0] || '/';
  return HASH_TO_SCREEN[raw] ?? 'prompt';
}

function pushHash(screen: Screen) {
  const next = '#' + SCREEN_TO_HASH[screen];
  if (window.location.hash !== next) {
    window.history.pushState(null, '', next);
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentScreen, setCurrentScreen]               = useState<Screen>(parseHash);
  const [userPrompt, setUserPrompt]                     = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated]   = useState(false);
  const [userData, setUserData]                         = useState<UserData | null>(null);
  const [returnToScreen, setReturnToScreen]             = useState<Screen>('conversation');
  const [conversationStarted, setConversationStarted]   = useState(false);
  // Incrementing resets AIConversationScreen state (only on user logout)
  const [sessionKey, setSessionKey]                     = useState(0);
  // Bumped every time user navigates back to conversation — triggers prefs re-check
  const [lastConversationActiveAt, setLastConversationActiveAt] = useState(0);
  const [activePlan, setActivePlan]                     = useState<ActiveTripPlan | null>(null);
  // Parking: optional location to pre-search when navigating to /parking
  const [parkingNear, setParkingNear]                   = useState<string | null>(null);
  const [pendingAIMessage, setPendingAIMessage]         = useState<string | null>(null);
  // Snapshot of prefs at the moment the user clicked Save in ProfileScreen
  const [savedPrefs, setSavedPrefs]                     = useState<any>(null);
  const [resendSent,   setResendSent]                    = useState(false);

  // ── Hash routing ────────────────────────────────────────────────────────────
  // Sync screen → hash on every navigation
  const navigateTo = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
    pushHash(screen);
    if (screen === 'conversation') {
      setLastConversationActiveAt(Date.now());
    }
  }, []);

  // Sync hash → screen on browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      const screen = parseHash();
      // If hash says 'conversation' but chat hasn't started yet → go to prompt
      if (screen === 'conversation' && !conversationStarted) {
        setCurrentScreen('prompt');
        pushHash('prompt');
      } else {
        setCurrentScreen(screen);
      }
    };
    // popstate fires on back/forward; hashchange fires on manual hash edits
    window.addEventListener('popstate',   onHashChange);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('popstate',   onHashChange);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [conversationStarted]);

  // Initial deep-link guard: if user lands on /chat with no conversation, redirect to /
  useEffect(() => {
    const initial = parseHash();
    if (initial === 'conversation' && !conversationStarted) {
      setCurrentScreen('prompt');
      pushHash('prompt');
    }
  }, []); // run once on mount

  // ── Restore session on page load ────────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const { getToken, clearToken: clear } = await import('@/api/client');
      if (!getToken()) return;
      try {
        const me = await apiFetch('/auth/me');
        setUserData(me.user);
        setIsUserAuthenticated(true);
      } catch {
        clear();
        setIsUserAuthenticated(false);
        setUserData(null);
      }
    };
    restore();
  }, []);

  // ── Ask AI from another screen ──────────────────────────────────────────────
  const handleAskAI = (message: string) => {
    setPendingAIMessage(message);
    setConversationStarted(true);
    navigateTo('conversation');
  };

  // ── FCM token registration (non-blocking, best-effort) ──────────────────────
  const _tryRegisterFcmToken = async () => {
    try {
      // Only attempt if the browser supports service workers and Firebase is configured
      if (!('serviceWorker' in navigator)) return;
      // Dynamic import so Firebase is never loaded if not needed
      const { initializeApp, getApps } = await import('firebase/app').catch(() => { throw new Error('no firebase'); });
      const { getMessaging, getToken } = await import('firebase/messaging').catch(() => { throw new Error('no firebase'); });

      const firebaseConfig = (window as any).__FIREBASE_CONFIG__;
      if (!firebaseConfig?.apiKey) return; // not configured

      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const messaging = getMessaging(app);
      const token = await getToken(messaging, { vapidKey: firebaseConfig.vapidKey });
      if (token) {
        await apiFetch('/auth/fcm-token', {
          method: 'POST',
          body: JSON.stringify({ fcm_token: token }),
        });
      }
    } catch {
      // FCM not configured or not supported — silently ignore
    }
  };

  // ── Navigation handler (called by Navigation bar and buttons) ───────────────
  const handleNavigate = (id: string) => {
    if (id === 'home') {
      navigateTo(conversationStarted ? 'conversation' : 'prompt');
    } else if (id === 'admin') {
      navigateTo(isAdminAuthenticated ? 'admin' : 'admin-login');
    } else if (id === 'profile') {
      if (isUserAuthenticated) {
        navigateTo('profile');
      } else {
        setReturnToScreen('profile');
        navigateTo('user-login');
      }
    } else if (id === 'my-rides') {
      if (isUserAuthenticated) {
        navigateTo('my-rides');
      } else {
        setReturnToScreen('my-rides');
        navigateTo('user-login');
      }
    } else {
      navigateTo(id as Screen);
    }
  };

  // ── Prompt → conversation ───────────────────────────────────────────────────
  const handleStartPlanning = (prompt: string) => {
    if (!conversationStarted) {
      setUserPrompt(prompt);
      setConversationStarted(true);
    }
    navigateTo('conversation');
  };

  // ── Admin auth ──────────────────────────────────────────────────────────────
  const handleAdminLogin = (success: boolean) => {
    if (success) {
      setIsAdminAuthenticated(true);
      navigateTo('admin');
    }
  };
  // Admin logout: go back to conversation WITHOUT resetting chat
  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    navigateTo(conversationStarted ? 'conversation' : 'prompt');
  };

  // ── User auth ────────────────────────────────────────────────────────────────
  const handleUserSignUp = async (data: { name: string; email: string; password: string; phone?: string }) => {
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: data.name, email: data.email, password: data.password, phone: data.phone }),
      });
      saveAuthTokens(res);
      setUserData(res.user);
      setIsUserAuthenticated(true);
      _tryRegisterFcmToken();
      // New users go to onboarding (non-skippable preference setup)
      navigateTo('onboarding');
    } catch (err: any) {
      throw err; // UserSignUpScreen catches and displays
    }
  };

  const handleUserLogin = async (credentials: { email: string; password: string }) => {
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      });
      saveAuthTokens(res);
      setUserData(res.user);
      setIsUserAuthenticated(true);
      // Register FCM token if available (non-blocking)
      _tryRegisterFcmToken();
      // If returning to 'conversation' but chat hasn't started yet, go to prompt instead
      const dest = returnToScreen === 'conversation' && !conversationStarted ? 'prompt' : returnToScreen;
      navigateTo(dest);
    } catch (err: any) {
      throw err; // UserLoginScreen catches and displays
    }
  };

  // User logout: clear token AND reset chat history
  const refreshUserData = async () => {
    try {
      const me = await apiFetch('/auth/me');
      setUserData(me.user);
    } catch { /* session may have expired — leave state as-is */ }
  };

  const handleUserLogout = () => {
    setIsUserAuthenticated(false);
    setUserData(null);
    clearToken();
    setConversationStarted(false);
    setUserPrompt('');
    setSessionKey(k => k + 1);
    navigateTo('prompt');
  };

  const handleRequireAuth = (_action: string, targetScreen: Screen) => {
    setReturnToScreen(targetScreen);
    navigateTo('user-login');
  };

  // ── Parking suggestion (from chatbox or carpool form) ───────────────────────
  const handleShowParking = (destination: string) => {
    setParkingNear(destination);
    navigateTo('parking');
  };

  // ── Derived booleans ────────────────────────────────────────────────────────
  // Screens that FULLY replace the app (rendered as an overlay, everything else stays mounted)
  const isFullscreen =
    currentScreen === 'prompt' ||
    currentScreen === 'admin-login' ||
    currentScreen === 'admin' ||
    currentScreen === 'user-signup' ||
    currentScreen === 'user-login' ||
    currentScreen === 'onboarding' ||
    currentScreen === 'verify-email';

  const showNav        = !isFullscreen;
  const showConversation = currentScreen === 'conversation';

  // ── Overlay screen (non-fullscreen, non-conversation) ───────────────────────
  const renderOverlay = () => {
    switch (currentScreen) {
      case 'map':
        return <MapScreen onBack={() => navigateTo('conversation')} activePlan={activePlan} />;
      case 'carpool':
        return (
          <CarpoolScreen
            onBack={() => navigateTo('conversation')}
            isAuthenticated={isUserAuthenticated}
            onRequireAuth={(action) => handleRequireAuth(action, 'carpool')}
            onShowParking={handleShowParking}
          />
        );
      case 'parking':
        return (
          <ParkingScreen
            onBack={() => { setParkingNear(null); navigateTo('conversation'); }}
            nearLocation={parkingNear ?? undefined}
            onAskAI={handleAskAI}
          />
        );
      case 'bixi':
        return (
          <BixiScreen
            onBack={() => navigateTo('conversation')}
            isAuthenticated={isUserAuthenticated}
            onRequireAuth={(action) => handleRequireAuth(action, 'bixi')}
          />
        );
      case 'transit':
        return (
          <TransitScreen
            onBack={() => navigateTo('conversation')}
            isAuthenticated={isUserAuthenticated}
            onRequireAuth={(action) => handleRequireAuth(action, 'transit')}
            onAskAI={handleAskAI}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onBack={() => navigateTo('conversation')}
            onLogout={handleUserLogout}
            userData={userData}
            isAuthenticated={isUserAuthenticated}
            onRequireAuth={(action) => handleRequireAuth(action, 'profile')}
            onPreferencesSaved={setSavedPrefs}
          />
        );
      case 'my-rides':
        return (
          <MyRidesScreen
            onBack={() => navigateTo('conversation')}
            isAuthenticated={isUserAuthenticated}
            onRequireAuth={(action) => handleRequireAuth(action, 'my-rides')}
          />
        );
      default:
        return null;
    }
  };

  // ── Fullscreen renderer ──────────────────────────────────────────────────────
  const renderFullscreen = () => {
    switch (currentScreen) {
      case 'prompt':
        return (
          <AIPromptScreen
            onStartPlanning={handleStartPlanning}
            isAuthenticated={isUserAuthenticated}
            userData={userData}
            onLogin={() => { setReturnToScreen('conversation'); navigateTo('user-login'); }}
            onSignUp={() => { setReturnToScreen('conversation'); navigateTo('user-signup'); }}
          />
        );
      case 'admin-login':
        return (
          <AdminLoginScreen
            onLogin={handleAdminLogin}
            onBack={() => navigateTo(conversationStarted ? 'conversation' : 'prompt')}
          />
        );
      case 'admin':
        return <AdminDashboard onBack={handleAdminLogout} />;
      case 'user-signup':
        return (
          <UserSignUpScreen
            onSignUp={handleUserSignUp}
            onSwitchToLogin={() => navigateTo('user-login')}
            onBack={() => navigateTo(returnToScreen)}
          />
        );
      case 'user-login':
        return (
          <UserLoginScreen
            onLogin={handleUserLogin}
            onSwitchToSignUp={() => navigateTo('user-signup')}
            onBack={() => navigateTo(returnToScreen)}
          />
        );
      case 'verify-email':
        // Extract token from hash: /#/verify-email/TOKEN
        return (
          <VerifyEmailScreen
            onVerified={refreshUserData}
            onDone={() => navigateTo(conversationStarted ? 'conversation' : 'prompt')}
          />
        );
      case 'onboarding':
        return (
          <OnboardingScreen
            userName={userData?.name || 'there'}
            onComplete={() => {
              // After onboarding, go to prompt (or conversation if already started)
              navigateTo(conversationStarted ? 'conversation' : 'prompt');
            }}
          />
        );
      default:
        return null;
    }
  };

  const overlayScreen = renderOverlay();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Base layout — always mounted so AIConversationScreen never unmounts ── */}
      {showNav && (
        <Navigation
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          isUserAuthenticated={isUserAuthenticated}
          userData={userData}
        />
      )}

      <div className={showNav ? 'pt-16' : ''}>
        {/* Email verification banner */}
        {isUserAuthenticated && userData && !(userData as any).is_verified && (
          <div className="bg-amber-600/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-amber-300">
              ✉️ Please verify your email address to unlock all features.
            </p>
            {resendSent ? (
              <span className="text-xs text-emerald-300 shrink-0">✓ Email sent!</span>
            ) : (
              <button
                onClick={() => apiFetch('/auth/resend-verification', { method: 'POST' }).then(() => { setResendSent(true); setTimeout(() => setResendSent(false), 4000); }).catch(() => {})}
                className="text-xs text-amber-200 underline hover:text-white transition-colors shrink-0"
              >
                Resend email
              </button>
            )}
          </div>
        )}

        {/* Conversation — mounted once, hidden via CSS when on another screen */}
        {conversationStarted && (
          <div style={{ display: showConversation ? 'block' : 'none' }}>
            <AIConversationScreen
              initialPrompt={userPrompt}
              onViewMap={() => navigateTo('map')}
              isAuthenticated={isUserAuthenticated}
              onRequireAuth={(action) => handleRequireAuth(action, 'conversation')}
              onSelectPlan={(plan) => { setActivePlan(plan); navigateTo('map'); }}
              userData={userData}
              sessionKey={sessionKey}
              lastActiveAt={lastConversationActiveAt}
              onShowParking={handleShowParking}
              onNavigateToMyRides={() => navigateTo('my-rides')}
              pendingMessage={pendingAIMessage}
              onPendingMessageConsumed={() => setPendingAIMessage(null)}
              savedPrefs={savedPrefs}
              onSavedPrefsConsumed={() => setSavedPrefs(null)}
            />
          </div>
        )}

        {/* Non-conversation overlay screens */}
        {overlayScreen && (
          <div style={{ display: showConversation ? 'none' : 'block' }}>
            {overlayScreen}
          </div>
        )}
      </div>

      {/* ── Fullscreen overlay — rendered on top, base layout stays mounted ─── */}
      {/* This is the key fix: admin/login screens no longer cause the           */}
      {/* AIConversationScreen to unmount, so chat history is preserved.         */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[200] overflow-auto">
          {renderFullscreen()}
        </div>
      )}
    </div>
  );
}
