"""
UrbiX Database Seeder
=====================
Populates the database with realistic test data for Sprint 3 demo.

Usage (from backend/ directory):
    python seed.py

This will:
  - Create 5 test users (including 1 admin-like power user)
  - Create carpool ride posts between real Montréal locations
  - Create bookings between users
  - Create trip logs across all transport modes
  - Create analytics events

All passwords are: Password123!
"""

import sys
import os

# Make sure we can import the app
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db, bcrypt
from app.models import User, UserPreferences, RidePost, CarpoolBooking
from app.models.analytics_event import AnalyticsEvent
from app.models.trip import Trip
from datetime import datetime, timedelta
import json

app = create_app()

USERS = [
    {
        "name": "Alice Tremblay",
        "email": "alice@urbix.com",
        "phone": "514-555-0101",
        "prefs": {
            "max_walking_time": 10,
            "budget_sensitivity": 80,
            "prefer_transit": True,
            "prefer_bike": True,
            "prefer_carpool": True,
            "prefer_driving": False,
            "prefer_walking": True,
            "allow_smoking": False,
            "allow_pets": True,
            "music_ok": True,
            "chatty": True,
        },
    },
    {
        "name": "Marc Bouchard",
        "email": "marc@urbix.com",
        "phone": "514-555-0202",
        "prefs": {
            "max_walking_time": 20,
            "budget_sensitivity": 30,
            "prefer_transit": True,
            "prefer_bike": False,
            "prefer_carpool": True,
            "prefer_driving": True,
            "prefer_walking": False,
            "allow_smoking": False,
            "allow_pets": False,
            "music_ok": True,
            "chatty": False,
        },
    },
    {
        "name": "Sophie Lavoie",
        "email": "sophie@urbix.com",
        "phone": "514-555-0303",
        "prefs": {
            "max_walking_time": 15,
            "budget_sensitivity": 60,
            "prefer_transit": True,
            "prefer_bike": True,
            "prefer_carpool": False,
            "prefer_driving": False,
            "prefer_walking": True,
            "allow_smoking": False,
            "allow_pets": False,
            "music_ok": False,
            "chatty": False,
        },
    },
    {
        "name": "Kourosh Karimianboneh",
        "email": "kourosh@urbix.com",
        "phone": "514-555-0404",
        "prefs": {
            "max_walking_time": 15,
            "budget_sensitivity": 50,
            "prefer_transit": True,
            "prefer_bike": True,
            "prefer_carpool": True,
            "prefer_driving": False,
            "prefer_walking": True,
            "allow_smoking": False,
            "allow_pets": True,
            "music_ok": True,
            "chatty": True,
        },
    },
    {
        "name": "Jean-François Roy",
        "email": "jf@urbix.com",
        "phone": "514-555-0505",
        "prefs": {
            "max_walking_time": 5,
            "budget_sensitivity": 90,
            "prefer_transit": True,
            "prefer_bike": False,
            "prefer_carpool": True,
            "prefer_driving": False,
            "prefer_walking": True,
            "wheelchair_accessible": True,
            "elevator_required": True,
            "allow_smoking": False,
            "allow_pets": False,
            "music_ok": False,
            "chatty": False,
        },
    },
]

RIDES = [
    {
        "creator_idx":  0,  # Alice
        "departure":    "Brossard, Mail Champlain",
        "destination":  "Concordia University, Guy-Concordia",
        "days_ahead":   1,
        "hour":         8,
        "minute":       0,
        "seats":        3,
        "allow_smoking": False,
        "allow_pets":   True,
        "music_ok":     True,
        "chatty":       True,
    },
    {
        "creator_idx":  1,  # Marc
        "departure":    "Longueuil, Métro Longueuil",
        "destination":  "McGill University",
        "days_ahead":   1,
        "hour":         7,
        "minute":       45,
        "seats":        2,
        "allow_smoking": False,
        "allow_pets":   False,
        "music_ok":     True,
        "chatty":       False,
    },
    {
        "creator_idx":  3,  # Kourosh
        "departure":    "Plateau-Mont-Royal, Métro Mont-Royal",
        "destination":  "Vieux-Port, Rue Saint-Paul",
        "days_ahead":   2,
        "hour":         9,
        "minute":       30,
        "seats":        2,
        "allow_smoking": False,
        "allow_pets":   True,
        "music_ok":     True,
        "chatty":       True,
    },
    {
        "creator_idx":  2,  # Sophie
        "departure":    "Côte-des-Neiges, Métro Côte-des-Neiges",
        "destination":  "UQAM, Métro Berri-UQAM",
        "days_ahead":   1,
        "hour":         8,
        "minute":       30,
        "seats":        3,
        "allow_smoking": False,
        "allow_pets":   False,
        "music_ok":     False,
        "chatty":       False,
    },
    {
        "creator_idx":  4,  # Jean-François
        "departure":    "Laval, Métro Montmorency",
        "destination":  "Concordia University",
        "days_ahead":   3,
        "hour":         7,
        "minute":       15,
        "seats":        4,
        "allow_smoking": False,
        "allow_pets":   False,
        "music_ok":     False,
        "chatty":       False,
    },
    {
        "creator_idx":  0,  # Alice
        "departure":    "Brossard, DIX30",
        "destination":  "Centre-Ville, Place-des-Arts",
        "days_ahead":   4,
        "hour":         10,
        "minute":       0,
        "seats":        2,
        "allow_smoking": False,
        "allow_pets":   True,
        "music_ok":     True,
        "chatty":       True,
    },
]

