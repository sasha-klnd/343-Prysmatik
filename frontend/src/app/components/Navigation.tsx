import { Home, Map, Users, Car, User, BarChart3, Zap, Bike, Bus, Briefcase } from 'lucide-react';

interface NavigationProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  isUserAuthenticated?: boolean;
  userData?: { name: string; email?: string } | null;
}

export function Navigation({
  currentScreen,
  onNavigate,
  isUserAuthenticated = false,
  userData,
}: NavigationProps) {
  const coreItems = [
    { id: 'home',    label: 'Home',          icon: Home,   targetScreen: 'conversation' },
    { id: 'map',     label: 'Map',           icon: Map,    targetScreen: 'map'          },
    { id: 'carpool', label: 'Carpool',       icon: Users,  targetScreen: 'carpool'      },
    { id: 'bixi',    label: 'BIXI',          icon: Bike,   targetScreen: 'bixi'         },
    { id: 'transit', label: 'Transit',       icon: Bus,    targetScreen: 'transit'      },
    { id: 'parking', label: 'Parking',       icon: Car,    targetScreen: 'parking'      },
  ];

  const authItems = isUserAuthenticated
    ? [{ id: 'my-rides', label: 'My Rides', icon: Briefcase, targetScreen: 'my-rides' }]
    : [];

  const navItems = [...coreItems, ...authItems];

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const isActive = (item: typeof navItems[0]) =>
    currentScreen === item.targetScreen ||
    (item.id === 'home' && currentScreen === 'conversation');

  return (
    <nav className="fixed top-0 left-0 right-0 bg-[#0a0b0d]/80 backdrop-blur-xl border-b border-white/10 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <button
            onClick={() => onNavigate('prompt')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity group shrink-0"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg blur-md opacity-50 group-hover:opacity-70 transition-opacity" />
              <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-1.5 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-lg sm:text-xl font-bold gradient-text hidden xs:block">UrbiX</span>
          </button>

          {/* Nav Items */}
          <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none min-w-0 flex-1 px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`relative px-2 sm:px-3 py-2 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-1.5 group shrink-0 ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {active && (
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 rounded-xl blur-sm" />
                  )}
                  <Icon className={`w-4 h-4 relative z-10 ${active ? 'text-indigo-400' : ''}`} />
                  <span className="hidden lg:inline relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* User / Auth */}
          <div className="flex items-center gap-2 shrink-0 ml-2 pl-2 border-l border-white/10">
            {isUserAuthenticated && userData ? (
              <button
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${
                  currentScreen === 'profile'
                    ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                  {getInitials(userData.name)}
                </div>
                <span className="hidden xl:inline text-sm text-gray-300 font-medium">
                  {userData.name.split(' ')[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('profile')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20"
              >
                <span className="hidden sm:inline">Sign in</span>
                <User className="w-4 h-4 sm:hidden" />
              </button>
            )}

            {/* Admin — subtle icon, always accessible */}
            <button
              onClick={() => onNavigate('admin')}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all opacity-40 hover:opacity-100"
              title="Admin dashboard"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
