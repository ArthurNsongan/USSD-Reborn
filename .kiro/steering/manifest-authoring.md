---
inclusion: fileMatch
fileMatchPattern: "apps/**/*"
---

# Writing a child app

An app is a folder `apps/<app_id>/` with:
- `manifest.json` (required): validated against `schemas/app-manifest.schema.json`.
- `data.json` (optional): static data passed to handlers as `data`.
- `handlers.py` (optional): pure functions `name(context, data) -> str | dict`.

## Manifest essentials
- `id` must equal the folder name. `shortcode` must be unique (`*384*N#`).
- `entryNode` must exist in `nodes`.
- `theme`: `primaryColor`, `accentColor`, `screenBg`, `screenText`, `bezelColor`, `badgeLabel`, `icon`.
- `quickPresets`: `[{ "label": "...", "inputs": "1*1*1" }]` for one-click demos.
- `navigation`: `backKey` (`0`), `homeKey` (`00`), `nextPageKey` (`99`), `sessionTimeoutSec`,
  plus localized `nextPageLabel`, `backLabel`, `invalidMessage`, `expiredMessage`, `errorMessage`.
- `compression.abbreviations`: word replacements used only by the deterministic fallback.

## Node types
| type | required | behaviour |
| --- | --- | --- |
| `menu` | `title`, `options[]` | Lists `key. label`. Option may `set` context values before going to `next`. |
| `input` | `prompt`, `saveAs`, `next` | Validates with `validation` (`kind`: numeric/text/code, `pattern`, `min`, `max`) and stores the value. |
| `action` | `handler` | Calls the handler, compresses its text (`useAiCompression`), `end: true` closes the session. May have `options`. |
| `static` | `text` | Renders `{context_var}` interpolation. `end: true` closes the session. May have `options`. |

## Rules
- Keys `0`, `00`, `99` are reserved: never use them as option keys.
- Write in Cameroonian English (`locale: "en-CM"`) so international judges can read every screen,
  keeping real local references (Sandaga, Mfoundi, Bamenda, FCFA, njangi).
- GSM-7 only: avoid accents in source text (the compressor transliterates anyway), no emojis
  in node text (the `theme.icon` is UI-only and never sent over USSD).
- Every static screen must fit in 156 characters; `python scripts/validate_manifests.py`
  walks every node (a hook runs it on save).
- Handlers return either a string or `{ "text": str, "end": bool, "context": dict }`.
