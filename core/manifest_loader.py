"""Runtime discovery of child apps: schema validation, integrity checks, dynamic handlers."""
import importlib.util
import inspect
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from jsonschema import Draft202012Validator

from core.models import AppManifest


class ManifestError(ValueError):
    pass


@dataclass
class LoadedApp:
    manifest: AppManifest
    path: Path
    data: dict[str, Any] = field(default_factory=dict)
    handlers: dict[str, Callable[..., Any]] = field(default_factory=dict)


def _load_handlers(app_dir: Path, app_id: str) -> dict[str, Callable[..., Any]]:
    source = app_dir / "handlers.py"
    if not source.exists():
        return {}
    spec = importlib.util.spec_from_file_location(f"ussd_app_{app_id.replace('-', '_')}", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return {name: fn for name, fn in inspect.getmembers(module, inspect.isfunction)
            if not name.startswith("_") and fn.__module__ == module.__name__}


def check_integrity(app: LoadedApp) -> list[str]:
    """Semantic checks JSON Schema cannot express. Returns human-readable errors."""
    m, errors = app.manifest, []
    reserved = {m.navigation.backKey, m.navigation.homeKey, m.navigation.nextPageKey}
    if m.entryNode not in m.nodes:
        errors.append(f"entryNode '{m.entryNode}' is not a node")
    for node_id, node in m.nodes.items():
        targets = [o.next for o in node.options] + ([node.next] if node.next else [])
        errors += [f"{node_id}: next '{t}' is not a node" for t in targets if t not in m.nodes]
        errors += [f"{node_id}: key '{o.key}' is reserved" for o in node.options if o.key in reserved]
        if node.type == "action" and node.handler not in app.handlers:
            errors.append(f"{node_id}: handler '{node.handler}' not found in handlers.py")
    return errors


def load_app(app_dir: Path, validator: Draft202012Validator) -> LoadedApp:
    raw = json.loads((app_dir / "manifest.json").read_text(encoding="utf-8"))
    schema_errors = [f"{'/'.join(map(str, e.path)) or '<root>'}: {e.message}" for e in validator.iter_errors(raw)]
    if schema_errors:
        raise ManifestError(f"{app_dir.name}: " + "; ".join(schema_errors))
    manifest = AppManifest.model_validate(raw)
    if manifest.id != app_dir.name:
        raise ManifestError(f"{app_dir.name}: id '{manifest.id}' must match its folder name")
    data_file = app_dir / "data.json"
    data = json.loads(data_file.read_text(encoding="utf-8")) if data_file.exists() else {}
    app = LoadedApp(manifest, app_dir, data, _load_handlers(app_dir, manifest.id))
    if errors := check_integrity(app):
        raise ManifestError(f"{manifest.id}: " + "; ".join(errors))
    return app


class AppRegistry:
    def __init__(self, apps_dir: Path, schema_path: Path) -> None:
        self.apps_dir = Path(apps_dir)
        self.validator = Draft202012Validator(json.loads(Path(schema_path).read_text(encoding="utf-8")))
        self.apps: dict[str, LoadedApp] = {}

    def load(self) -> "AppRegistry":
        for manifest in sorted(self.apps_dir.glob("*/manifest.json")):
            app = load_app(manifest.parent, self.validator)
            if self.resolve(app.manifest.shortcode):
                raise ManifestError(f"{app.manifest.id}: shortcode {app.manifest.shortcode} already used")
            self.apps[app.manifest.id] = app
        return self

    def resolve(self, key: str | None) -> LoadedApp | None:
        """Find an app by id or by USSD service code."""
        return self.apps.get(key or "") or next((a for a in self.apps.values() if a.manifest.shortcode == key), None)
