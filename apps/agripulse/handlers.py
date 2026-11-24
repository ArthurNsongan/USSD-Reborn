"""AgriPulse handlers: pure functions (context, data) -> text. No I/O, no CON/END formatting."""
from __future__ import annotations

import unicodedata


def _fold(text: str) -> str:
    """Lowercase and strip accents so 'Mosaïc' matches 'mosaic'."""
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))


def _fcfa(amount: float) -> str:
    return f"{amount:,.0f}".replace(",", " ") + " FCFA"


def get_market_price(context: dict, data: dict) -> dict:
    market, product = context.get("market"), context.get("product")
    quote = data["prices"].get(market, {}).get(product)
    if quote is None:
        return {"text": "Price not available for this market.", "end": True}
    item = data["products"][product]
    text = (f"{item['label']} - {data['markets'][market]}\n"
            f"Price: {_fcfa(quote['price'])}/{item['unit']}\n"
            f"7-day trend: {quote['trend']}\n"
            f"Reported {data['reportDate']}")
    return {"text": text, "end": True}


def diagnose_cocoa(context: dict, data: dict) -> dict:
    return {"text": data["cocoa"].get(context.get("symptom"), "Unknown symptom."), "end": True}


def get_weather(context: dict, data: dict) -> dict:
    zone = data["weather"].get(context.get("zone"))
    if zone is None:
        return {"text": "Unknown region.", "end": True}
    text = f"Weather 48h {zone['label']}: {zone['rain']}, humidity {zone['humidity']}%.\n{zone['advice']}"
    return {"text": text, "end": True}


def quick_advice(context: dict, data: dict) -> dict:
    """Score the local knowledge base. Long answers are shortened by the AI compressor (or its fallback)."""
    question = _fold(str(context.get("question", "")))
    words = set(question.replace(",", " ").split())

    def score(entry: dict) -> int:
        crop_hit = any(k in question for k in entry["keywords"])
        symptom_hits = sum(1 for s in entry["symptoms"] if any(w.startswith(s) for w in words))
        return (10 if crop_hit else 0) + symptom_hits

    best = max(data["advice"], key=score)
    matched = score(best) >= 10
    answer = best["answer"] if matched else data["defaultAdvice"]
    return {"text": answer, "end": True, "context": {"advice_topic": best["keywords"][0] if matched else "general"}}
