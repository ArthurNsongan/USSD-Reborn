"""Session state machine: navigation keys, replay, input diffing, expiry, persistence, loader errors."""
from __future__ import annotations

import asyncio
import json

import pytest

from core.manifest_loader import AppRegistry, ManifestError
from core.session_engine import SessionEngine, SessionStore
from tests.conftest import SCHEMA, minimal_manifest

AGRI = "*384*3#"
TONTINE = "*384*4#"


def test_empty_text_starts_on_entry_node(dial) -> None:
    frame = dial(AGRI)
    assert frame.prefix == "CON" and frame.current_node == "home" and frame.stack == []
    assert frame.raw_response.startswith("CON AgriPulse CM")


def test_option_pushes_stack_and_back_pops_it(dial) -> None:
    dial(AGRI, "", mode="step")
    assert dial(AGRI, "1", mode="step").current_node == "price_market"
    frame = dial(AGRI, "2", mode="step")
    assert frame.current_node == "price_product" and frame.stack == ["home", "price_market"]
    frame = dial(AGRI, "0", mode="step")
    assert frame.current_node == "price_market" and frame.stack == ["home"]


def test_home_key_clears_stack(dial) -> None:
    dial(AGRI, "1*2")
    frame = dial(AGRI, "1*2*00")
    assert frame.current_node == "home" and frame.stack == []


def test_invalid_choice_keeps_node_and_shows_notice(dial) -> None:
    frame = dial(AGRI, "7")
    assert frame.current_node == "home" and frame.prefix == "CON"
    assert frame.body.startswith("Invalid choice.")


def test_back_label_on_child_screens_only(dial) -> None:
    assert "0. Back" not in dial(AGRI).body
    assert dial(AGRI, "1").body.endswith("0. Back")


def test_cumulative_replay_equals_step_by_step(dial) -> None:
    replay = dial(AGRI, "1*1*1", sid="replay")
    dial(AGRI, "", sid="steps", mode="step")
    for value in ("1", "1"):
        dial(AGRI, value, sid="steps", mode="step")
    stepwise = dial(AGRI, "1", sid="steps", mode="step")
    assert replay.raw_response == stepwise.raw_response
    assert replay.prefix == "END"


def test_cumulative_text_only_processes_new_segments(dial) -> None:
    dial(AGRI, "")
    dial(AGRI, "1")
    frame = dial(AGRI, "1*2")
    assert frame.current_node == "price_product" and frame.context == {"market": "mfoundi"}


@pytest.mark.parametrize("app, texts", [
    (AGRI, ["", "2", "2*1", "2*1*99"]),
    (AGRI, ["", "7", "7*1", "7*1*0", "7*1*0*00", "7*1*0*00*3*2"]),
    (TONTINE, ["", "2", "2*abc", "2*abc*25000", "2*abc*25000*5"]),
])
def test_lost_session_is_rebuilt_from_cumulative_text(registry, app, texts) -> None:
    """Serverless: each request may hit a fresh instance with an empty store. Frames must not change."""
    stateful = SessionEngine(SessionStore())
    for text in texts:
        expected = asyncio.run(stateful.handle(registry.resolve(app), "s", "", text))
        rebuilt = asyncio.run(SessionEngine(SessionStore()).handle(registry.resolve(app), "s", "", text))
        assert rebuilt.raw_response == expected.raw_response, text
        assert rebuilt.current_node == expected.current_node and rebuilt.stack == expected.stack


def test_retransmitted_request_returns_same_screen(dial) -> None:
    first = dial(AGRI, "1")
    again = dial(AGRI, "1")
    assert first.raw_response == again.raw_response and again.stack == ["home"]


def test_diverged_history_restarts_and_replays(dial) -> None:
    dial(AGRI, "1*2")
    frame = dial(AGRI, "3")
    assert frame.current_node == "weather_zone" and frame.stack == ["home"]


def test_next_page_then_end_deletes_session(dial, engine) -> None:
    first = dial(AGRI, "2*1")
    assert first.prefix == "CON" and first.total_pages == 2 and first.body.endswith("99. More")
    last = dial(AGRI, "2*1*99")
    assert last.prefix == "END" and last.page_index == 1
    assert engine.store.load("s1") is None


def test_next_page_key_without_more_pages_is_invalid(dial) -> None:
    assert dial(AGRI, "99").body.startswith("Invalid choice.")


def test_input_validation_error_message(dial) -> None:
    frame = dial(TONTINE, "2*abc")
    assert frame.current_node == "penalty_amount" and frame.body.startswith("Invalid amount")
    frame = dial(TONTINE, "2*100", sid="low")
    assert frame.current_node == "penalty_amount"


