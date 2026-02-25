import { useEffect, useState } from 'react';
import { AIPromptScreen } from '@/app/components/AIPromptScreen';
import { AIConversationScreen } from '@/app/components/AIConversationScreen';
import { MapScreen } from '@/app/components/MapScreen';
import { CarpoolScreen } from '@/app/components/CarpoolScreen';
import { ParkingScreen } from '@/app/components/ParkingScreen';
import { ProfileScreen } from '@/app/components/ProfileScreen';
import { AdminDashboard } from '@/app/components/AdminDashboard';
import { AdminLoginScreen } from '@/app/components/AdminLoginScreen';
import { UserSignUpScreen } from '@/app/components/UserSignUpScreen';
import { UserLoginScreen } from '@/app/components/UserLoginScreen';
import { MyRidesScreen } from '@/app/components/MyRidesScreen';
import { Navigation } from '@/app/components/Navigation';

import { apiFetch, clearToken, setToken } from '@/api/client';

type Screen = 'prompt' | 'conversation' | 'map' | 'carpool' | 'parking' | 'profile' | 'admin' | 'admin-login' | 'user-signup' | 'user-login' | 'my-rides';

interface UserData {
  id?: number;
  name: string;
  email?: string;
  phone?: string | null;
  created_at?: string;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('prompt');
  const [userPrompt, setUserPrompt] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [returnToScreen, setReturnToScreen] = useState<Screen>('conversation');

  // Restore session on refresh if a token exists
  useEffect(() => {
    const restore = async () => {
      try {
        const me = await apiFetch('/auth/me');
        setUserData(me.user);
        setIsUserAuthenticated(true);
      } catch {
        clearToken();
        setIsUserAuthenticated(false);
        setUserData(null);
      }
    };

    restore();
  }, []);

  const handleStartPlanning = (prompt: string) => {
    setUserPrompt(prompt);
    setCurrentScreen('conversation');
  };

  const handleNavigate = (screen: string) => {
    if (screen === 'home') {
      setCurrentScreen('conversation');
    } else if (screen === 'admin') {
      // Check if admin is authenticated
      if (isAdminAuthenticated) {
        setCurrentScreen('admin');
      } else {
        setCurrentScreen('admin-login');
      }
    } else if (screen === 'profile') {
      // Profile requires user authentication
      if (isUserAuthenticated) {
        setCurrentScreen('profile');
      } else {
        setReturnToScreen('profile');
        setCurrentScreen('user-login');
      }
    } else if (screen === 'my-rides') {
      // My Rides requires user authentication
      if (isUserAuthenticated) {
        setCurrentScreen('my-rides');
      } else {
        setReturnToScreen('my-rides');
        setCurrentScreen('user-login');
      }
    } else {
      setCurrentScreen(screen as Screen);
    }
  };

  const handleAdminLogin = (success: boolean) => {
    if (success) {
      setIsAdminAuthenticated(true);
      setCurrentScreen('admin');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setCurrentScreen('conversation');
  };

  const handleUserSignUp = async (data: { name: string; email: string; password: string; phone?: string }) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
      }),
    });

    setToken(res.token);
    setUserData(res.user);
    setIsUserAuthenticated(true);
    setCurrentScreen(returnToScreen);
  };

  const handleUserLogin = async (credentials: { email: string; password: string }) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });

    setToken(res.token);
    setUserData(res.user);
    setIsUserAuthenticated(true);
    setCurrentScreen(returnToScreen);
  };

  const handleUserLogout = () => {
    setIsUserAuthenticated(false);
    setUserData(null);
    clearToken();
    setCurrentScreen('conversation');
  };

  const handleRequireAuth = (action: string, targetScreen: Screen) => {
    setReturnToScreen(targetScreen);
    setCurrentScreen('user-login');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'prompt':
        return <AIPromptScreen onStartPlanning={handleStartPlanning} />;

      case 'conversation':
        return (
          <AIConversationScreen
            initialPrompt={userPrompt}
            onViewMap={() => setCurrentScreen('map')}
          />
        );

      case 'map':
        return <MapScreen onBack={() => setCurrentScreen('conversation')} />;

      case 'carpool':
        return (
          <CarpoolScreen
            onBack={() => setCurrentScreen('conversation')}
            isAuthenticated={isUserAuthenticated}
            onRequireAuth={(action) => handleRequireAuth(action, 'carpool')}
          />
        );

      case 'parking':
        return <ParkingScreen onBack={() => setCurrentScreen('conversation')} />;

      case 'profile':
        return (
          <ProfileScreen
            onBack={() => setCurrentScreen('conversation')}
            onLogout={handleUserLogout}
            userData={userData}
            isAuthenticated={isUserAuthenticated}
            onRequireAuth={(action) => handleRequireAuth(action, 'profile')}
          />
        );

      case 'my-rides':
        return (
          <MyRidesScreen
            onBack={() => setCurrentScreen('conversation')}
            isAuthenticated={isUserAuthenticated}
            onRequireAuth={(action) => handleRequireAuth(action, 'my-rides')}
          />
        );

      case 'admin-login':
        return <AdminLoginScreen onLogin={handleAdminLogin} onBack={() => setCurrentScreen('conversation')} />;

      case 'admin':
        return <AdminDashboard onBack={handleAdminLogout} />;

      case 'user-signup':
        return (
          <UserSignUpScreen
            onSignUp={handleUserSignUp}
            onSwitchToLogin={() => setCurrentScreen('user-login')}
            onBack={() => setCurrentScreen(returnToScreen)}
          />
        );

      case 'user-login':
        return (
          <UserLoginScreen
            onLogin={handleUserLogin}
            onSwitchToSignUp={() => setCurrentScreen('user-signup')}
            onBack={() => setCurrentScreen(returnToScreen)}
          />
        );

      default:
        return <AIPromptScreen onStartPlanning={handleStartPlanning} />;
    }
  };

  const showNavigation = currentScreen !== 'prompt' &&
    currentScreen !== 'admin-login' &&
    currentScreen !== 'admin' &&
    currentScreen !== 'user-signup' &&
    currentScreen !== 'user-login';

  return (
    <div className="min-h-screen bg-background">
      {/* Show navigation */}
      {showNavigation && (
        <Navigation
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          isUserAuthenticated={isUserAuthenticated}
          userData={userData}
        />
      )}

      {/* Main content */}
      <div className={showNavigation ? 'pt-16' : ''}>
        {renderScreen()}
      </div>
    </div>
  );
}