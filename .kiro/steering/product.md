---
inclusion: always
---

# Product: USSD-Reborn (GhostSignal)

## Vision
When mobile data is dead, expensive, or out of reach, the 2G GSM/USSD signaling channel (`*xxx#`) still works on any phone. Classic USSD menus are rigid and hand-coded per service. GhostSignal resurrects the 2G USSD protocol (`CON`/`END`, 160 GSM-7 chars per screen) with a universal declarative skeleton and an AI semantic compressor backed by a deterministic local fallback.

## Kiroween 2026 category: Skeleton Crew
- One lightweight, domain-agnostic skeleton in `core/` (strictly under 400 logical lines).
- Four radically different child apps driven only by declarative manifests in `apps/`:
  - **Featured SIM 1 — `apps/night-rx` (`*384*1#`, NightRx 24/7)**: 24/7 duty pharmacies, 2-hour urgent medicine hold, SHA-256 anti-counterfeit drug box seal verification, and AI symptom/dosage triage. Ectoplasm green theme.
  - **Featured SIM 2 — `apps/bite2g` (`*384*2#`, Bite2G Delivery)**: zero-data hot meal delivery, moto rider tracking with a 2-digit security handshake PIN, AI craving matcher, and voucher checker. Jack-o'-Lantern amber theme.
  - **Secondary SIM 3 — `apps/agripulse` (`*384*3#`, AgriPulse CM)**: staple food market prices, cocoa disease diagnosis, 48h farm weather, and quick AI field advice. Spectral teal theme.
  - **Secondary SIM 4 — `apps/tontine-check` (`*384*4#`, Tontine-Check)**: rotating savings payout turn, late penalty calculator, relief fund eligibility, and SHA-256 receipt verification. Phantom violet theme.
- Adding another app never requires editing `core/`.

## Audience and language
- Everything in the repository (`README.md`, `.kiro/`, code, UI, and all app manifests) is written in 100% English for international Kiroween judges.

## Demo promise
A judge can dial and test full USSD flows across 4 domains in under 15 seconds on the haunted push-button phone simulator, without a SIM card and without any API key.
