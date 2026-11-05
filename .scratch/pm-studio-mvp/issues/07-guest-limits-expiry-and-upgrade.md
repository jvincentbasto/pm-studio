# 07: Guest limits, expiry, and upgrade

**What to build:** Guests can understand and respect usage and time limits, and can become full users without losing their workspace data.

**Blocked by:** 06: Guest account onboarding.

**Status:** ready-for-human

- [x] The implementation sets explicit per-resource caps, using 10 records per resource as the initial target unless deployment constraints require a documented adjustment.
- [x] The implementation defines the 3-day retention start, communicates expiry, and removes expired Guest data.
- [x] Guests receive a clear explanation when they reach a cap or their account expires.
- [x] A Guest can become a full account while retaining their workspace, projects, and tasks.
