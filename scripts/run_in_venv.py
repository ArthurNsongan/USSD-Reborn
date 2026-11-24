"""Cross-platform launcher that executes Python commands inside the local .venv if present.

Usage: python scripts/run_in_venv.py <python args...>
Example: python scripts/run_in_venv.py -m pytest tests/test_gsm_constraints.py -q
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _resolve_python() -> str:
    candidates = (
        ROOT / ".venv" / "Scripts" / "python.exe",  # Windows
        ROOT / ".venv" / "bin" / "python",          # macOS / Linux
    )
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return sys.executable


def main(argv: list[str]) -> int:
    if not argv:
        print("Usage: python scripts/run_in_venv.py <python args...>", file=sys.stderr)
        return 2
    completed = subprocess.run([_resolve_python(), *argv], cwd=str(ROOT))
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
