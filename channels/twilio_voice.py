"""Twilio Voice channel: the same USSD apps over an ordinary phone call (text-to-speech + keypad).

Where third-party USSD codes do not exist (the United States, for example), a caller dials a phone
number instead of *384*1#, hears each CON/END frame read aloud and answers with the keypad, or by
voice for free-text and code inputs.

Stateless by design: every <Gather> action URL carries the cumulative input history (?h=1*2), the
same format Africa's Talking uses, so any serverless instance can rebuild the session by replay.

Environment:
- TWILIO_AUTH_TOKEN: when set, every request must carry a valid X-Twilio-Signature.
- TWILIO_WEBHOOK_BASE_URL: public origin used to check signatures behind a proxy
  (e.g. https://ussd-reborn.vercel.app).
- TWILIO_VOICE: <Say> voice, default Polly.Joanna.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
from urllib.parse import parse_qs, urlencode
from xml.sax.saxutils import escape, quoteattr

from fastapi import APIRouter, Request
from fastapi.responses import Response

from core.manifest_loader import AppRegistry, LoadedApp
from core.models import NodeSpec
from core.session_engine import SessionEngine

MAX_HISTORY = 400
MAX_SILENT_REPEATS = 3
_OPTION = re.compile(r"^(\d{1,3})\. (.+)$")
_SPOKEN = re.compile(r"[^A-Za-z0-9 ,.'?-]")


# ---------------------------------------------------------------------------------------------- TwiML
def _say(text: str) -> str:
    voice = os.getenv("TWILIO_VOICE", "Polly.Joanna")
    return f'<Say voice={quoteattr(voice)} language="en-US">{escape(text)}</Say>'


def _twiml(*parts: str) -> Response:
    body = '<?xml version="1.0" encoding="UTF-8"?><Response>' + "".join(parts) + "</Response>"
    return Response(body, media_type="application/xml")


def _url(**params: object) -> str:
    query = urlencode({k: v for k, v in params.items() if v not in (None, "")})
    return f"/voice?{query}" if query else "/voice"


def _gather(action: str, inner: str, *, speech: bool = False, hints: str = "", single_key: bool = False) -> str:
    attrs = {"input": "dtmf speech" if speech else "dtmf", "action": action, "method": "POST",
             "finishOnKey": "#", "timeout": "6" if speech else "4"}
    if single_key:
        attrs["numDigits"] = "1"
    if speech:
        attrs.update(language="en-US", speechTimeout="auto")
        if hints:
            attrs["hints"] = hints
    rendered = " ".join(f"{k}={quoteattr(v)}" for k, v in attrs.items())
    return f"<Gather {rendered}>{inner}</Gather>"


def _redirect(url: str) -> str:
    return f'<Redirect method="POST">{escape(url)}</Redirect>'


# ------------------------------------------------------------------------------------- speech helpers
def speakable(body: str) -> str:
    """Turn a USSD screen into a spoken prompt: '2. Cocoa diagnosis' -> 'Press 2: Cocoa diagnosis.'"""
    lines = []
    for line in body.split("\n"):
        option = _OPTION.match(line.strip())
        if option:
            lines.append(f"Press {' '.join(option[1])}: {option[2]}.")
        elif line.strip():
            lines.append(line.replace("*", " star ").replace("#", " hash "))
    return " ".join(lines)


def normalize_spoken(answer: str, node: NodeSpec | None) -> str:
    """Speech results ('M 03.', 'qt 2026 841', '25,000') reshaped for the node's validation."""
    text = _SPOKEN.sub("", answer).strip(" .,")
    if node is None or node.type != "input":
        return text
    if node.validation.kind == "numeric":
        return re.sub(r"[^\d.]", "", text).rstrip(".")
    if node.validation.kind != "code":
        return text
    compact = re.sub(r"[^A-Za-z0-9]", "", text).upper()
    example = node.example or ""
    template = re.sub(r"[^A-Za-z0-9]", "", example)
    if not example or len(compact) != len(template):
        return compact
    chars = iter(compact)  # re-insert the separators shown in the manifest example (QT-2026-841)
    return "".join(next(chars) if c.isalnum() else c for c in example)