TRIPS = [
    # Alice's trips
    {"user_idx": 0, "mode": "bike",    "distance_km": 4.2,  "note": "BIXI from Berri to Plateau"},
    {"user_idx": 0, "mode": "transit", "distance_km": 8.5,  "note": "STM from Brossard to McGill"},
    {"user_idx": 0, "mode": "carpool", "distance_km": 22.0, "note": "Carpool Mail Champlain → Concordia"},
    {"user_idx": 0, "mode": "walking", "distance_km": 1.2,  "note": "Walk to the metro"},
    # Marc's trips
    {"user_idx": 1, "mode": "transit", "distance_km": 12.3, "note": "Metro Orange line"},
    {"user_idx": 1, "mode": "carpool", "distance_km": 18.5, "note": "Carpool Longueuil → Downtown"},
    {"user_idx": 1, "mode": "car",     "distance_km": 15.0, "note": "Drive to Laval"},
    # Sophie's trips
    {"user_idx": 2, "mode": "bike",    "distance_km": 3.8,  "note": "BIXI Plateau circuit"},
    {"user_idx": 2, "mode": "transit", "distance_km": 6.1,  "note": "Bus 55"},
    {"user_idx": 2, "mode": "walking", "distance_km": 2.0,  "note": "Walk in Vieux-Port"},
    # Kourosh's trips
    {"user_idx": 3, "mode": "bike",    "distance_km": 5.5,  "note": "BIXI commute"},
    {"user_idx": 3, "mode": "transit", "distance_km": 9.2,  "note": "Metro Green line"},
    {"user_idx": 3, "mode": "carpool", "distance_km": 25.0, "note": "Carpool from Plateau"},
    # Jean-François
    {"user_idx": 4, "mode": "transit", "distance_km": 28.0, "note": "Bus + Metro from Laval"},
    {"user_idx": 4, "mode": "transit", "distance_km": 14.5, "note": "Metro Orange + Green"},
]


