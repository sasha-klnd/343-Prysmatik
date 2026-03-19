# UrbiX — CO₂ & Cost Calculation Specification

**Version:** 1.0  
**Date:** 2026-03-19  
**Authors:** UrbiX Team (Prysmatik)  
**Status:** Accepted

---

## 1. Purpose

This document defines the constants, formulas, and rules used by the
`CO2Calculator` (Strategy pattern) and `CostCalculator` (Strategy pattern)
services to compute per-trip emissions and cost for every supported transport
mode in UrbiX.

All monetary values are in **Canadian dollars (CAD)**.  
All emissions values are in **kg of CO₂-equivalent (CO₂e)**.

---

## 2. Supported Modes

| Mode key   | Display name                     |
|------------|----------------------------------|
| `car`      | Solo gasoline passenger vehicle  |
| `carpool`  | Shared ride (≥ 2 occupants)      |
| `transit`  | STM bus + metro (Montréal)       |
| `bike`     | BIXI or personal bicycle         |
| `walking`  | On foot                          |

---

## 3. CO₂ Constants

**Source:** ADEME (Agence de la transition écologique) Base Empreinte v3.3 and
Transport Canada 2023 emissions report, adapted for Montréal urban context.

| Mode     | CO₂e constant (kg/km/passenger) | Notes |
|----------|----------------------------------|-------|
| `car`    | **0.192**                        | Average Canadian gasoline vehicle (sedan); includes fuel combustion + upstream extraction |
| `carpool`| 0.192 ÷ occupants               | Same vehicle emissions split across all occupants |
| `transit`| **0.041**                        | STM weighted average (metro + bus); metro is near-zero (hydro), bus is ~0.090 kg/km, weighted 60/40 |
| `bike`   | **0.000**                        | Zero direct emissions (manufacturing amortised separately, out of scope) |
| `walking`| **0.000**                        | Zero direct emissions |

### 3.1 Carpool CO₂ Rule

```
CO₂_per_passenger = (distance_km × 0.192) / occupants
```

The **occupants** parameter includes the driver.  
Default occupancy when not specified: **2** (driver + 1 passenger).

### 3.2 CO₂ Saved vs. Solo Car

All modes report a `co2_saved_vs_car` figure:

```
co2_saved = CO₂_car_solo − CO₂_chosen_mode
```

A positive value means the chosen mode emits less than driving alone.

---

## 4. Cost Constants

**Source:** CAA (Canadian Automobile Association) 2024 vehicle ownership costs;
STM 2024 fare schedule; BIXI Montréal 2024 pricing.

### 4.1 Car — Solo

| Parameter        | Value         | Source |
|------------------|---------------|--------|
| Cost per km      | **$0.18 CAD** | CAA average operating cost (fuel + oil + tires); excludes fixed ownership costs |

```
cost = distance_km × 0.18
```

### 4.2 Carpool — Shared

Same vehicle running cost as solo car, split equally across all occupants
(driver + passengers).

```
total_vehicle_cost = distance_km × 0.18
cost_per_person   = total_vehicle_cost / occupants
```

Default occupancy: **2**.

### 4.3 Transit — STM (Flat fare)

STM Montréal charges a flat adult fare regardless of distance.

| Fare type     | Price      |
|---------------|------------|
| Single fare   | **$3.75**  |

```
cost = $3.75  (flat, regardless of distance)
```

> Note: Monthly pass holders pay $103/month. The per-trip simulation uses
> the single fare as a conservative per-trip cost.

### 4.4 BIXI — Day Pass Model

| Parameter              | Value         |
|------------------------|---------------|
| Day pass               | **$7.25**     |
| First free window      | 45 minutes    |
| Extra block duration   | 30 minutes    |
| Extra block cost       | **$1.25**     |
| Assumed cycling speed  | 15 km/h       |

```
duration_min = (distance_km / 15.0) × 60

if duration_min ≤ 45:
    cost = $7.25
else:
    extra_blocks = ceil((duration_min − 45) / 30)
    cost = $7.25 + extra_blocks × $1.25
```

A trip of ≤ 11.25 km fits within the free 45-minute window.

### 4.5 Walking

```
cost = $0.00
```

---

## 5. Money Saved vs. Solo Car

```
money_saved = cost_car_solo − cost_chosen_mode
```

A positive value means the chosen mode costs less than driving alone.

---

## 6. User Dashboard Totals (Issue 14)

Since UrbiX does not currently store per-booking distance, the dashboard
uses an **estimated average urban trip distance of 6.5 km** for Montréal,
derived from the STM's 2023 Origin-Destination survey (average trip length
for intra-island trips: 6.4 km).

```
total_distance_km = total_carpool_trips × 6.5
```

This constant is defined in `calculator_controller.py` as `AVG_TRIP_KM = 6.5`
and should be replaced by actual stored distance once GPS integration is added.

---

## 7. Versioning

| Version | Date       | Change |
|---------|------------|--------|
| 1.0     | 2026-03-19 | Initial spec — defines all constants and formulas |