def signature_ok(request: Request, params: dict[str, str]) -> bool:
    """Twilio request validation: base64(HMAC-SHA1(token, url + sorted key/value pairs))."""
    token = os.getenv("TWILIO_AUTH_TOKEN")
    if not token:
        return True
    base = os.getenv("TWILIO_WEBHOOK_BASE_URL")
    query = f"?{request.url.query}" if request.url.query else ""
    url = f"{base.rstrip('/')}{request.url.path}{query}" if base else str(request.url)
    payload = url + "".join(key + params[key] for key in sorted(params))
    digest = hmac.new(token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha1).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), request.headers.get("x-twilio-signature", ""))


# ------------------------------------------------------------------------------------------- router
def _pick_app(registry: AppRegistry, answer: str) -> Response:
    apps = list(registry.apps.values())
    if answer.isdigit() and 1 <= int(answer) <= len(apps):
        return _twiml(_redirect(_url(app=apps[int(answer) - 1].manifest.id)))
    menu = " ".join(f"Press {i}: {a.manifest.name}, USSD {speakable(a.manifest.shortcode)}."
                    for i, a in enumerate(apps, start=1))
    intro = "Welcome to GhostSignal: two G USSD services, now over a phone call. "
    return _twiml(_gather(_url(), _say(intro + menu), single_key=True), _redirect(_url()))


async def _screen(app: LoadedApp, engine: SessionEngine, call: str, phone: str, text: str, repeats: int) -> Response:
    sid = f"voice-{call}-{hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]}"
    frame = await engine.handle(app, sid, phone, text, "cumulative")
    engine.store.delete(sid)  # the history in the URL is the session: nothing to keep server-side
    if frame.prefix == "END":
        again = _gather(_url(app=app.manifest.id, restart=1), _say("Press 1 to start again, or hang up."),
                        single_key=True)
        return _twiml(_say(speakable(frame.body)), again, _say("Goodbye."), "<Hangup/>")
    node = app.manifest.nodes.get(frame.current_node)
    is_input = node is not None and node.type == "input"
    speech = is_input and node.validation.kind in ("text", "code")
    hint = ""
    if is_input:
        hint = " Type the number, then press hash." if not speech else " Say your answer, or type it, then press hash."
    if repeats >= MAX_SILENT_REPEATS:
        return _twiml(_say("No answer received. Goodbye."), "<Hangup/>")
    action = _url(app=app.manifest.id, h=text, n=frame.current_node)
    prompt = _gather(action, _say(speakable(frame.body) + hint), speech=speech,
                     hints=(node.example or "") if speech else "")
    return _twiml(prompt, _redirect(_url(app=app.manifest.id, h=text, n=frame.current_node, r=repeats + 1)))


def voice_router(registry: AppRegistry, engine: SessionEngine) -> APIRouter:
    router = APIRouter()

    @router.post("/voice", include_in_schema=False)
    async def voice(request: Request) -> Response:
        raw = parse_qs((await request.body()).decode("utf-8", "replace"), keep_blank_values=True)
        params = {key: values[0] for key, values in raw.items()}
        if not signature_ok(request, params):
            return Response("Invalid Twilio signature", status_code=403)
        query = request.query_params
        app = registry.resolve(query.get("app"))
        digits = params.get("Digits", "").replace("*", "")
        if app is None:
            return _pick_app(registry, digits)
        node = app.manifest.nodes.get(query.get("n", ""))
        answer = digits or normalize_spoken(params.get("SpeechResult", ""), node).replace("*", "")
        history = query.get("h", "")
        if query.get("restart"):
            if answer != "1":
                return _twiml(_say("Goodbye."), "<Hangup/>")
            history, answer = "", ""
        text = f"{history}*{answer}" if history and answer else (answer or history)
        if len(text) > MAX_HISTORY:
            return _twiml(_say("This call is too long. Goodbye."), "<Hangup/>")
        repeats = int(query.get("r", "0")) if query.get("r", "0").isdigit() and not answer else 0
        call = re.sub(r"[^A-Za-z0-9]", "", params.get("CallSid", "local"))[:40] or "local"
        return await _screen(app, engine, call, params.get("From", ""), text, repeats)

    return router
