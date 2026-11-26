"""End-to-end Tontine-Check (*384*4#) journeys."""
from __future__ import annotations

import pytest

APP = "*384*4#"


def test_member_turn(dial) -> None:
    frame = dial(APP, "1*M03")
    assert frame.prefix == "END"
    assert "Turn 5/12 on 04/01/2027" in frame.body and "300 000 FCFA" in frame.body


def test_member_already_paid_out(dial) -> None:
    assert "paid on 06/09/2026" in dial(APP, "1*M01").body


def test_unknown_member(dial) -> None:
    assert "Member M99 not found" in dial(APP, "1*M99").body


@pytest.mark.parametrize("amount, days, penalty, total, capped", [
    (25000, 5, "2 500", "27 500", False),
    (10000, 1, "200", "10 200", False),
    (25000, 12, "6 000", "31 000", False),
    (25000, 13, "6 250", "31 250", True),
    (50000, 365, "12 500", "62 500", True),
])
def test_late_penalty(dial, amount, days, penalty, total, capped) -> None:
    frame = dial(APP, f"2*{amount}*{days}", sid=f"{amount}-{days}")
    assert f"Penalty: {penalty} FCFA" in frame.body and f"Total due: {total} FCFA" in frame.body
    assert ("(cap)" in frame.body) is capped


def test_relief_fund_overview_then_eligibility(dial) -> None:
    overview = dial(APP, "3")
    assert overview.prefix == "CON" and "840 000 FCFA" in overview.body and "1. My eligibility" in overview.body
    assert "NOT ELIGIBLE: seniority 2 months" in dial(APP, "3*1*M04").body
    assert "Emergency aid: ELIGIBLE" in dial(APP, "3*1*M05", sid="m5").body
    assert "late contributions" in dial(APP, "3*1*M02", sid="m2").body


@pytest.mark.parametrize("code, status", [
    ("QT-2026-841", "Status: VALID"),
    ("QT-2026-860", "TAMPERED"),
    ("QT-2026-999", "UNKNOWN"),
])
def test_receipt_verification(dial, code: str, status: str) -> None:
    assert status in dial(APP, f"4*{code}", sid=code).body


def test_receipt_format_is_validated(dial) -> None:
    frame = dial(APP, "4*QT26")
    assert frame.current_node == "receipt_code" and "Expected format" in frame.body


def test_back_from_input_returns_to_menu(dial) -> None:
    assert dial(APP, "2*0").current_node == "home"
