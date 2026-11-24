"""Validate every app: JSON Schema, graph integrity, then a BFS over every reachable screen.

Each reachable (node, context) state is rendered through the real SessionEngine, every page
is followed with the next-page key, and every frame must start with CON/END, be <= 160
characters and use only GSM-7 characters.

Usage: python scripts/validate_manifests.py [--json]
Exit code 1 on any error.
"""
from __future__ import annotations

import asyncio
import json
import site
import sys
import uuid
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))  # allow `python scripts/validate_manifests.py` from anywhere
for _sp in (ROOT / ".venv" / "Lib" / "site-packages", *sorted((ROOT / ".venv" / "lib").glob("python*/site-packages"))):
    if _sp.is_dir():
        site.addsitedir(str(_sp))

from jsonschema import Draft202012Validator  # noqa: E402

from core.manifest_loader import LoadedApp, load_app  # noqa: E402
from core.models import MAX_FRAME_CHARS  # noqa: E402
from core.session_engine import SessionEngine, SessionStore  # noqa: E402

APPS_DIR = ROOT / "apps"
SCHEMA_PATH = ROOT / "schemas" / "app-manifest.schema.json"
MAX_STATES = 5000


def _frame_errors(frame, path: list[str]) -> list[str]:
    where = f"[{'*'.join(path) or 'dial'} p{frame.page_index + 1}]"
    errors = []
    if frame.prefix not in ("CON", "END") or not frame.raw_response.startswith(frame.prefix + " "):
        errors.append(f"{where} missing CON/END prefix")
    if frame.char_count > MAX_FRAME_CHARS:
        errors.append(f"{where} {frame.char_count} chars > {MAX_FRAME_CHARS}")
    if not frame.gsm7_valid:
        errors.append(f"{where} non GSM-7 characters")
    if not frame.body.strip():
        errors.append(f"{where} empty screen")
    return errors


async def walk_app(app: LoadedApp) -> dict:
    """Breadth-first exploration of every option and every input example."""
    engine, nodes = SessionEngine(SessionStore(":memory:")), app.manifest.nodes
    next_key = app.manifest.navigation.nextPageKey
    queue: deque[tuple[list[str], str | None]] = deque([([], None)])
    seen: set[tuple[str, str]] = set()
    visited, errors, frames, longest = set(), [], 0, 0
    while queue and len(seen) < MAX_STATES:
        path, parent = queue.popleft()
        sid = f"validate-{uuid.uuid4().hex}"
        pages = [await engine.handle(app, sid, "+237600000000", "*".join(path))]
        while pages[-1].page_index < pages[-1].total_pages - 1:
            pages.append(await engine.handle(app, sid, "+237600000000", next_key, "step"))
        for frame in pages:
            frames, longest = frames + 1, max(longest, frame.char_count)
            errors += _frame_errors(frame, path)
        first = pages[0]
        if parent and nodes[parent].type == "input" and first.current_node == parent:
            errors.append(f"{parent}: example '{path[-1]}' is rejected by its own validation")
        visited.add(first.current_node)
        key = (first.current_node, json.dumps(first.context, sort_keys=True, default=str))
        if key in seen or pages[-1].prefix == "END":
            continue
        seen.add(key)
        node = nodes[first.current_node]
        choices = [o.key for o in node.options] + ([node.example] if node.type == "input" and node.example else [])
        queue.extend((path + [choice], first.current_node) for choice in choices)
    unreachable = sorted(set(nodes) - visited)
    errors += [f"{node_id}: unreachable from entryNode" for node_id in unreachable]
    return {"states": len(seen), "frames": frames, "longest_frame": longest, "errors": errors}


def validate_all(apps_dir: Path = APPS_DIR, schema_path: Path = SCHEMA_PATH) -> dict:
    validator = Draft202012Validator(json.loads(Path(schema_path).read_text(encoding="utf-8")))
    report: dict = {"apps": {}, "errors": 0}
    shortcodes: dict[str, str] = {}
    for manifest in sorted(Path(apps_dir).glob("*/manifest.json")):
        name = manifest.parent.name
        try:
            app = load_app(manifest.parent, validator)
        except Exception as exc:  # ManifestError, bad JSON, broken handlers.py: report every app, keep going
            report["apps"][name] = {"errors": [str(exc)]}
            continue
        result = asyncio.run(walk_app(app))
        owner = shortcodes.setdefault(app.manifest.shortcode, name)
        if owner != name:
            result["errors"].append(f"shortcode {app.manifest.shortcode} already used by {owner}")
        report["apps"][name] = {"shortcode": app.manifest.shortcode, **result}
    report["errors"] = sum(len(a["errors"]) for a in report["apps"].values())
    report["passed"] = report["errors"] == 0 and bool(report["apps"])
    return report


def main(argv: list[str]) -> int:
    report = validate_all()
    if "--json" in argv:
        print(json.dumps(report, indent=2))
    else:
        for name, result in report["apps"].items():
            if "frames" in result:
                print(f"  {name:<16} {result['shortcode']:<9} {result['states']:>4} states "
                      f"{result['frames']:>4} frames, longest {result['longest_frame']}/{MAX_FRAME_CHARS} chars")
            for error in result["errors"]:
                print(f"    ERROR {error}")
        print("MANIFESTS: PASS" if report["passed"] else f"MANIFESTS: FAIL ({report['errors']} errors)")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
