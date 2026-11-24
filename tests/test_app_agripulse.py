"""End-to-end AgriPulse (*384*1#) journeys."""
from __future__ import annotations

import pytest

APP = "*384*1#"


@pytest.mark.parametrize("path, expected", [
    ("1*1*1", ["Plantain - Douala Sandaga", "4 500 FCFA/regime", "+5%"]),
    ("1*2*4", ["Huile de palme - Yaounde Mfoundi", "1 200 FCFA/litre"]),
    ("1*4*5", ["Cacao - Bamenda", "4 600 FCFA/kg", "-3%"]),
])
def test_market_prices(dial, path: str, expected: list[str]) -> None:
    frame = dial(APP, path)
    assert frame.prefix == "END"
    for fragment in expected:
        assert fragment in frame.body


def test_cocoa_diagnosis_paginates_then_ends(dial) -> None:
    first = dial(APP, "2*1")
    assert first.body.startswith("Pourriture brune (Phytophthora)") and first.prefix == "CON"
    assert first.telemetry["mode"] == "deterministic_fallback"
    last = dial(APP, "2*1*99")
    assert last.prefix == "END" and "elaguer" in last.body


@pytest.mark.parametrize("symptom, keyword", [("1", "Pourriture"), ("2", "Capsides"), ("3", "swollen shoot")])
def test_each_cocoa_symptom(dial, symptom: str, keyword: str) -> None:
    assert keyword in dial(APP, f"2*{symptom}", sid=symptom).body


def test_weather_bulletin(dial) -> None:
    frame = dial(APP, "3*2")
    assert frame.prefix == "END" and "Meteo 48h Centre" in frame.body and "79%" in frame.body


def test_quick_advice_matches_local_knowledge_base(dial) -> None:
    frame = dial(APP, "4*taches blanches feuilles manioc")
    assert frame.body.startswith("Manioc:") and frame.context["advice_topic"] == "manioc"
    assert frame.telemetry["fallback_reason"] == "no_api_key"


def test_quick_advice_handles_accents_and_unknown_topics(dial) -> None:
    assert dial(APP, "4*Mosaïque sur les feuilles de manioc", sid="a").context["advice_topic"] == "manioc"
    assert dial(APP, "4*probleme inconnu", sid="b").context["advice_topic"] == "general"


def test_advice_question_too_short(dial) -> None:
    frame = dial(APP, "4*ab")
    assert frame.current_node == "advice_question" and frame.body.startswith("Texte trop court")


def test_all_presets_run(dial, registry) -> None:
    for i, preset in enumerate(registry.resolve(APP).manifest.quickPresets):
        assert dial(APP, preset["inputs"], sid=f"preset-{i}").char_count <= 160
