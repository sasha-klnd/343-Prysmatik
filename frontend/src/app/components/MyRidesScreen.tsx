import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Calendar,
    Check,
    ChevronLeft,
    Clock,
    Edit,
    MapPin,
    RefreshCcw,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { apiFetch } from '@/api/client';

interface MyRidesScreenProps {
    onBack: () => void;
    isAuthenticated: boolean;
    onRequireAuth: (action: string) => void;
}

type RideStatus = 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
type BookingStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

type SafeUser = {
    id: number;
    name: string;
    created_at?: string;
};

type Ride = {
    id: number;
    departure: string;
    destination: string;
    departure_datetime: string;
    seats_available: number;
    status: RideStatus;
    creator: SafeUser;
    requests_count?: number;
};

type Booking = {
    id: number;
    ride_post_id: number;
    passenger: SafeUser;
    seats_requested: number;
    status: BookingStatus;
    created_at: string;
};

type RequestedItem = {
    booking: Booking;
    ride: Ride;
};

function formatDate(dtIso: string) {
    const d = new Date(dtIso);
    // YYYY-MM-DD
    return d.toISOString().slice(0, 10);
}

function formatTime(dtIso: string) {
    const d = new Date(dtIso);
    return d.toTimeString().slice(0, 5);
}

export function MyRidesScreen({ onBack, isAuthenticated, onRequireAuth }: MyRidesScreenProps) {
    const [activeTab, setActiveTab] = useState<'offering' | 'requested'>('offering');

    const [offeredRides, setOfferedRides] = useState<Ride[]>([]);
    const [requestedRides, setRequestedRides] = useState<RequestedItem[]>([]);

    const [requestsByRide, setRequestsByRide] = useState<Record<number, Booking[]>>({});
    const [expandedRideId, setExpandedRideId] = useState<number | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const [editingRide, setEditingRide] = useState<Ride | null>(null);
    const [editForm, setEditForm] = useState({
        departure: '',
        destination: '',
        date: '',
        time: '',
        seatsAvailable: 1,
    });

    const showToastMsg = (msg: string) => {
        setToastMessage(msg);
        setShowToast(true);
        window.setTimeout(() => setShowToast(false), 2500);
    };

    const statusBadge = (status: RideStatus | BookingStatus) => {
        const map: Record<string, { bg: string; border: string; text: string; label: string }> = {
            OPEN: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Open' },
            FULL: { bg: 'bg-amber-600/20', border: 'border-amber-500/30', text: 'text-amber-300', label: 'Full' },
            CANCELLED: { bg: 'bg-gray-600/20', border: 'border-gray-500/30', text: 'text-gray-300', label: 'Cancelled' },
            COMPLETED: { bg: 'bg-gray-600/20', border: 'border-gray-500/30', text: 'text-gray-300', label: 'Completed' },
            PENDING: { bg: 'bg-blue-600/20', border: 'border-blue-500/30', text: 'text-blue-300', label: 'Pending' },
            ACCEPTED: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Approved' },
            REJECTED: { bg: 'bg-red-600/20', border: 'border-red-500/30', text: 'text-red-300', label: 'Rejected' },
        };
        const s = map[status] ?? map.PENDING;
        return (
            <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${s.bg} ${s.text} border ${s.border}`}>
                {s.label}
            </span>
        );
    };

    const loadOffered = async () => {
        if (!isAuthenticated) {
            onRequireAuth('view your offered rides');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const rides = await apiFetch('/rides/mine/offered');
            setOfferedRides(rides);
        } catch (e: any) {
            setError(e?.message || 'Failed to load offered rides');
        } finally {
            setLoading(false);
        }
    };

    const loadRequested = async () => {
        if (!isAuthenticated) {
            onRequireAuth('view your requested rides');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch('/rides/mine/requested');
            setRequestedRides(data);
        } catch (e: any) {
            setError(e?.message || 'Failed to load requested rides');
        } finally {
            setLoading(false);
        }
    };

    const loadRequestsForRide = async (rideId: number) => {
        if (!isAuthenticated) {
            onRequireAuth('view ride requests');
            return;
        }

        setError(null);
        try {
            const reqs = await apiFetch(`/rides/${rideId}/requests`);
            setRequestsByRide((prev) => ({ ...prev, [rideId]: reqs }));
        } catch (e: any) {
            setError(e?.message || 'Failed to load requests');
        }
    };

    useEffect(() => {
        if (!isAuthenticated) {
            // Don't call authenticated endpoints when logged out
            setOfferedRides([]);
            setRequestedRides([]);
            setRequestsByRide({});
            setExpandedRideId(null);
            return;
        }

        if (activeTab === 'offering') {
            loadOffered();
        } else {
            loadRequested();
        }
        // collapse requests when switching tabs
        setExpandedRideId(null);
    }, [activeTab]);

    const openEdit = (ride: Ride) => {
        setEditingRide(ride);
        setEditForm({
            departure: ride.departure,
            destination: ride.destination,
            date: formatDate(ride.departure_datetime),
            time: formatTime(ride.departure_datetime),
            seatsAvailable: ride.seats_available,
        });
    };

    const saveEdit = async () => {
        if (!isAuthenticated) {
            onRequireAuth('edit a ride');
            return;
        }

        if (!editingRide) return;
        setError(null);
        try {
            await apiFetch(`/rides/${editingRide.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    departure: editForm.departure,
                    destination: editForm.destination,
                    date: editForm.date,
                    time: editForm.time,
                    seats_available: editForm.seatsAvailable,
                }),
            });
            showToastMsg('Ride updated');
            setEditingRide(null);
            await loadOffered();
            if (expandedRideId === editingRide.id) {
                await loadRequestsForRide(editingRide.id);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to update ride');
        }
    };

    const deleteRide = async (rideId: number) => {
        if (!isAuthenticated) {
            onRequireAuth('delete a ride');
            return;
        }

        const ok = window.confirm('Delete this ride offer?');
        if (!ok) return;
        setError(null);
        try {
            await apiFetch(`/rides/${rideId}`, { method: 'DELETE' });
            showToastMsg('Ride deleted');
            setExpandedRideId(null);
            await loadOffered();
        } catch (e: any) {
            setError(e?.message || 'Failed to delete ride');
        }
    };

    const approve = async (bookingId: number, rideId: number) => {
        if (!isAuthenticated) {
            onRequireAuth('approve a request');
            return;
        }

        setError(null);
        try {
            await apiFetch(`/rides/requests/${bookingId}/approve`, { method: 'POST' });
            showToastMsg('Passenger approved (email sent)');
            await loadOffered();
            await loadRequestsForRide(rideId);
        } catch (e: any) {
            setError(e?.message || 'Failed to approve request');
        }
    };

    const reject = async (bookingId: number, rideId: number) => {
        if (!isAuthenticated) {
            onRequireAuth('reject a request');
            return;
        }

        setError(null);
        try {
            await apiFetch(`/rides/requests/${bookingId}/reject`, { method: 'POST' });
            showToastMsg('Request rejected (email sent)');
            await loadRequestsForRide(rideId);
        } catch (e: any) {
            setError(e?.message || 'Failed to reject request');
        }
    };

    const cancelRequest = async (bookingId: number) => {
        if (!isAuthenticated) {
            onRequireAuth('cancel a request');
            return;
        }

        const ok = window.confirm('Cancel this ride request?');
        if (!ok) return;
        setError(null);
        try {
            await apiFetch(`/rides/requests/${bookingId}`, { method: 'DELETE' });
            showToastMsg('Request cancelled');
            await loadRequested();
        } catch (e: any) {
            setError(e?.message || 'Failed to cancel request');
        }
    };

    const offeredEmpty = useMemo(
        () => !loading && !error && offeredRides.length === 0,
        [loading, error, offeredRides.length]
    );
    const requestedEmpty = useMemo(
        () => !loading && !error && requestedRides.length === 0,
        [loading, error, requestedRides.length]
    );

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0b1020] to-[#110a1a] text-white">
                <div className="max-w-5xl mx-auto p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={onBack}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-gray-200 hover:bg-white/5"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <h1 className="text-2xl font-bold">My Rides</h1>
                    </div>

                    <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-indigo-300 mt-0.5" />
                            <div>
                                <div className="font-semibold">Sign in required</div>
                                <p className="text-sm text-gray-300 mt-1">
                                    You need to be signed in to view and manage your ride offers and requests.
                                </p>
                                <button
                                    onClick={() => onRequireAuth('view your rides')}
                                    className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                                >
                                    Sign in
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0f1012] to-[#141518] pb-12">
            {/* Toast */}
            {showToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 glass-effect border border-white/10 rounded-xl px-6 py-4 shadow-2xl backdrop-blur-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-sm font-medium text-white">{toastMessage}</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="glass-effect border-b border-white/10 p-6 backdrop-blur-2xl sticky top-0 z-40">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/10"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-300" />
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Users className="w-7 h-7 text-indigo-400" />
                                    My Rides
                                </h2>
                                <p className="text-sm text-gray-400">Manage your offered and requested rides</p>
                            </div>
                        </div>

                        <button
                            onClick={() => (activeTab === 'offering' ? loadOffered() : loadRequested())}
                            className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-gray-200 text-sm flex items-center gap-2"
                        >
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-6xl mx-auto px-6 mt-6">
                <div className="glass-effect rounded-2xl p-2 inline-flex gap-2 border border-white/10">
                    <button
                        onClick={() => setActiveTab('offering')}
                        className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'offering'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Rides I'm Offering
                    </button>
                    <button
                        onClick={() => setActiveTab('requested')}
                        className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'requested'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Rides I Requested
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="max-w-6xl mx-auto px-6 mt-6">
                    <div className="glass-effect rounded-2xl p-4 border border-red-500/20 text-red-200 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 mt-6">
                {activeTab === 'offering' ? (
                    <div className="space-y-6">
                        {offeredEmpty ? (
                            <div className="glass-effect rounded-2xl p-12 border border-white/10 text-center">
                                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                                <p className="text-gray-400">No rides offered</p>
                            </div>
                        ) : (
                            offeredRides.map((ride) => {
                                const requests = requestsByRide[ride.id]; // Booking[] | undefined
                                const requestsList = requests ?? []; // ✅ ALWAYS an array for rendering
                                const requestCount = requests ? requests.length : (ride.requests_count ?? 0);
                                const isExpanded = expandedRideId === ride.id;

                                return (
                                    <div key={ride.id} className="glass-effect rounded-2xl p-6 border border-white/10 shadow-xl">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <MapPin className="w-5 h-5 text-indigo-400" />
                                                    <h3 className="text-lg font-bold text-white">
                                                        {ride.departure} → {ride.destination}
                                                    </h3>
                                                    {statusBadge(ride.status)}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-gray-400" />
                                                        {formatDate(ride.departure_datetime)}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-gray-400" />
                                                        {formatTime(ride.departure_datetime)}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4 text-gray-400" />
                                                        {ride.seats_available} seats available
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEdit(ride)}
                                                    className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/10"
                                                    title="Edit ride"
                                                >
                                                    <Edit className="w-4 h-4 text-gray-300" />
                                                </button>
                                                <button
                                                    onClick={() => deleteRide(ride.id)}
                                                    className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/10"
                                                    title="Delete ride"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-300" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-gray-400">
                                                Requests: <span className="text-white font-semibold">{requestCount}</span>
                                            </p>
                                            <button
                                                onClick={async () => {
                                                    if (isExpanded) {
                                                        setExpandedRideId(null);
                                                    } else {
                                                        setExpandedRideId(ride.id);
                                                        await loadRequestsForRide(ride.id);
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-gray-200 text-sm"
                                            >
                                                {isExpanded ? 'Hide requests' : 'View requests'}
                                            </button>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-6 border-t border-white/10 pt-6 space-y-4">
                                                {requestsList.length === 0 ? (
                                                    <div className="text-sm text-gray-400">No requests yet.</div>
                                                ) : (
                                                    requestsList.map((req) => (
                                                        <div
                                                            key={req.id}
                                                            className="flex items-center justify-between rounded-xl border border-white/10 p-4"
                                                        >
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <p className="text-white font-semibold">{req.passenger.name}</p>
                                                                    {statusBadge(req.status)}
                                                                    <span className="text-xs text-gray-400">(User #{req.passenger.id})</span>
                                                                </div>
                                                                <p className="text-xs text-gray-400 mt-1">Seats requested: {req.seats_requested}</p>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    Requested at: {new Date(req.created_at).toLocaleString()}
                                                                </p>
                                                            </div>

                                                            {req.status === 'PENDING' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => approve(req.id, ride.id)}
                                                                        className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-600/30 text-sm"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                    <button
                                                                        onClick={() => reject(req.id, ride.id)}
                                                                        className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-200 hover:bg-red-600/30 text-sm"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-gray-400">No action needed</div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {requestedEmpty ? (
                            <div className="glass-effect rounded-2xl p-12 border border-white/10 text-center">
                                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                                <p className="text-gray-400">No ride requests yet</p>
                            </div>
                        ) : (
                            requestedRides.map((item) => {
                                const ride = item.ride;
                                const booking = item.booking;
                                return (
                                    <div key={booking.id} className="glass-effect rounded-2xl p-6 border border-white/10 shadow-xl">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <MapPin className="w-5 h-5 text-indigo-400" />
                                                    <h3 className="text-lg font-bold text-white">
                                                        {ride.departure} → {ride.destination}
                                                    </h3>
                                                    {statusBadge(booking.status)}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-gray-400" />
                                                        {formatDate(ride.departure_datetime)}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-gray-400" />
                                                        {formatTime(ride.departure_datetime)}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4 text-gray-400" />
                                                        Seats requested: {booking.seats_requested}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-400 mt-3">
                                                    Driver: <span className="text-white font-semibold">{ride.creator.name}</span>{' '}
                                                    <span className="text-xs text-gray-500">(User #{ride.creator.id})</span>
                                                </p>
                                            </div>

                                            {(booking.status === 'PENDING' || booking.status === 'ACCEPTED') ? (
                                                <button
                                                    onClick={() => cancelRequest(booking.id)}
                                                    className="px-4 py-2 rounded-xl bg-gray-600/20 border border-white/10 text-gray-200 hover:bg-white/5 text-sm flex items-center gap-2"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Cancel
                                                </button>
                                            ) : (
                                                <div className="text-xs text-gray-400">No actions</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Edit modal */}
            {editingRide && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                    <div className="w-full max-w-xl glass-effect border border-white/10 rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Edit Ride</h3>
                            <button
                                onClick={() => setEditingRide(null)}
                                className="p-2 rounded-xl border border-white/10 hover:bg-white/5"
                            >
                                <X className="w-4 h-4 text-gray-200" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-400">Departure</label>
                                <input
                                    value={editForm.departure}
                                    onChange={(e) => setEditForm((p) => ({ ...p, departure: e.target.value }))}
                                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Destination</label>
                                <input
                                    value={editForm.destination}
                                    onChange={(e) => setEditForm((p) => ({ ...p, destination: e.target.value }))}
                                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Date</label>
                                <input
                                    type="date"
                                    value={editForm.date}
                                    onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Time</label>
                                <input
                                    type="time"
                                    value={editForm.time}
                                    onChange={(e) => setEditForm((p) => ({ ...p, time: e.target.value }))}
                                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white outline-none"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-xs text-gray-400">Seats Available</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={8}
                                    value={editForm.seatsAvailable}
                                    onChange={(e) => setEditForm((p) => ({ ...p, seatsAvailable: Number(e.target.value) }))}
                                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-6">
                            <button
                                onClick={() => setEditingRide(null)}
                                className="px-4 py-2 rounded-xl border border-white/10 text-gray-200 hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button onClick={saveEdit} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}