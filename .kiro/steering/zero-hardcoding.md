---
inclusion: fileMatch
fileMatchPattern: "core/**/*.py"
---

# Zero hardcoding in `core/`

You are editing the universal skeleton. It must stay 100% domain-agnostic.

## Forbidden in `core/` (identifiers, strings and comments)
The authoritative list lives in `scripts/check_skeleton_purity.py` (`FORBIDDEN_TERMS`).
It covers agriculture, community finance and health vocabulary, Cameroonian market names
and currency names. If you need such a word, it belongs in a manifest, a `data.json`, or an
app `handlers.py`.

## Size budget
- `core/` must stay **strictly under 400 logical lines** across all files. A logical line is
  not blank, not a comment and not part of a docstring (the cloc convention).
- Do not game the counter: no statement chaining with `;`, lines up to 120 characters.
- Prefer deleting code over adding it. Push variability into the manifest schema.

## Rules
- Never import from `apps/` statically. Use the loader (`importlib`).
- User-facing strings (invalid input, session expired, next page label) come from the
  manifest `navigation` block, with neutral English defaults only.
- Run `python scripts/check_skeleton_purity.py` after every change (a hook does it on save).
