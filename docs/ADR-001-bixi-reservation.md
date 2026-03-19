# ADR-001: BIXI Reservation Flow — Delegate vs. Direct

**Date:** 2026-03-19  
**Status:** Accepted  
**Deciders:** UrbiX Team (Prysmatik)

---

## Context

Issue 7 required a product decision on how UrbiX handles the BIXI reservation flow:

- **Option A (Delegate):** Deep-link the user to the official BIXI app or website.
- **Option B (Direct):** Build a native reservation flow inside UrbiX using a BIXI API.

---

## Decision

We chose **Option A — Delegate to the BIXI app/website**.

---

## Rationale

| Factor | Option A — Delegate | Option B — Direct |
|--------|--------------------|--------------------|
| BIXI API availability | No public booking API exposed | Would require private partnership |
| Maintenance burden | None — BIXI owns their flow | High — must track BIXI pricing/station changes |
| Payment security | Handled by BIXI (PCI-compliant) | UrbiX would need Stripe + BIXI tokenisation |
| Time to implement | Hours (link only) | Weeks–months |
| User trust | Users already trust the BIXI brand | Unknown — users may be wary of third-party payments |
| Sprint 3 feasibility | ✅ Fully feasible now | ❌ Not feasible in Sprint 3 |

The BIXI GBFS feed (General Bikeshare Feed Specification) is **public** and provides
real-time station data. We integrate this via the `BixiService` Singleton.
For actual bike unlocking and reservation, users are directed to `bixi.com`
or the BIXI app via a clearly labelled external link.

---

## Implementation

In `BixiScreen.tsx`, each station card shows an "Open in BIXI app →" anchor tag
pointing to `https://bixi.com/en/find-a-station`.

```tsx
<a href="https://bixi.com/en/find-a-station" target="_blank" rel="noopener noreferrer">
  Open in BIXI app →
</a>
```

---

## Consequences

- **Positive:** Zero payment handling complexity; no dependency on a private API.
- **Positive:** UrbiX always shows accurate real-time availability (GBFS) without
  being responsible for the booking transaction.
- **Negative:** User leaves the UrbiX app to complete the transaction — conversion
  tracking is not possible.
- **Future work:** If BIXI exposes a booking API (or if the city launches an open
  mobility API via Mobilité Montréal), Option B can be revisited and implemented
  using the `MobilityServiceFactory` extension point without changing existing code.
