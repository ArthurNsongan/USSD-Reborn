"""End-to-end Tontine-Check (*384*2#) journeys."""
from __future__ import annotations

import pytest

APP = "*384*2#"


def test_member_turn(dial) -> None:
    frame = dial(APP, "1*M03")
    assert frame.prefix == "END"
    assert "Tour 5/12 le 04/01/2027" in frame.body and "300 000 FCFA" in frame.body


def test_member_already_paid_out(dial) -> None:
    assert "recu le 06/09/2026" in dial(APP, "1*M01").body


def test_unknown_member(dial) -> None:
    assert "M99 inconnu" in dial(APP, "1*M99").body


@pytest.mark.parametrize("amount, days, penalty, total, capped", [
    (25000, 5, "2 500", "27 500", False),
    (10000, 1, "200", "10 200", False),
    (25000, 12, "6 000", "31 000", False),
    (25000, 13, "6 250", "31 250", True),
    (50000, 365, "12 500", "62 500", True),
])
def test_late_penalty(dial, amount, days, penalty, total, capped) -> None:
    frame = dial(APP, f"2*{amount}*{days}", sid=f"{amount}-{days}")
    assert f"Penalite: {penalty} FCFA" in frame.body and f"Total a verser: {total} FCFA" in frame.body
    assert ("(plafond)" in frame.body) is capped


def test_relief_fund_overview_then_eligibility(dial) -> None:
    overview = dial(APP, "3")
    assert overview.prefix == "CON" and "840 000 FCFA" in overview.body and "1. Mon eligibilite" in overview.body
    assert "NON ELIGIBLE: anciennete 2 mois" in dial(APP, "3*1*M04").body
    assert "Aide d'urgence: ELIGIBLE" in dial(APP, "3*1*M05", sid="m5").body
    assert "cotisations en retard" in dial(APP, "3*1*M02", sid="m2").body


@pytest.mark.parametrize("code, status", [
    ("QT-2026-841", "Statut: VALIDE"),
    ("QT-2026-860", "ALTEREE"),
    ("QT-2026-999", "INCONNUE"),
])
def test_receipt_verification(dial, code: str, status: str) -> None:
    assert status in dial(APP, f"4*{code}", sid=code).body


def test_receipt_format_is_validated(dial) -> None:
    frame = dial(APP, "4*QT26")
    assert frame.current_node == "receipt_code" and "Format attendu" in frame.body


def test_back_from_input_returns_to_menu(dial) -> None:
    assert dial(APP, "2*0").current_node == "home"
