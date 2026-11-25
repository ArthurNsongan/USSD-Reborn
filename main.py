"""Composition root: wires the universal skeleton (core/) with the apps, the audit and the simulator.

Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi.staticfiles import StaticFiles

from channels.twilio_voice import voice_router
from core.manifest_loader import AppRegistry
from core.session_engine import SessionEngine, SessionStore
from core.webhook_adapter import create_app
from scripts.check_skeleton_purity import audit

ROOT = Path(__file__).resolve().parent
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def default_db_path() -> str:
    """Serverless platforms (Vercel sets VERCEL=1) only allow writes to the temp directory."""
    if os.getenv("VERCEL"):
        return str(Path(tempfile.gettempdir()) / "ussd_sessions.db")
    return "ussd_sessions.db"


def build_app(db_path: str | None = None):
    registry = AppRegistry(ROOT / "apps", ROOT / "schemas" / "app-manifest.schema.json").load()
    store = SessionStore(db_path or os.getenv("USSD_DB_PATH") or default_db_path())
    origins = [o.strip() for o in os.getenv("USSD_CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]
    engine = SessionEngine(store)
    api = create_app(registry, engine, audit=lambda: audit(ROOT / "core"), cors_origins=origins)
    api.include_router(voice_router(registry, engine))  # phone-call channel (Twilio), outside core/
    dist = ROOT / "frontend" / "dist"
    if dist.is_dir():  # mounted last so /ussd, /api and /voice keep priority
        api.mount("/", StaticFiles(directory=dist, html=True), name="simulator")
    return api


app = build_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.getenv("USSD_HOST", "127.0.0.1"), port=int(os.getenv("USSD_PORT", "8000")))
