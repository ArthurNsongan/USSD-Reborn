---
inclusion: always
---

# Product: USSD-Reborn (GhostSignal)

## Vision
Millions of people in Cameroon and sub-Saharan Africa still rely on USSD (`*126#`, `#150#`)
because mobile data is expensive or unstable outside city centres. Classic USSD menus are
rigid and static. GhostSignal resurrects the 2G GSM/USSD protocol (`CON`/`END`, 160 chars
per screen) and pairs it with an AI semantic compressor that always has a deterministic
local fallback.

## Kiroween 2026 category: Skeleton Crew
- One lightweight, domain-agnostic skeleton in `core/` (strictly under 400 logical lines).
- Two radically different child apps, driven only by declarative manifests in `apps/`:
  - `apps/agripulse` (`*384*1#`): food market prices, cocoa disease diagnosis, farm weather, quick AI advice. Phosphor green theme.
  - `apps/tontine-check` (`*384*2#`): community savings (tontine) payout turn, late penalty calculator, relief fund, receipt verification. Amber / gold theme.
- Adding a third app must never require editing `core/`.

## Audience and language
- Judges are international: `README.md` and everything under `.kiro/` are written in English.
- USSD menus use authentic Cameroonian French (Douala / Yaounde, FCFA, Sandaga / Mfoundi markets), transliterated to GSM-7.

## Demo promise
A judge must be able to run a full USSD flow in under 15 seconds, without a SIM card and
without any API key (deterministic fallback by default).
