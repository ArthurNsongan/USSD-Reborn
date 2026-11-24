"""GSM / USSD invariants: GSM-7 alphabet, 160-char frames, pagination, LLM fallback."""
from __future__ import annotations

import asyncio
import random

import pytest

from core import gsm_compressor
from core.gsm_compressor import BODY_BUDGET, abbreviate, compress, is_gsm7, paginate, to_gsm7
from scripts.validate_manifests import validate_all

FOOTER = "\n99. Suite"
WORDS = ("plan", "marche", "pluie", "recolte", "cooperative", "village", "Douala", "prix", "semaine",
         "traitement", "x", "1250", "humidite", "conseil")


def _random_text(length: int, seed: int) -> str:
    rng, words = random.Random(seed), []
    while len(" ".join(words)) < length:
        words.append(rng.choice(WORDS) + ("\n" if rng.random() < 0.1 else ""))
    return " ".join(words)[:length].strip()


def test_transliterates_accents_ligatures_and_typography() -> None:
    assert to_gsm7("Récolte à Yaoundé – cœur “bio” 5 €") == "Recolte a Yaounde - coeur \"bio\" 5 EUR"


def test_drops_emojis_and_gsm7_extension_characters() -> None:
    cleaned = to_gsm7("Prix 🌱 [promo] {a|b} ~ok^ `x` \\ fin")
    assert is_gsm7(cleaned)
    assert "🌱" not in cleaned and not set("[]{}|~^`\\") & set(cleaned)
    assert cleaned.startswith("Prix (promo) (a/b) -ok")


def test_collapses_spaces_and_trims_lines() -> None:
    assert to_gsm7("  a   b \n\t c  ") == "a b\nc"


@pytest.mark.parametrize("length", [50, 155, 156, 157, 200, 320, 500, 800, 1200])
@pytest.mark.parametrize("seed", [1, 2, 3])
def test_pagination_respects_budget_and_keeps_every_word(length: int, seed: int) -> None:
    text = to_gsm7(_random_text(length, seed))
    pages = paginate(text, FOOTER)
    for page in pages[:-1]:
        assert len("CON " + page + FOOTER) <= 160
    assert len("END " + pages[-1]) <= 160
    assert " ".join(pages).split() == text.split()
    if len(text) <= BODY_BUDGET:
        assert pages == [text]


def test_pagination_hard_cuts_a_single_huge_word() -> None:
    pages = paginate("A" * 400, FOOTER)
    assert all(len(p) <= BODY_BUDGET - len(FOOTER) for p in pages[:-1])
    assert "".join(pages) == "A" * 400


def test_abbreviations_are_whole_word_and_keep_sentence_case() -> None:
    text = abbreviate("Traitement du traitementX. Pour le traitement.", {"traitement": "trait.", "pour": "pr"})
    assert text == "Trait. du traitementX. Pr le trait.."


def _compress(text: str, budget: int = BODY_BUDGET, use_ai: bool = True):
    return asyncio.run(compress(text, budget, use_ai, {"semaine": "sem."}))


def test_short_text_is_sent_direct() -> None:
    content, telemetry = _compress("Prix du jour: 4500")
    assert content == "Prix du jour: 4500" and telemetry["mode"] == "direct"


def test_long_text_without_key_uses_deterministic_fallback() -> None:
    content, telemetry = _compress("Une semaine " * 30)
    assert telemetry["mode"] == "deterministic_fallback" and telemetry["fallback_reason"] == "no_api_key"
    assert "sem." in content and "semaine" not in content


def test_ai_disabled_on_node_never_calls_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test")

    async def boom(*_):
        raise AssertionError("LLM must not be called")
    monkeypatch.setattr(gsm_compressor, "_ask_llm", boom)
    _, telemetry = _compress("x " * 200, use_ai=False)
    assert telemetry["fallback_reason"] == "ai_disabled"


def test_llm_success_is_used_when_it_fits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test")

    async def fake(text: str, budget: int) -> str:
        return "Résumé court: 3 conseils clés."
    monkeypatch.setattr(gsm_compressor, "_ask_llm", fake)
    content, telemetry = _compress("mot " * 100)
    assert telemetry["mode"] == "ai" and content == "Resume court: 3 conseils cles."


def test_llm_timeout_falls_back_within_deadline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test")
    monkeypatch.setenv("LLM_TIMEOUT_SEC", "0.2")

    async def slow(text: str, budget: int) -> str:
        await asyncio.sleep(5)
        return "too late"
    monkeypatch.setattr(gsm_compressor, "_ask_llm", slow)
    _, telemetry = _compress("mot " * 100)
    assert telemetry["mode"] == "deterministic_fallback" and telemetry["fallback_reason"] == "timeout"
    assert telemetry["latency_ms"] < 1500


@pytest.mark.parametrize("answer, reason", [("x" * 400, "over_budget"), ("", "over_budget"), (None, "over_budget")])
def test_llm_unusable_answer_falls_back(monkeypatch: pytest.MonkeyPatch, answer, reason) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test")

    async def fake(text: str, budget: int):
        return answer
    monkeypatch.setattr(gsm_compressor, "_ask_llm", fake)
    _, telemetry = _compress("mot " * 100)
    assert telemetry["mode"] == "deterministic_fallback" and telemetry["fallback_reason"] == reason


def test_llm_network_error_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test")

    async def broken(text: str, budget: int):
        raise ConnectionError("no network on 2G")
    monkeypatch.setattr(gsm_compressor, "_ask_llm", broken)
    _, telemetry = _compress("mot " * 100)
    assert telemetry["fallback_reason"] == "llm_error"


def test_every_reachable_screen_of_every_app_is_a_valid_ussd_frame() -> None:
    report = validate_all()
    assert report["passed"], report
    assert all(app["longest_frame"] <= 160 for app in report["apps"].values())
