---
inclusion: fileMatch
fileMatchPattern: "frontend/**/*"
---

# UI Design System: GhostSignal Nocturne (Spooky Push-Button Phone Studio)

## Aesthetic direction
- **Haunted Luxury Hardware**: obsidian surfaces (`#06060a`), smoked-glass Bento panels (`rgba(14, 14, 22, 0.78)`), and spectral phosphor illumination driven dynamically by the active app's manifest theme (`--screen-bg`, `--screen-text`, `--brand-primary`, `--brand-accent`, `--bezel`).
- **Zero app hardcoding**: never hardcode app names, shortcodes, or hex colors inside `frontend/src/`. Every color token and quick-preset comes from `GET /api/apps`.

## 3-Act Page Architecture
1. **Act I — Editorial Hero & Haunted Push-Button Phone Studio**:
   - Left: Editorial headline (`Syne` + italic `Instrument Serif`), SIM Cartridge Dock (Featured everyday SIMs `*384*1#` NightRx & `*384*2#` Bite2G + secondary SIM bar), and one-click scenario chips (kept outside the handset).
   - Right: Pure hardware push-button handset (`RetroPhone.tsx`) with external 2G antenna, pulsing radio rings, recessed dot-matrix CRT screen, 5-way D-Pad rocker, backlit T9 keys, and Web Audio API DTMF synthesizer.
2. **Act II — Live SS7 Frame & Manifest X-Ray Console**:
   - Tabbed inspection workbench (`FrameInspector`, `FlowVisualizer`, `TelecomCurlPanel`) plus `SkeletonProofBar`.
3. **Act III — Skeleton Crew & `.kiro/` Bento Proof**:
   - Live `core/` LOC breakdown (`< 400 LOC`, `0 domain leaks`), loaded SIM matrix, and copyable MCP prompts for Kiro Chat.

## Accessibility
- Honour `@media (prefers-reduced-motion: reduce)` by disabling CRT flicker, antenna pulse rings, and degauss transitions.
- Support full physical keyboard operation (`0-9`, `*`, `#`, `Enter` to send, `Escape` to hang up) and a prominent DTMF mute toggle.
