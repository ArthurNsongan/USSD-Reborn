"""Skeleton Crew guard: core/ must stay under 400 logical lines and contain zero domain terms.

Usage: python scripts/check_skeleton_purity.py [--json]
Exit code 1 on any violation.
"""
from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORE_DIR = ROOT / "core"
MAX_LOC = 400

# Vocabulary that belongs to apps, never to the skeleton (case-insensitive substring match).
FORBIDDEN_TERMS: tuple[str, ...] = (
    # agriculture / food markets
    "agri", "cacao", "cocoa", "plantain", "manioc", "cassava", "macabo", "palme", "vivre",
    "recolte", "harvest", "farmer", "meteo", "capside", "cocoyam", "mirid", "fungicide",
    # Cameroonian places and currency
    "sandaga", "mfoundi", "bafoussam", "bamenda", "douala", "yaounde", "littoral",
    "fcfa", "xaf",
    # community finance
    "tontine", "cotisation", "quittance", "penalite", "beneficiaire", "cagnotte", "caisse",
    "njangi", "payout",
    # health
    "pharmacie", "pharmacy", "mediguide", "posologie", "dosage", "medic",
)


def _docstring_lines(source: str) -> set[int]:
    """Line numbers covered by module, class and function docstrings (documentation, as cloc counts them)."""
    lines: set[int] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.body:
            first = node.body[0]
            if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
                lines.update(range(first.lineno, first.end_lineno + 1))
    return lines


def count_logical_loc(path: Path) -> int:
    """Logical lines of code: not blank, not a comment, not a docstring (cloc convention)."""
    source = path.read_text(encoding="utf-8")
    docs = _docstring_lines(source)
    return sum(1 for number, line in enumerate(source.splitlines(), start=1)
               if line.strip() and not line.strip().startswith("#") and number not in docs)


def find_leaks(path: Path) -> list[dict[str, object]]:
    leaks = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        lowered = line.lower()
        leaks += [{"file": path.name, "line": number, "term": t} for t in FORBIDDEN_TERMS if t in lowered]
    return leaks


def audit(core_dir: Path = CORE_DIR) -> dict[str, object]:
    files = sorted(Path(core_dir).glob("**/*.py"))
    per_file = {str(f.relative_to(core_dir)).replace("\\", "/"): count_logical_loc(f) for f in files}
    leaks = [leak for f in files for leak in find_leaks(f)]
    total = sum(per_file.values())
    return {
        "core_loc": total,
        "max_loc": MAX_LOC,
        "files": per_file,
        "domain_leaks": len(leaks),
        "leaks": leaks,
        "passed": total < MAX_LOC and not leaks,
    }


def main(argv: list[str]) -> int:
    report = audit()
    if "--json" in argv:
        print(json.dumps(report, indent=2))
    else:
        for name, loc in report["files"].items():
            print(f"  {name:<24} {loc:>4} LOC")
        print(f"core/ total: {report['core_loc']} / {MAX_LOC} logical lines")
        for leak in report["leaks"]:
            print(f"  LEAK {leak['file']}:{leak['line']} -> '{leak['term']}'")
        print(f"domain leaks: {report['domain_leaks']}")
        print("SKELETON PURITY: PASS" if report["passed"] else "SKELETON PURITY: FAIL")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
