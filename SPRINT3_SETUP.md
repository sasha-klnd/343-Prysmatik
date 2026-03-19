# Sprint 3 — Setup & Migration Guide

## 1. Install new backend dependency

```bash
cd backend
pip install -r requirements.txt
```

The new dependency is `requests==2.31.0` (used by BixiService to call the GBFS API).

## 2. Run database migrations

Sprint 3 adds two new DB tables and four new columns:

```bash
cd backend
flask db migrate -m "sprint3_analytics_events_and_ride_preferences"
flask db upgrade
```

**New table:** `analytics_events` — stores Observer-tracked events.

**New columns on `user_preferences`:**
- `allow_smoking` (boolean, default False)
- `allow_pets` (boolean, default False)
- `music_ok` (boolean, default True)
- `chatty` (boolean, default True)

**New columns on `ride_posts`:**
- `meetup_lat` (float, nullable)
- `meetup_lng` (float, nullable)
- `allow_smoking` (boolean, default False)
- `allow_pets` (boolean, default False)
- `music_ok` (boolean, default True)
- `chatty` (boolean, default True)

## 3. Start the backend

```bash
cd backend
flask run
```

Or with gunicorn:
```bash
gunicorn "app:create_app()"
```

## 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

## 5. New routes & screens

| Route | Screen |
|-------|--------|
| `/api/bixi/stations` | BIXI station data (GET) |
| `/api/bixi/refresh` | Force cache refresh (POST) |
| `/api/analytics/summary` | Admin KPIs (admin JWT required) |
| `/api/analytics/events` | Observer event log (admin JWT required) |
| `/api/analytics/rides/daily` | Daily ride counts (admin JWT required) |
| `/api/analytics/mobility/services` | Factory service status (admin JWT required) |
| `/api/calculate/trip` | CO₂ + cost for a trip (POST) |
| `/api/calculate/modes` | Compare all modes (GET) |
| `/api/calculate/my-stats` | User dashboard totals (authenticated GET) |

| Frontend screen | Navigation item |
|----------------|-----------------|
| `BixiScreen` | BIXI nav item |
| `TransitScreen` | Transit nav item |
| `AdminDashboard` | Admin icon (now uses real backend data) |

## 6. Design patterns implemented

| Pattern | Where | Files |
|---------|-------|-------|
| **Strategy** | CO₂ calculation | `services/co2_service.py` |
| **Strategy** | Cost calculation | `services/cost_service.py` |
| **Observer** | Analytics event bus | `services/event_bus.py`, all controllers |
| **Singleton** | BIXI station cache | `services/bixi_service.py` |
| **Factory** | Mobility service registry | `services/mobility_factory.py` |
