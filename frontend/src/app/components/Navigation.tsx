import { Home, Map, Users, Car, User, BarChart3, Zap, LogOut, Briefcase } from 'lucide-react';

interface NavigationProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  isUserAuthenticated?: boolean;
  userData?: { name: string; email: string } | null;
}

export function Navigation({ currentScreen, onNavigate, isUserAuthenticated = false, userData }: NavigationProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home, targetScreen: 'conversation' },
    { id: 'map', label: 'Map', icon: Map, targetScreen: 'map' },
    { id: 'carpool', label: 'Covoiturage', icon: Users, targetScreen: 'carpool' },
    { id: 'parking', label: 'Stationnement', icon: Car, targetScreen: 'parking' },
  ];

  // Add "My Rides" only if user is authenticated
  const authenticatedNavItems = [
    ...navItems,
    ...(isUserAuthenticated ? [{ id: 'my-rides', label: 'My Rides', icon: Briefcase, targetScreen: 'my-rides' }] : [])
  ];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-[#0a0b0d]/80 backdrop-blur-xl border-b border-white/10 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => onNavigate('prompt')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg blur-md opacity-50 group-hover:opacity-70 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-1.5 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-xl font-bold gradient-text">UrbiX</span>
          </button>

          {/* Nav Items */}
          <div className="flex items-center gap-2">
            {authenticatedNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.targetScreen ||
                (item.id === 'home' && currentScreen === 'conversation');

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`relative px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 group ${isActive
                    ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 rounded-xl blur-sm"></div>
                  )}
                  <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-indigo-400' : ''}`} />
                  <span className="hidden md:inline relative z-10">{item.label}</span>
                </button>
              );
            })}

            {/* User Profile/Auth */}
            <div className="ml-2 pl-2 border-l border-white/10">
              {isUserAuthenticated && userData ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('profile')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${currentScreen === 'profile'
                      ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10'
                      }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {getInitials(userData.name)}
                    </div>
                    <span className="hidden lg:inline text-sm text-gray-300 font-medium">
                      {userData.name.split(' ')[0]}
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onNavigate('profile')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-indigo-600/20"
                >
                  <span className="hidden sm:inline">Connexion</span>
                  <User className="w-4 h-4 sm:hidden" />
                </button>
              )}

              {/* Admin Link (hidden, accessible via direct navigation) */}
              <button
                onClick={() => onNavigate('admin')}
                className="ml-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all opacity-30 hover:opacity-100"
                title="Admin"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}