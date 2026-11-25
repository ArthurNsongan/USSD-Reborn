"""Twilio Voice channel: USSD frames read aloud, keypad and speech answers, request signatures."""
from __future__ import annotations

import base64
import hashlib
import hmac
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree

import pytest
from fastapi.testclient import TestClient

from channels.twilio_voice import normalize_spoken, speakable, voice_router
from core.session_engine import SessionEngine, SessionStore
from core.webhook_adapter import create_app

FORM = {"content-type": "application/x-www-form-urlencoded"}


@pytest.fixture(autouse=True)
def _no_twilio_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("TWILIO_AUTH_TOKEN", "TWILIO_WEBHOOK_BASE_URL", "TWILIO_VOICE"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def voice(registry) -> TestClient:
    engine = SessionEngine(SessionStore(":memory:"))
    api = create_app(registry, engine)
    api.include_router(voice_router(registry, engine))
    return TestClient(api)


def _call(client: TestClient, url: str, **fields: str) -> ElementTree.Element:
    reply = client.post(url, data={"CallSid": "CA123", "From": "+14155550100", **fields}, headers=FORM)
    assert reply.status_code == 200 and reply.headers["content-type"].startswith("application/xml")
    return ElementTree.fromstring(reply.text)


def _spoken(root: ElementTree.Element) -> str:
    return " ".join(say.text or "" for say in root.iter("Say"))


def _next_url(root: ElementTree.Element) -> str:
    return root.find("Gather").get("action")


def test_first_call_lists_every_app(voice) -> None:
    root = _call(voice, "/voice")
    text = _spoken(root)
    assert "Press 1: AgriPulse CM" in text and "Press 2: Tontine-Check" in text
    assert root.find("Gather").get("numDigits") == "1"


def test_picking_an_app_redirects_to_it(voice) -> None:
    root = _call(voice, "/voice", Digits="2")
    assert parse_qs(urlparse(root.find("Redirect").text).query)["app"] == ["tontine-check"]


def test_full_keypad_journey_reaches_end_and_offers_restart(voice) -> None:
    root = _call(voice, "/voice?app=agripulse")
    assert "Press 1: Food prices." in _spoken(root)
    for key in ("1", "1"):
        root = _call(voice, _next_url(root), Digits=key)
    root = _call(voice, _next_url(root), Digits="1")
    assert "Plantain - Douala Sandaga" in _spoken(root) and root.find("Hangup") is not None
    assert "restart=1" in _next_url(root)


def test_history_lives_in_the_url_so_any_instance_can_answer(registry) -> None:
    """Two independent servers (two serverless instances) serve alternate steps of one call."""
    clients = []
    for _ in range(2):
        engine = SessionEngine(SessionStore(":memory:"))
        api = create_app(registry, engine)
        api.include_router(voice_router(registry, engine))
        clients.append(TestClient(api))
    root = _call(clients[0], "/voice?app=tontine-check")
    for index, key in enumerate(("2", "25000", "5")):
        root = _call(clients[(index + 1) % 2], _next_url(root), Digits=key)
    assert "Penalty: 2 500 FCFA" in _spoken(root)


def test_numeric_input_asks_for_hash_and_code_input_accepts_speech(voice) -> None:
    root = _call(voice, "/voice?app=tontine-check", Digits="")
    root = _call(voice, _next_url(root), Digits="2")
    assert "press hash" in _spoken(root) and root.find("Gather").get("input") == "dtmf"
    root = _call(voice, "/voice?app=tontine-check&h=4&n=receipt_code", SpeechResult="QT 2026 841.")
    assert "Status: VALID" in _spoken(root)


def test_free_text_speech_reaches_the_ai_advice(voice) -> None:
    root = _call(voice, "/voice?app=agripulse&h=4&n=advice_question", SpeechResult="White spots on my cassava leaves.")
    assert "Cassava:" in _spoken(root)


def test_silence_repeats_then_hangs_up(voice) -> None:
    root = _call(voice, "/voice?app=agripulse")
    for _ in range(3):
        root = _call(voice, root.find("Redirect").text)
    assert root.find("Hangup") is not None and "No answer" in _spoken(root)


def test_restart_after_end(voice) -> None:
    root = _call(voice, "/voice?app=agripulse&restart=1", Digits="1")
    assert "Press 4: Quick AI advice." in _spoken(root)
    root = _call(voice, "/voice?app=agripulse&restart=1", Digits="9")
    assert root.find("Hangup") is not None


def test_speakable_reads_keys_digit_by_digit() -> None:
    assert speakable("Menu\n1. Prices\n99. More\n00. Home") == "Menu Press 1: Prices. Press 9 9: More. Press 0 0: Home."
    assert speakable("*384*1#") == " star 384 star 1 hash "


def test_normalize_spoken_uses_the_manifest_example(registry) -> None:
    nodes = registry.resolve("tontine-check").manifest.nodes
    assert normalize_spoken("q t 2026 841.", nodes["receipt_code"]) == "QT-2026-841"
    assert normalize_spoken("M 03.", nodes["turn_member"]) == "M03"
    assert normalize_spoken("25,000", nodes["penalty_amount"]) == "25000"


def test_signature_is_enforced_when_a_token_is_set(voice, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setenv("TWILIO_WEBHOOK_BASE_URL", "https://ussd-reborn.vercel.app")
    fields = {"CallSid": "CA9", "From": "+14155550100", "Digits": "1"}
    assert voice.post("/voice", data=fields, headers=FORM).status_code == 403
    payload = "https://ussd-reborn.vercel.app/voice" + "".join(k + fields[k] for k in sorted(fields))
    signature = base64.b64encode(hmac.new(b"secret", payload.encode(), hashlib.sha1).digest()).decode()
    reply = voice.post("/voice", data=fields, headers={**FORM, "X-Twilio-Signature": signature})
    assert reply.status_code == 200
