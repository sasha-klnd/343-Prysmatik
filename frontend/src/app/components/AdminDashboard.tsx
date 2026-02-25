import { ChevronLeft, Users, TrendingUp, Activity, Bike, Car, Bus, LogOut, Shield, Zap } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AdminDashboardProps {
  onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  // Mock data - Montréal context
  const activeUsers = 45283;
  const dailyTrips = 8921;
  const avgTripTime = 26;

  const usageData = [
    { time: '6h', users: 820 },
    { time: '8h', users: 3600 },
    { time: '10h', users: 2100 },
    { time: '12h', users: 2800 },
    { time: '14h', users: 1900 },
    { time: '16h', users: 3200 },
    { time: '18h', users: 4100 },
    { time: '20h', users: 1400 },
  ];

  const transportModeData = [
    { name: 'STM (Métro/Bus)', value: 42, color: '#6366f1' },
    { name: 'BIXI', value: 28, color: '#10b981' },
    { name: 'Marche', value: 18, color: '#06b6d4' },
    { name: 'Covoiturage', value: 8, color: '#f59e0b' },
    { name: 'Voiture', value: 4, color: '#8b5cf6' },
  ];

  const bikeAvailabilityData = [
    { station: 'Mile End', available: 12, total: 20 },
    { station: 'Plateau', available: 5, total: 18 },
    { station: 'Vieux-Port', available: 18, total: 25 },
    { station: 'McGill', available: 8, total: 15 },
    { station: 'Quartier Latin', available: 22, total: 30 },
  ];

  const parkingDemandData = [
    { day: 'Lun', demand: 88 },
    { day: 'Mar', demand: 91 },
    { day: 'Mer', demand: 93 },
    { day: 'Jeu', demand: 90 },
    { day: 'Ven', demand: 96 },
    { day: 'Sam', demand: 52 },
    { day: 'Dim', demand: 38 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0f1012] to-[#141518]">
      {/* Header */}
      <div className="glass-effect border-b border-white/10 p-6 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl blur-lg opacity-50"></div>
                <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-2.5 rounded-xl">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span className="gradient-text">UrbiX</span> Analytics
                </h2>
                <p className="text-sm text-gray-400">Smart-city mobility dashboard</p>
              </div>
            </div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 text-gray-300 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10 hover:border-indigo-500/30 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="px-3 py-1 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-semibold">+15%</div>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {activeUsers.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Active users</div>
          </div>

          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10 hover:border-emerald-500/30 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="px-3 py-1 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-semibold">+12%</div>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {dailyTrips.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Daily trips</div>
          </div>

          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className="px-3 py-1 bg-red-600/20 border border-red-500/30 rounded-xl text-red-400 text-sm font-semibold">-4%</div>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {avgTripTime} min
            </div>
            <div className="text-sm text-gray-400">Average trip time</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Peak Usage Times */}
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" />
              Peak hours
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(20, 21, 24, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ fill: '#6366f1', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Popular Transport Modes */}
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Popular transport modes
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={transportModeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {transportModeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(20, 21, 24, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bike Availability Trends */}
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Bike className="w-5 h-5 text-emerald-400" />
              BIXI availability
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bikeAvailabilityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="station" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(20, 21, 24, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Bar dataKey="available" fill="#10b981" name="Available" radius={[8, 8, 0, 0]} />
                <Bar dataKey="total" fill="rgba(255,255,255,0.1)" name="Total capacity" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Parking Demand Trends */}
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Car className="w-5 h-5 text-purple-400" />
              Parking demand
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={parkingDemandData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(20, 21, 24, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="demand" fill="#8b5cf6" name="Demand %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10 mt-6">
          <h3 className="text-lg font-bold text-white mb-6">Recent system activity</h3>
          <div className="space-y-3">
            {[
              { icon: Users, gradient: 'from-indigo-600 to-purple-600', text: '2,847 new users this week', time: '2 hours ago' },
              { icon: Bike, gradient: 'from-emerald-600 to-green-600', text: 'BIXI station Quartier Latin at full capacity', time: '4 hours ago' },
              { icon: Car, gradient: 'from-purple-600 to-pink-600', text: 'Stationnement Vieux-Port at 92% capacity', time: '6 hours ago' },
              { icon: Bus, gradient: 'from-blue-600 to-cyan-600', text: 'Bus line #55 is experiencing delays', time: '8 hours ago' },
            ].map((activity, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                <div className={`p-2.5 bg-gradient-to-br ${activity.gradient} rounded-xl`}>
                  <activity.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-200 font-medium">{activity.text}</div>
                  <div className="text-xs text-gray-500 mt-1">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