def seed():
    with app.app_context():
        print("🌱 Seeding UrbiX database...")

        # Clear existing data
        db.session.query(Trip).delete()
        db.session.query(AnalyticsEvent).delete()
        db.session.query(CarpoolBooking).delete()
        db.session.query(RidePost).delete()
        db.session.query(UserPreferences).delete()
        db.session.query(User).delete()
        db.session.commit()
        print("  ✓ Cleared existing data")

        # Create users
        users = []
        pw_hash = bcrypt.generate_password_hash("Password123!").decode("utf-8")
        for i, u in enumerate(USERS):
            user = User(
                full_name=u["name"],
                email=u["email"],
                password_hash=pw_hash,
                phone=u["phone"],
                created_at=datetime.utcnow() - timedelta(days=30 - i * 5),
                # Seed users are pre-verified so the banner doesn't show in demos
                **({
                    "is_verified": True,
                    "verification_token": None,
                } if hasattr(User, "is_verified") else {}),
            )
            db.session.add(user)
            db.session.flush()

            p = u["prefs"]
            prefs = UserPreferences(
                user=user,
                max_walking_time=p.get("max_walking_time", 15),
                budget_sensitivity=p.get("budget_sensitivity", 50),
                prefer_transit=p.get("prefer_transit", True),
                prefer_bike=p.get("prefer_bike", True),
                prefer_carpool=p.get("prefer_carpool", False),
                prefer_driving=p.get("prefer_driving", False),
                prefer_walking=p.get("prefer_walking", True),
                wheelchair_accessible=p.get("wheelchair_accessible", False),
                elevator_required=p.get("elevator_required", False),
                avoid_stairs=p.get("avoid_stairs", False),
                allow_smoking=p.get("allow_smoking", False),
                allow_pets=p.get("allow_pets", False),
                music_ok=p.get("music_ok", True),
                chatty=p.get("chatty", True),
            )
            db.session.add(prefs)
            users.append(user)

        db.session.commit()
        print(f"  ✓ Created {len(users)} users")

        # Create ride posts
        rides = []
        for r in RIDES:
            dt = datetime.utcnow() + timedelta(days=r["days_ahead"],
                                               hours=r["hour"], minutes=r["minute"])
            ride = RidePost(
                creator=users[r["creator_idx"]],
                departure=r["departure"],
                destination=r["destination"],
                departure_datetime=dt,
                seats_available=r["seats"],
                status="OPEN",
                allow_smoking=r.get("allow_smoking", False),
                allow_pets=r.get("allow_pets", False),
                music_ok=r.get("music_ok", True),
                chatty=r.get("chatty", True),
                created_at=datetime.utcnow() - timedelta(hours=2),
            )
            db.session.add(ride)
            rides.append(ride)

        db.session.commit()
        print(f"  ✓ Created {len(rides)} ride posts")

        # Create some bookings
        bookings_data = [
            {"ride_idx": 0, "passenger_idx": 3, "status": "ACCEPTED", "seats": 1},  # Kourosh joins Alice
            {"ride_idx": 0, "passenger_idx": 4, "status": "PENDING",  "seats": 1},  # JF pending on Alice
            {"ride_idx": 1, "passenger_idx": 2, "status": "ACCEPTED", "seats": 1},  # Sophie joins Marc
            {"ride_idx": 2, "passenger_idx": 1, "status": "ACCEPTED", "seats": 1},  # Marc joins Kourosh
            {"ride_idx": 3, "passenger_idx": 3, "status": "PENDING",  "seats": 1},  # Kourosh pending on Sophie
        ]
        for b in bookings_data:
            booking = CarpoolBooking(
                ride_post=rides[b["ride_idx"]],
                passenger=users[b["passenger_idx"]],
                seats_requested=b["seats"],
                status=b["status"],
                created_at=datetime.utcnow() - timedelta(hours=1),
            )
            db.session.add(booking)
            # Decrement seats for accepted bookings so the ride reflects reality
            if b["status"] == "ACCEPTED":
                ride = rides[b["ride_idx"]]
                ride.seats_available = max(0, ride.seats_available - b["seats"])
                if ride.seats_available == 0:
                    ride.status = "FULL"

        db.session.commit()
        print(f"  ✓ Created {len(bookings_data)} bookings")

        # Create trip logs
        for t in TRIPS:
            trip = Trip(
                user_id=users[t["user_idx"]].id,
                mode=t["mode"],
                distance_km=t["distance_km"],
                note=t["note"],
                created_at=datetime.utcnow() - timedelta(days=len(TRIPS) - TRIPS.index(t)),
            )
            db.session.add(trip)

        db.session.commit()
        print(f"  ✓ Created {len(TRIPS)} trip logs")

        # Create analytics events
        events = [
            ("user_registered",   users[0].id, {"email": users[0].email}),
            ("user_registered",   users[1].id, {"email": users[1].email}),
            ("user_registered",   users[2].id, {"email": users[2].email}),
            ("user_registered",   users[3].id, {"email": users[3].email}),
            ("user_registered",   users[4].id, {"email": users[4].email}),
            ("ride_created",      users[0].id, {"ride_id": rides[0].id}),
            ("ride_created",      users[1].id, {"ride_id": rides[1].id}),
            ("ride_created",      users[3].id, {"ride_id": rides[2].id}),
            ("booking_created",   users[3].id, {"ride_id": rides[0].id}),
            ("booking_approved",  users[0].id, {"ride_id": rides[0].id}),
            ("booking_created",   users[2].id, {"ride_id": rides[1].id}),
            ("booking_approved",  users[1].id, {"ride_id": rides[1].id}),
            ("trip_logged",       users[0].id, {"mode": "bike", "distance_km": 4.2}),
            ("trip_logged",       users[3].id, {"mode": "transit", "distance_km": 9.2}),
        ]
        for i, (evt_type, uid, meta) in enumerate(events):
            evt = AnalyticsEvent(
                event_type=evt_type,
                user_id=uid,
                event_metadata=json.dumps(meta),
                created_at=datetime.utcnow() - timedelta(hours=len(events) - i),
            )
            db.session.add(evt)

        db.session.commit()
        print(f"  ✓ Created {len(events)} analytics events")

        print("\n✅ Seed complete!")
        print("\n📋 Test accounts (all passwords: Password123!):")
        for u in USERS:
            print(f"   {u['email']}")
        print(f"\n🚗 {len(rides)} open carpool rides ready")
        print(f"📊 Admin: admin@urbix.com / Admin123!")


if __name__ == "__main__":
    seed()
