"""Composition root: wires the universal skeleton (core/) with the apps, the audit and the simulator.

Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import os
from pathlib import Path

from core.manifest_loader import AppRegistry
from core.session_engine import SessionEngine, SessionStore
from core.webhook_adapter import create_app
from scripts.check_skeleton_purity import audit

ROOT = Path(__file__).resolve().parent
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def build_app(db_path: str | None = None):
    registry = AppRegistry(ROOT / "apps", ROOT / "schemas" / "app-manifest.schema.json").load()
    store = SessionStore(db_path or os.getenv("USSD_DB_PATH", "ussd_sessions.db"))
    origins = [o.strip() for o in os.getenv("USSD_CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]
    return create_app(registry, SessionEngine(store), audit=lambda: audit(ROOT / "core"),
                      static_dir=ROOT / "frontend" / "dist", cors_origins=origins)


app = build_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.getenv("USSD_HOST", "127.0.0.1"), port=int(os.getenv("USSD_PORT", "8000")))
