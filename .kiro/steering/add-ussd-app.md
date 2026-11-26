---
inclusion: manual
---

# Playbook: Add a New Declarative USSD App (`/add-ussd-app`)

Follow this checklist whenever the user asks to add a new USSD service to GhostSignal without touching `core/`:

1. **Create `apps/<app-id>/manifest.json`**:
   - `id` must match the folder name `<app-id>`.
   - Pick an unused `shortcode` (e.g. `*384*5#`).
   - Define `theme` (`primaryColor`, `accentColor`, `screenBg`, `screenText`, `bezelColor`, `badgeLabel`, `icon`).
   - Add 3 to 5 `quickPresets` so judges can test every branch in one click.
   - Ensure every `input` node includes an `example` that passes its own `validation` rule.
2. **Create `apps/<app-id>/data.json` and `apps/<app-id>/handlers.py` (optional)**:
   - Export pure functions `def handler_name(context: dict, data: dict) -> dict | str`.
   - Never format `CON ` or `END ` prefixes inside handlers; return `{"text": "...", "end": True|False, "context": {...}}`.
3. **Update `FORBIDDEN_TERMS` in `scripts/check_skeleton_purity.py`**:
   - Add domain-specific keywords from the new app to prove zero domain leakage in `core/`.
4. **Verify**:
   - Run `python scripts/validate_manifests.py` (walks every reachable screen and enforces `<= 160` GSM-7 characters).
   - Run `python scripts/check_skeleton_purity.py` (`core/` < 400 logical LOC, 0 leaks).
   - Run `python scripts/run_in_venv.py -m pytest -q`.
