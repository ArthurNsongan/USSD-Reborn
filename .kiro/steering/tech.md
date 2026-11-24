---
inclusion: always
---

# Tech stack and conventions

## Backend
- Python 3.12+, FastAPI, Pydantic v2, SQLite (stdlib `sqlite3`), `jsonschema`, `httpx`.
- Entry point: `main.py` (`uvicorn main:app --reload`). It wires `core/` with the audit tooling.
- `core/` is the universal skeleton. It never imports anything from `apps/` statically;
  apps are discovered at runtime with `importlib`.
- App handlers (`apps/<id>/handlers.py`) are pure functions: `def handler(context: dict, data: dict) -> str | dict`.
  They do no I/O and never format `CON`/`END` themselves.
- Type hints everywhere (native `X | None` syntax, Python 3.12+), no global mutable state
  outside the session store. Lines up to 120 characters.

## Frontend
- `frontend/`: React + Vite + TypeScript (strict) + Tailwind CSS v4 (`@tailwindcss/vite`).
- Everything app-specific (names, colours, shortcodes, presets, node graph) comes from
  `GET /api/apps`. No app name or colour is hardcoded in `frontend/src`.
- Types in `frontend/src/lib/types.ts` mirror the JSON returned by `core/webhook_adapter.py`.

## Commands
- Install: `python -m venv .venv` then `.venv/Scripts/python -m pip install -e .[dev]` (Windows) or `.venv/bin/python -m pip install -e .[dev]`.
- Tests: `python -m pytest`
- Skeleton audit: `python scripts/check_skeleton_purity.py`
- Manifest audit: `python scripts/validate_manifests.py`
- Backend: `uvicorn main:app --reload --port 8000`
- Frontend: `cd frontend && npm install && npm run dev` (proxies `/api` and `/ussd` to port 8000)
- Production build: `cd frontend && npm run build` (FastAPI then serves `frontend/dist/`).
