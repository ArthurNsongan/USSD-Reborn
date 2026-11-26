"""End-to-end Bite2G Food Delivery (*384*2#) journeys."""
from __future__ import annotations

import pytest

APP = "*384*2#"


def test_order_hot_meal_generates_order_id_and_rider_pin(dial) -> None:
    frame = dial(APP, "1*1*1*2*Akwa Total Gate")
    assert frame.prefix == "END"
    assert "2x Poulet DG + Ripe Plantain" in frame.body
    assert "Total: 7 500 FCFA" in frame.body
    assert "Rider PIN:" in frame.body
    assert frame.context["total"] == 7500
    assert frame.context["order_id"].startswith("ORD-")


@pytest.mark.parametrize("order_id, snippet", [
    ("ORD-402", "ON MOTO (5 min away)"),
    ("ORD-519", "ON GRILL"),
    ("ORD-880", "DELIVERED"),
    ("ORD-999", "not found"),
])
def test_track_active_order(dial, order_id: str, snippet: str) -> None:
    frame = dial(APP, f"2*{order_id}", sid=order_id)
    assert frame.prefix == "END"
    assert snippet in frame.body


def test_craving_matcher_routes_and_compresses(dial) -> None:
    frame = dial(APP, "3*spicy high protein under 3500")
    assert frame.context["craving_tag"] == "spicy_protein"
    assert "Suya Beef" in frame.body


@pytest.mark.parametrize("code, expected", [
    ("KIRO26", "25% OFF"),
    ("NIGHTFREE", "FREE Moto Delivery"),
    ("BADCODE", "INVALID or EXPIRED"),
])
def test_check_promo_voucher(dial, code: str, expected: str) -> None:
    frame = dial(APP, f"4*{code}", sid=code)
    assert frame.prefix == "END" and expected in frame.body


def test_all_bite2g_presets_run(dial, registry) -> None:
    for i, preset in enumerate(registry.resolve(APP).manifest.quickPresets):
        assert dial(APP, preset["inputs"], sid=f"bite-preset-{i}").char_count <= 160
