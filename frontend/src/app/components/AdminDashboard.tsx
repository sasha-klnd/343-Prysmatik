import { useEffect, useState } from 'react';
import {
  Users, TrendingUp, Activity, LogOut,
  Shield, Zap, RefreshCw, Calendar, CheckCircle, Clock, Layers
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { apiFetch, getAdminToken, clearAdminToken } from '@/api/client';
import { timeAgoMtl } from './timeUtils';

interface AdminDashboardProps {
  onBack: () => void;
}

interface Summary {
  users:    { total: number; this_week: number };
  rides:    { total: number; open: number; full: number; this_week: number };
  bookings: { total: number; accepted: number; pending: number; rejected: number; cancelled: number; acceptance_rate: number };
}

interface EventBreakdown {
  total_events: number;
  by_type: Record<string, number>;
  recent: { id: number; event_type: string; user_id: number | null; metadata: object; created_at: string }[];
}

interface DailyRide { date: string; rides: number }

interface MobilityService {
  service_type: string;
  display_name: string;
  available: boolean;
  station_count?: number;
  total_bikes_available?: number;
  open_rides?: number;
  is_fallback?: boolean;
}

const BOOKING_COLORS: Record<string, string> = {
  ACCEPTED:  '#10b981',
  PENDING:   '#f59e0b',
  REJECTED:  '#ef4444',
  CANCELLED: '#6b7280',
};

const EVENT_LABELS: Record<string, string> = {
  ride_created:      'Rides created',
  booking_created:   'Bookings made',
  booking_approved:  'Bookings approved',
  booking_rejected:  'Bookings rejected',
  user_registered:   'Users registered',
};

function fmtEventType(t: string) {
  return EVENT_LABELS[t] || t.replace(/_/g, ' ');
}



export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [events,   setEvents]   = useState<EventBreakdown | null>(null);
  const [daily,    setDaily]    = useState<DailyRide[]>([]);
  const [services, setServices] = useState<MobilityService[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState(new Date());

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, ev, dailyRides, svc] = await Promise.all([
        apiFetch('/analytics/summary', {}, true),
        apiFetch('/analytics/events', {}, true),
        apiFetch('/analytics/rides/daily?days=7', {}, true),
        apiFetch('/analytics/mobility/services', {}, true),
      ]);
      setSummary(sum);
      setEvents(ev);
      setDaily(dailyRides);
      setServices(svc);
      setRefreshed(new Date());
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const bookingPieData = summary ? [
    { name: 'Accepted',  value: summary.bookings.accepted,  color: BOOKING_COLORS.ACCEPTED  },
    { name: 'Pending',   value: summary.bookings.pending,   color: BOOKING_COLORS.PENDING   },
    { name: 'Rejected',  value: summary.bookings.rejected,  color: BOOKING_COLORS.REJECTED  },
    { name: 'Cancelled', value: summary.bookings.cancelled, color: BOOKING_COLORS.CANCELLED },
  ].filter(d => d.value > 0) : [];

  const eventBarData = events
    ? Object.entries(events.by_type).map(([k, v]) => ({ name: fmtEventType(k), count: v }))
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0f1012] to-[#141518]">
      {/* Header */}
      <div className="glass-effect border-b border-white/10 p-6 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl blur-lg opacity-50" />
              <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-2.5 rounded-xl">
                <Shield className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="gradient-text">UrbiX</span> Analytics
              </h2>
              <p className="text-sm text-gray-400">
                Live admin dashboard · <span className="text-gray-500">Refreshed {refreshed.toLocaleTimeString()}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadAll} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>
            <button onClick={onBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all">
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-500/30 bg-red-600/10 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total users',      value: summary?.users.total,         sub: summary ? `+${summary.users.this_week} this week` : '',               icon: Users,       grad: 'from-indigo-600 to-purple-600' },
            { label: 'Total rides',      value: summary?.rides.total,         sub: summary ? `${summary.rides.open} open · ${summary.rides.full} full` : '', icon: TrendingUp, grad: 'from-emerald-600 to-green-600' },
            { label: 'Total bookings',   value: summary?.bookings.total,      sub: summary ? `${summary.bookings.acceptance_rate}% acceptance rate` : '',   icon: Activity,   grad: 'from-blue-600 to-cyan-600' },
            { label: 'Events logged',    value: events?.total_events,         sub: 'Observer-tracked actions',                                               icon: Zap,        grad: 'from-purple-600 to-pink-600' },
          ].map(({ label, value, sub, icon: Icon, grad }) => (
            <div key={label} className="glass-effect rounded-2xl shadow-2xl p-5 border border-white/10 hover:border-white/20 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 bg-gradient-to-br ${grad} rounded-xl group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? <span className="text-gray-600">…</span> : (value ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">{label}</div>
              {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Daily rides bar */}
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" /> Rides created — last 7 days
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily.length ? daily : Array(7).fill({ date: '—', rides: 0 })}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(20,21,24,.95)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff' }} />
                <Bar dataKey="rides" fill="#6366f1" name="Rides" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Booking pie */}
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" /> Booking status distribution
            </h3>
            {bookingPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={bookingPieData} cx="50%" cy="50%" outerRadius={95} labelLine={false}
                    label={({ name, percent, x, y, midAngle }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = 115;
                      const cx = 0; const cy = 0; // recharts centers at 50%/50%
                      return (
                        <text x={x} y={y} fill="#e5e7eb" textAnchor={x > 0 ? "start" : "end"} dominantBaseline="central" fontSize={11}>
                          {`${name}: ${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }} dataKey="value">
                    {bookingPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(20,21,24,.95)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff' }} />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-gray-500 text-sm">
                {loading ? 'Loading…' : 'No booking data yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Event types */}
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" /> Event breakdown (Observer log)
            </h3>
            {eventBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={eventBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(20,21,24,.95)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff' }} />
                  <Bar dataKey="count" fill="#8b5cf6" name="Events" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-gray-500 text-sm">
                {loading ? 'Loading…' : 'No events yet.'}
              </div>
            )}
          </div>

          {/* Mobility services */}
          <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" /> Mobility services (Factory)
            </h3>
            <div className="space-y-3">
              {loading ? <div className="text-gray-500 text-sm">Loading…</div>
                : services.length === 0 ? <div className="text-gray-500 text-sm">No data.</div>
                : services.map(svc => (
                  <div key={svc.service_type} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${svc.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="text-sm text-white font-medium">{svc.display_name}</div>
                        <div className="text-xs text-gray-500 capitalize">{svc.service_type}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                      {svc.station_count !== undefined && <div>{svc.station_count} stations</div>}
                      {svc.total_bikes_available !== undefined && <div>{svc.total_bikes_available} bikes</div>}
                      {svc.open_rides !== undefined && <div>{svc.open_rides} open rides</div>}
                      {svc.is_fallback && <div className="text-amber-400">Offline mode</div>}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Recent events */}
        <div className="glass-effect rounded-2xl shadow-2xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" /> Recent system activity
          </h3>
          <div className="space-y-2 overflow-x-auto">
            {loading ? <div className="text-sm text-gray-500">Loading…</div>
              : events?.recent?.length ? events.recent.slice(0, 12).map(ev => {
                const gradMap: Record<string, string> = {
                  ride_created:     'from-indigo-500 to-purple-500',
                  booking_created:  'from-blue-500 to-cyan-500',
                  booking_approved: 'from-emerald-500 to-green-500',
                  booking_rejected: 'from-red-500 to-rose-500',
                  user_registered:  'from-amber-500 to-orange-500',
                };
                const grad = gradMap[ev.event_type] || 'from-gray-500 to-gray-600';
                return (
                  <div key={ev.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${grad} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-200">{fmtEventType(ev.event_type)}</span>
                      {ev.user_id && <span className="text-xs text-gray-500 ml-2">user #{ev.user_id}</span>}
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">{timeAgoMtl(ev.created_at)}</div>
                  </div>
                );
              })
              : <div className="text-sm text-gray-500">No events yet — they appear when users create rides and bookings.</div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
