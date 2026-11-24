"""GSM-7 normalisation, 160-char pagination and optional LLM compression with local fallback."""
import asyncio
import os
import re
import time
import unicodedata

import httpx

BODY_BUDGET = 156  # 160 minus len("CON ")
_EXTENSION = set("`[]{}\\^~|")  # GSM-7 escape chars cost two septets: never emitted
_TRANSLIT = str.maketrans({
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u00ab": '"', "\u00bb": '"',
    "\u2013": "-", "\u2014": "-", "\u2026": "...", "\u20ac": "EUR", "\u0153": "oe", "\u0152": "OE",
    "\u00e6": "ae", "\u00c6": "AE", "\u00df": "ss", "\u00a0": " ", "\t": " ",
    "[": "(", "]": ")", "{": "(", "}": ")", "|": "/", "~": "-", "\\": "/", "`": "'",
})
_PRESETS = {
    "openai": ("https://api.openai.com/v1", "gpt-4o-mini"),
    "groq": ("https://api.groq.com/openai/v1", "llama-3.1-8b-instant"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.5-flash"),
}


def to_gsm7(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.translate(_TRANSLIT))
    kept = "".join(c for c in decomposed if c == "\n" or (" " <= c <= "~" and c not in _EXTENSION))
    lines = (re.sub(r" {2,}", " ", line).strip() for line in kept.split("\n"))
    return "\n".join(lines).strip()


def is_gsm7(text: str) -> bool:
    return all(c == "\n" or (" " <= c <= "~" and c not in _EXTENSION) for c in text)


def abbreviate(text: str, abbreviations: dict[str, str]) -> str:
    """Whole-word, case-insensitive replacement that keeps a leading capital (sentence starts)."""
    for word, short in sorted(abbreviations.items(), key=lambda kv: -len(kv[0])):
        def keep_case(match: re.Match, short: str = short) -> str:
            return short[:1].upper() + short[1:] if match[0][:1].isupper() else short
        text = re.sub(rf"\b{re.escape(word)}\b", keep_case, text, flags=re.IGNORECASE)
    return text


def paginate(body: str, footer: str, budget: int = BODY_BUDGET) -> list[str]:
    """Split on line or word boundaries; every non-final page leaves room for the footer."""
    pages, rest, window = [], body, budget - len(footer)
    while len(rest) > budget:
        cut = rest.rfind("\n", 0, window + 1)
        if cut < window // 2:
            cut = rest.rfind(" ", 0, window + 1)
        cut = cut if cut > 0 else window
        pages.append(rest[:cut].rstrip())
        rest = rest[cut:].lstrip()
    return pages + [rest]


async def _ask_llm(text: str, budget: int) -> str | None:
    base, model = _PRESETS.get(os.getenv("LLM_PROVIDER", "").lower(), ("", ""))
    base, model = os.getenv("LLM_BASE_URL") or base, os.getenv("LLM_MODEL") or model
    prompt = (f"Rewrite as one telegraphic USSD screen of at most {budget - 16} characters, "
              "same language, plain ASCII, no emoji, keep every number. Output only the text.")
    payload = {"model": model, "temperature": 0.2, "max_tokens": 120,
               "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": text}]}
    headers = {"Authorization": f"Bearer {os.getenv('LLM_API_KEY', '')}"}
    async with httpx.AsyncClient() as client:
        reply = await client.post(f"{base.rstrip('/')}/chat/completions", json=payload, headers=headers)
        reply.raise_for_status()
        return reply.json()["choices"][0]["message"]["content"]


async def _try_llm(text: str, budget: int) -> tuple[str | None, str | None]:
    """Return (answer, None) or (None, fallback_reason). Never raises."""
    if not os.getenv("LLM_API_KEY"):
        return None, "no_api_key"
    try:
        timeout = float(os.getenv("LLM_TIMEOUT_SEC", "1.8"))
        answer = to_gsm7(await asyncio.wait_for(_ask_llm(text, budget), timeout) or "")
    except asyncio.TimeoutError:
        return None, "timeout"
    except Exception:  # network, HTTP or payload error: degrade, never fail the session
        return None, "llm_error"
    return (answer, None) if answer and len(answer) <= budget else (None, "over_budget")


async def compress(text: str, budget: int, use_ai: bool, abbreviations: dict[str, str]) -> tuple[str, dict]:
    """Return (content, telemetry): direct if it fits, else LLM rewrite, else deterministic fallback."""
    start, clean = time.perf_counter(), to_gsm7(text)
    content, mode, reason = clean, "direct", None
    if len(clean) > budget:
        answer, reason = await _try_llm(clean, budget) if use_ai else (None, "ai_disabled")
        mode = "ai" if answer else "deterministic_fallback"
        content = answer or abbreviate(clean, abbreviations)
    return content, {"raw_length": len(text), "compressed_length": len(content), "mode": mode,
                     "fallback_reason": reason, "latency_ms": round((time.perf_counter() - start) * 1000, 2)}
