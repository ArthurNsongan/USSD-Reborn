"""USSD session state machine (CON/END, stack, 0/00/99, 1*2*1 replay, TTL) persisted in SQLite."""
import json
import re
import sqlite3
import threading
import time
from typing import Any, Callable

from core.gsm_compressor import BODY_BUDGET, compress, is_gsm7, paginate, to_gsm7
from core.manifest_loader import LoadedApp
from core.models import NodeSpec, UssdFrame

_PLACEHOLDER = re.compile(r"\{(\w+)\}")


class SessionStore:
    def __init__(self, path: str = ":memory:") -> None:
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._lock = threading.Lock()
        self._query("CREATE TABLE IF NOT EXISTS ussd_sessions (session_id TEXT PRIMARY KEY, app_id TEXT NOT NULL, "
                    "state_json TEXT NOT NULL, updated_at REAL NOT NULL)")

    def _query(self, sql: str, *args: Any) -> list[tuple]:
        with self._lock, self._db:
            return self._db.execute(sql, args).fetchall()

    def load(self, sid: str) -> dict[str, Any] | None:
        rows = self._query("SELECT state_json, updated_at FROM ussd_sessions WHERE session_id = ?", sid)
        return {**json.loads(rows[0][0]), "updated_at": rows[0][1]} if rows else None

    def save(self, sid: str, state: dict[str, Any], now: float) -> None:
        payload = json.dumps({k: v for k, v in state.items() if k != "updated_at"})
        self._query("INSERT OR REPLACE INTO ussd_sessions VALUES (?, ?, ?, ?)", sid, state["app_id"], payload, now)

    def delete(self, sid: str) -> None:
        self._query("DELETE FROM ussd_sessions WHERE session_id = ?", sid)

    def count_active(self, since: float) -> int:
        return self._query("SELECT COUNT(*) FROM ussd_sessions WHERE updated_at >= ?", since)[0][0]


def _validate(node: NodeSpec, value: str) -> str | int | float | None:
    rule = node.validation
    value = value.upper() if rule.kind == "code" else value
    if not value or (rule.pattern and not re.fullmatch(rule.pattern, value)):
        return None
    if rule.kind != "numeric":
        return value
    number = float(value) if re.fullmatch(r"\d+(\.\d+)?", value) else None
    if number is None or (rule.min is not None and number < rule.min) or (rule.max is not None and number > rule.max):
        return None
    return int(number) if number.is_integer() else number


def _new_state(app: LoadedApp, phone: str) -> dict[str, Any]:
    return {"app_id": app.manifest.id, "phone": phone, "node": app.manifest.entryNode, "stack": [], "context": {},
            "pages": [], "page": 0, "end": False, "notice": None, "telemetry": {}, "last_text": ""}


class SessionEngine:
    def __init__(self, store: SessionStore, clock: Callable[[], float] = time.time) -> None:
        self.store, self.clock = store, clock

    async def handle(self, app: LoadedApp, sid: str, phone: str, text: str, mode: str = "cumulative") -> UssdFrame:
        """Process one gateway request. `cumulative` text is Africa's Talking style (1*2*1), `step` is one input."""
        nav, state = app.manifest.navigation, self.store.load(sid)
        if state and self.clock() - state["updated_at"] > nav.sessionTimeoutSec:
            self.store.delete(sid)
            expired = {**_new_state(app, phone), "pages": [to_gsm7(nav.expiredMessage)], "end": True}
            return self._frame(app, sid, expired)
        known = state is not None and state["app_id"] == app.manifest.id
        previous = state["last_text"] if known else ""
        extends = text == previous or (previous and text.startswith(previous + "*"))
        if not known or (mode == "cumulative" and not extends):
            state, previous = _new_state(app, phone), ""  # new dial or diverged history: replay every segment
        fresh = text if mode == "step" else text[len(previous):].lstrip("*")
        state["last_text"] = text if mode == "cumulative" else ""
        for value in fresh.split("*") if fresh else []:
            if not state["pages"]:
                await self._render(app, state)  # replayed screens are real screens: 99 and END behave the same
            if state["end"] and state["page"] >= len(state["pages"]) - 1:
                break
            self._step(app, state, value.strip())
        if not state["pages"]:
            await self._render(app, state)
        frame = self._frame(app, sid, state)
        if frame.prefix == "END":
            self.store.delete(sid)
        else:
            self.store.save(sid, state, self.clock())
        return frame

    def _step(self, app: LoadedApp, state: dict[str, Any], value: str) -> None:
        """Apply one user input to the rendered screen: next page, home, back, option or validated input."""
        nav, node = app.manifest.navigation, app.manifest.nodes[state["node"]]
        state["notice"] = None
        if value == nav.nextPageKey and state["page"] < len(state["pages"]) - 1:
            state["page"] += 1
            return
        option = next((o for o in node.options if o.key == value), None)
        parsed = _validate(node, value) if node.type == "input" else None
        if value == nav.homeKey:
            state.update(node=app.manifest.entryNode, stack=[])
        elif value == nav.backKey and state["stack"]:
            state["node"] = state["stack"].pop()
        elif option or parsed is not None:
            state["context"].update(option.set if option else {node.saveAs: parsed})
            state["stack"].append(state["node"])
            state["node"] = option.next if option else node.next
        else:
            state["notice"] = (node.type == "input" and node.errorMessage) or nav.invalidMessage
        state["pages"] = []

    async def _render(self, app: LoadedApp, state: dict[str, Any]) -> None:
        m, context = app.manifest, state["context"]
        node = m.nodes[state["node"]]
        content, end = node.title or node.prompt or node.text, node.end
        if node.type == "action":
            try:
                result = app.handlers[node.handler](dict(context), app.data)
            except Exception:  # a faulty app handler must never crash the gateway
                result = {"text": m.navigation.errorMessage, "end": True}
            result = result if isinstance(result, dict) else {"text": str(result)}
            content, end = str(result.get("text", "")), bool(result.get("end", end))
            context.update(result.get("context") or {})
        head = [state["notice"]] if state.get("notice") else []
        tail = [f"{o.key}. {o.label}" for o in node.options]
        tail += [m.navigation.backLabel] if not end and state["node"] != m.entryNode else []
        budget = max(40, BODY_BUDGET - len("\n".join(head + tail)) - 1)
        content = _PLACEHOLDER.sub(lambda g: str(context.get(g[1], g[0])), content)
        abbreviations = m.compression.get("abbreviations", {})
        content, telemetry = await compress(content, budget, node.useAiCompression, abbreviations)
        body = to_gsm7("\n".join(head + [content] + tail))
        state.update(pages=paginate(body, "\n" + m.navigation.nextPageLabel), page=0, end=end, telemetry=telemetry)

    def _frame(self, app: LoadedApp, sid: str, state: dict[str, Any]) -> UssdFrame:
        nav, pages, page = app.manifest.navigation, state["pages"], state["page"]
        more = page < len(pages) - 1
        body = (pages[page] + ("\n" + nav.nextPageLabel if more else ""))[:BODY_BUDGET]
        prefix = "CON" if more or not state["end"] else "END"
        raw = f"{prefix} {body}"
        telemetry = {"mode": "direct", **state["telemetry"], "page_count": len(pages), "gsm7_valid": is_gsm7(raw)}
        return UssdFrame(app_id=app.manifest.id, session_id=sid, prefix=prefix, body=body, raw_response=raw,
                         char_count=len(raw), gsm7_valid=is_gsm7(raw), page_index=page, total_pages=len(pages),
                         current_node=state["node"], stack=list(state["stack"]), context=dict(state["context"]),
                         telemetry=telemetry)
