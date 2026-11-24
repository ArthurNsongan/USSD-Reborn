from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.manifest_loader import AppRegistry
from core.session_engine import SessionEngine, SessionStore
from core.webhook_adapter import create_app

ROOT = Path(__file__).resolve().parent.parent
APPS_DIR = ROOT / "apps"
SCHEMA = ROOT / "schemas" / "app-manifest.schema.json"


class FakeClock:
    def __init__(self, now: float = 1_800_000_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests are deterministic: no developer LLM key may leak into them."""
    for name in ("LLM_API_KEY", "LLM_PROVIDER", "LLM_BASE_URL", "LLM_MODEL", "LLM_TIMEOUT_SEC"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture(scope="session")
def registry() -> AppRegistry:
    return AppRegistry(APPS_DIR, SCHEMA).load()


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def engine(clock: FakeClock) -> SessionEngine:
    return SessionEngine(SessionStore(":memory:"), clock=clock)


@pytest.fixture
def dial(registry: AppRegistry, engine: SessionEngine):
    """dial(app, text, sid="s1", mode="cumulative") -> UssdFrame, synchronously."""
    def _dial(app: str, text: str = "", sid: str = "s1", mode: str = "cumulative"):
        return asyncio.run(engine.handle(registry.resolve(app), sid, "+237690000000", text, mode))
    return _dial


@pytest.fixture
def client(registry: AppRegistry) -> TestClient:
    api = create_app(registry, SessionEngine(SessionStore(":memory:")), audit=lambda: {"core_loc": 1})
    return TestClient(api)


@pytest.fixture
def make_app(tmp_path: Path):
    """Create a throwaway app folder from a manifest dict (and optional handlers source)."""
    def _make(manifest: dict, handlers: str | None = None, folder: str | None = None) -> Path:
        app_dir = tmp_path / "apps" / (folder or manifest["id"])
        app_dir.mkdir(parents=True)
        (app_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        if handlers is not None:
            (app_dir / "handlers.py").write_text(handlers, encoding="utf-8")
        return app_dir
    return _make


def minimal_manifest(**overrides) -> dict:
    manifest = {
        "id": "demo", "name": "Demo", "tagline": "Test app", "shortcode": "*999#", "version": "1.0.0",
        "locale": "en", "entryNode": "home",
        "theme": {"primaryColor": "#000000", "accentColor": "#111111", "screenBg": "#222222",
                  "screenText": "#333333", "bezelColor": "#444444", "badgeLabel": "T"},
        "nodes": {
            "home": {"type": "menu", "title": "Demo", "options": [{"key": "1", "label": "Go", "next": "done"}]},
            "done": {"type": "static", "text": "Bye", "end": True},
        },
    }
    manifest.update(overrides)
    return manifest


def copy_real_apps(target: Path) -> Path:
    shutil.copytree(APPS_DIR, target)
    return target