def test_numeric_input_is_stored_as_number(dial) -> None:
    frame = dial(TONTINE, "2*25000")
    assert frame.context["amount"] == 25000 and "Amount: 25000 FCFA" in frame.body


def test_code_input_is_upper_cased(dial) -> None:
    assert "M03 Mbarga Aline" in dial(TONTINE, "1*m03").body


def test_session_expires_after_timeout(dial, clock, engine) -> None:
    dial(AGRI, "1")
    clock.advance(181)
    frame = dial(AGRI, "1*1")
    assert frame.prefix == "END" and "Session expired" in frame.body
    assert engine.store.load("s1") is None


def test_session_survives_within_timeout(dial, clock) -> None:
    dial(AGRI, "1")
    clock.advance(170)
    assert dial(AGRI, "1*1").current_node == "price_product"


def test_sessions_persist_in_sqlite_across_engines(registry, tmp_path) -> None:
    db = str(tmp_path / "sessions.db")
    app = registry.resolve(AGRI)
    asyncio.run(SessionEngine(SessionStore(db)).handle(app, "persist", "", "1"))
    frame = asyncio.run(SessionEngine(SessionStore(db)).handle(app, "persist", "", "1*2"))
    assert frame.current_node == "price_product" and frame.stack == ["home", "price_market"]


def test_count_active_sessions(dial, engine, clock) -> None:
    dial(AGRI, "", sid="a")
    dial(AGRI, "", sid="b")
    assert engine.store.count_active(clock.now - 10) == 2


def test_handler_exception_ends_with_error_message(make_app) -> None:
    manifest = minimal_manifest(nodes={
        "home": {"type": "menu", "title": "Demo", "options": [{"key": "1", "label": "Go", "next": "act"}]},
        "act": {"type": "action", "handler": "explode"},
    }, navigation={"errorMessage": "Down."})
    app_dir = make_app(manifest, "def explode(context, data):\n    raise RuntimeError('bug')\n")
    registry = AppRegistry(app_dir.parent, SCHEMA).load()
    frame = asyncio.run(SessionEngine(SessionStore()).handle(registry.resolve("demo"), "x", "", "1"))
    assert frame.raw_response == "END Down."


def test_static_node_interpolates_context(make_app) -> None:
    manifest = minimal_manifest(nodes={
        "home": {"type": "menu", "title": "Demo", "options": [
            {"key": "1", "label": "Go", "next": "done", "set": {"who": "Douala"}}]},
        "done": {"type": "static", "text": "Hello {who} {missing}", "end": True},
    })
    registry = AppRegistry(make_app(manifest).parent, SCHEMA).load()
    frame = asyncio.run(SessionEngine(SessionStore()).handle(registry.resolve("*999#"), "x", "", "1"))
    assert frame.raw_response == "END Hello Douala (missing)"


@pytest.mark.parametrize("mutate, message", [
    (lambda m: m.update(entryNode="nowhere"), "entryNode"),
    (lambda m: m["nodes"]["home"]["options"][0].update(next="ghost"), "ghost"),
    (lambda m: m["nodes"]["home"]["options"][0].update(key="99"), "reserved"),
    (lambda m: m["nodes"].update(done={"type": "action", "handler": "missing"}), "handler 'missing'"),
    (lambda m: m["nodes"].update(done={"type": "input", "prompt": "?"}), "saveAs"),
    (lambda m: m.update(shortcode="384"), "shortcode"),
])
def test_loader_rejects_broken_manifests(make_app, mutate, message) -> None:
    manifest = minimal_manifest()
    mutate(manifest)
    app_dir = make_app(manifest)
    with pytest.raises(ManifestError, match=message):
        AppRegistry(app_dir.parent, SCHEMA).load()


def test_loader_rejects_id_folder_mismatch(make_app) -> None:
    app_dir = make_app(minimal_manifest(), folder="other")
    with pytest.raises(ManifestError, match="folder"):
        AppRegistry(app_dir.parent, SCHEMA).load()


def test_loader_rejects_duplicate_shortcodes(make_app) -> None:
    first = make_app(minimal_manifest(id="one"))
    make_app(minimal_manifest(id="two"))
    with pytest.raises(ManifestError, match="already used"):
        AppRegistry(first.parent, SCHEMA).load()


def test_loader_registers_only_public_functions(make_app) -> None:
    source = "def _private(c, d):\n    return ''\n\ndef public(c, d):\n    return 'ok'\n"
    registry = AppRegistry(make_app(minimal_manifest(), source).parent, SCHEMA).load()
    assert list(registry.resolve("demo").handlers) == ["public"]


def test_api_payload_of_manifest_is_json_serialisable(registry) -> None:
    for app in registry.apps.values():
        json.dumps(app.manifest.model_dump())
