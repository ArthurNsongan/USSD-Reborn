"""End-to-end NightRx 24/7 Pharmacy (*384*1#) journeys."""
from __future__ import annotations

import pytest

APP = "*384*1#"


@pytest.mark.parametrize("zone_key, expected", [
    ("1", ["St-Martin 24/7 Pharmacy", "Akwa Blvd", "+237 699 10 22 40"]),
    ("2", ["Lagoon Night Pharmacy", "Bonapriso"]),
    ("4", ["Central Bastos 24/7", "Yaounde"]),
])
def test_find_duty_pharmacy(dial, zone_key: str, expected: list[str]) -> None:
    frame = dial(APP, f"1*{zone_key}", sid=f"duty-{zone_key}")
    assert frame.prefix == "END"
    for fragment in expected:
        assert fragment in frame.body


def test_reserve_urgent_medicine_generates_hold_code(dial) -> None:
    frame = dial(APP, "2*1*1")
    assert frame.prefix == "END"
    assert "Hold confirmed: RX-" in frame.body
    assert "Insulin Glargine 100U pen" in frame.body
    assert "14 500 FCFA" in frame.body
    assert frame.context["price"] == 14500


@pytest.mark.parametrize("code, authentic, snippet", [
    ("RX-2026-841", True, "AUTHENTIC SEAL RX-2026-841"),
    ("RX-2026-860", False, "ALERT: COUNTERFEIT CLONE!"),
])
def test_drug_seal_verification(dial, code: str, authentic: bool, snippet: str) -> None:
    frame = dial(APP, f"3*{code}", sid=code)
    assert frame.prefix == "END"
    assert snippet in frame.body
    assert frame.context["seal_authentic"] is authentic


def test_unknown_drug_seal(dial) -> None:
    frame = dial(APP, "3*RX-2026-999")
    assert "UNKNOWN LOT" in frame.body


def test_ai_triage_paginates_and_matches_topic(dial) -> None:
    first = dial(APP, "4*high fever 39C child 14kg")
    assert first.prefix == "CON" and first.body.endswith("99. More")
    assert first.context["triage_topic"] == "fever"
    second = dial(APP, "4*high fever 39C child 14kg*99")
    assert second.prefix == "END"


def test_all_night_rx_presets_run(dial, registry) -> None:
    for i, preset in enumerate(registry.resolve(APP).manifest.quickPresets):
        assert dial(APP, preset["inputs"], sid=f"rx-preset-{i}").char_count <= 160
