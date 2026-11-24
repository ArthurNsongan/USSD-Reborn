"""Minimal MCP server (stdio, newline-delimited JSON-RPC 2.0) that lets Kiro drive the USSD skeleton.

Tools:
- list_ussd_apps: apps discovered in apps/, with shortcode, theme and quick presets.
- simulate_ussd_flow: dial a shortcode and play inputs, returning every frame with its telemetry.
- audit_skeleton_compliance: core/ LOC + domain leaks + exhaustive manifest validation.

Configured in .kiro/settings/mcp.json. Only JSON-RPC goes to stdout; diagnostics go to stderr.
"""
from __future__ import annotations

import asyncio
import json
import site
import sys
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
for _sp in (ROOT / ".venv" / "Lib" / "site-packages", *sorted((ROOT / ".venv" / "lib").glob("python*/site-packages"))):
    if _sp.is_dir():
        site.addsitedir(str(_sp))

from core.manifest_loader import AppRegistry  # noqa: E402
from core.session_engine import SessionEngine, SessionStore  # noqa: E402
from scripts.check_skeleton_purity import audit  # noqa: E402
from scripts.validate_manifests import validate_all  # noqa: E402

SERVER_INFO = {"name": "ussd-reborn", "version": "1.0.0"}
SUPPORTED_PROTOCOLS = ("2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05")

TOOLS = [
    {
        "name": "list_ussd_apps",
        "description": "List the USSD apps loaded by the skeleton (id, name, shortcode, theme, quick presets, node count).",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "simulate_ussd_flow",
        "description": ("Dial a USSD shortcode (e.g. *384*1#) or app id and send inputs one by one, like a phone. "
                        "Returns every CON/END frame with its character count, GSM-7 check and compression mode."),
        "inputSchema": {
            "type": "object",
            "properties": {
                "shortcode": {"type": "string", "description": "Service code such as *384*2#, or an app id."},
                "inputs": {"type": "array", "items": {"type": "string"}, "maxItems": 30,
                           "description": "Inputs after dialing, e.g. [\"2\", \"25000\", \"5\"]. Use 99 for next page."},
            },
            "required": ["shortcode"],
            "additionalProperties": False,
        },
    },
    {
        "name": "audit_skeleton_compliance",
        "description": "Skeleton Crew proof: core/ logical LOC vs 400, domain term leaks, and manifest validation report.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
]


class UssdTools:
    def __init__(self) -> None:
        self.registry = AppRegistry(ROOT / "apps", ROOT / "schemas" / "app-manifest.schema.json").load()
        self.engine = SessionEngine(SessionStore(":memory:"))

    def list_ussd_apps(self) -> list[dict[str, Any]]:
        return [{"id": m.id, "name": m.name, "shortcode": m.shortcode, "tagline": m.tagline, "theme": m.theme,
                 "quickPresets": m.quickPresets, "nodes": len(m.nodes)}
                for m in (a.manifest for a in self.registry.apps.values())]

    def simulate_ussd_flow(self, shortcode: str, inputs: list[str] | None = None) -> dict[str, Any]:
        app = self.registry.resolve(shortcode)
        if app is None:
            raise ValueError(f"Unknown shortcode or app id: {shortcode}")
        steps = [i for i in (inputs or []) if i != ""]
        return asyncio.run(self._play(app, steps))

    async def _play(self, app, steps: list[str]) -> dict[str, Any]:
        sid, frames = f"mcp-{uuid.uuid4().hex}", []
        for index, value in enumerate([""] + steps):
            frame = await self.engine.handle(app, sid, "+237600000000", value, "cumulative" if index == 0 else "step")
            frames.append({"input": value or app.manifest.shortcode, "raw_response": frame.raw_response,
                           "char_count": frame.char_count, "gsm7_valid": frame.gsm7_valid,
                           "page": f"{frame.page_index + 1}/{frame.total_pages}", "node": frame.current_node,
                           "mode": frame.telemetry.get("mode"), "fallback_reason": frame.telemetry.get("fallback_reason")})
            if frame.prefix == "END":
                break
        return {"app": app.manifest.id, "frames": frames, "ended": frames[-1]["raw_response"].startswith("END")}

    def audit_skeleton_compliance(self) -> dict[str, Any]:
        purity, manifests = audit(ROOT / "core"), validate_all()
        return {"passed": purity["passed"] and manifests["passed"], "skeleton": purity, "manifests": manifests}


def handle_message(tools: UssdTools, message: dict[str, Any]) -> dict[str, Any] | None:
    method, msg_id, params = message.get("method"), message.get("id"), message.get("params") or {}
    if msg_id is None:  # notification (e.g. notifications/initialized): never answered
        return None
    if method == "initialize":
        requested = params.get("protocolVersion")
        version = requested if requested in SUPPORTED_PROTOCOLS else SUPPORTED_PROTOCOLS[0]
        result: Any = {"protocolVersion": version, "capabilities": {"tools": {"listChanged": False}},
                       "serverInfo": SERVER_INFO}
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call":
        name, args = params.get("name"), params.get("arguments") or {}
        if name not in {t["name"] for t in TOOLS}:
            return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32602, "message": f"Unknown tool: {name}"}}
        try:
            payload, is_error = getattr(tools, name)(**args), False
        except Exception as exc:  # tool errors are reported to the model, not as protocol errors
            payload, is_error = {"error": str(exc)}, True
        result = {"content": [{"type": "text", "text": json.dumps(payload, indent=2, ensure_ascii=False)}],
                  "isError": is_error}
    else:
        return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def serve() -> None:
    tools = UssdTools()
    print(f"ussd-reborn MCP ready: {len(tools.registry.apps)} apps", file=sys.stderr)
    out = sys.stdout.buffer
    for raw in sys.stdin.buffer:
        line = raw.decode("utf-8").strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            message = None
        if isinstance(message, dict):
            reply = handle_message(tools, message)
        else:
            code, text = (-32700, "Parse error") if message is None else (-32600, "Invalid Request")
            reply = {"jsonrpc": "2.0", "id": None, "error": {"code": code, "message": text}}
        if reply is not None:
            out.write((json.dumps(reply, ensure_ascii=False) + "\n").encode("utf-8"))
            out.flush()


if __name__ == "__main__":
    serve()
