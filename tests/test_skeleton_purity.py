"""Skeleton Crew guard: core/ < 400 logical LOC and zero domain vocabulary."""
from __future__ import annotations

from pathlib import Path

from scripts.check_skeleton_purity import FORBIDDEN_TERMS, MAX_LOC, audit, count_logical_loc

ROOT = Path(__file__).resolve().parent.parent


def test_core_is_under_400_logical_lines_and_has_no_domain_leak() -> None:
    report = audit(ROOT / "core")
    assert report["core_loc"] < MAX_LOC, report["files"]
    assert report["domain_leaks"] == 0, report["leaks"]
    assert report["passed"]


def test_core_never_imports_apps() -> None:
    for source in (ROOT / "core").glob("*.py"):
        text = source.read_text(encoding="utf-8")
        assert "from apps" not in text and "import apps" not in text, source.name


def test_leak_detection_catches_strings_identifiers_and_comments(tmp_path: Path) -> None:
    (tmp_path / "bad.py").write_text('price_cacao = 1  # tontine\nlabel = "FCFA"\n', encoding="utf-8")
    report = audit(tmp_path)
    assert {leak["term"] for leak in report["leaks"]} == {"cacao", "tontine", "fcfa"}
    assert not report["passed"]


def test_loc_counter_ignores_blanks_comments_and_docstrings(tmp_path: Path) -> None:
    source = '"""Module doc\nover two lines."""\n\n# comment\ndef f():\n    """Doc."""\n    return 1\n'
    path = tmp_path / "m.py"
    path.write_text(source, encoding="utf-8")
    assert count_logical_loc(path) == 2


def test_forbidden_terms_cover_both_apps() -> None:
    assert {"cacao", "plantain", "tontine", "quittance", "fcfa", "sandaga"} <= set(FORBIDDEN_TERMS)
