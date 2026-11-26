"""NightRx 24/7 handlers: pure functions (context, data) -> dict | str. No I/O."""
from __future__ import annotations

import hashlib
import hmac


def _fcfa(amount: float) -> str:
    return f"{amount:,.0f}".replace(",", " ") + " FCFA"


def find_duty_pharmacy(context: dict, data: dict) -> dict:
    zone = str(context.get("zone", ""))
    info = data["pharmacies"].get(zone)
    if info is None:
        return {"text": "No duty pharmacy listed for this district.", "end": True}
    text = (f"{info['name']}\n"
            f"Loc: {info['district']}\n"
            f"Tel: {info['phone']} (until {info['dutyUntil']})\n"
            f"Stock: {info['stockNote']}")
    return {"text": text, "end": True, "context": {"pharmacy": info["name"]}}


def reserve_medicine(context: dict, data: dict) -> dict:
    zone = str(context.get("zone", ""))
    med_id = str(context.get("med", ""))
    pharmacy = data["pharmacies"].get(zone)
    med = data["medicines"].get(med_id)
    if pharmacy is None or med is None:
        return {"text": "Medicine or pharmacy unavailable.", "end": True}
    qty_left = med["stock"].get(zone, 0)
    digest = hashlib.sha256(f"{zone}:{med_id}:{med['price']}".encode("utf-8")).hexdigest()[:4].upper()
    hold_code = f"RX-{digest}"
    text = (f"Hold confirmed: {hold_code} (2h)\n"
            f"{med['label']}\n"
            f"At: {pharmacy['name']} ({qty_left} left)\n"
            f"Pay at window: {_fcfa(med['price'])}")
    return {"text": text, "end": True, "context": {"hold_code": hold_code, "price": med["price"]}}


def _seal_signature(code: str, seal: dict, secret: str) -> str:
    payload = f"{code}|{seal['drug']}|{seal['batch']}|{seal['expiry']}|{secret}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8].upper()


def verify_drug_seal(context: dict, data: dict) -> dict:
    code = str(context.get("seal_code", "")).upper()
    seal = data["seals"].get(code)
    if seal is None:
        return {"text": f"Seal {code}: UNKNOWN LOT.\nQuarantine box and report to pharmacist.", "end": True}
    expected = _seal_signature(code, seal, data["sealSecret"])
    sig_ok = hmac.compare_digest(expected, seal["signature"])
    if not sig_ok or seal["scans"] > 1:
        text = (f"ALERT: COUNTERFEIT CLONE!\n"
                f"Code {code} ({seal['drug']})\n"
                f"Scanned {seal['scans']}x across 6 cities.\n"
                f"Do NOT consume.")
        return {"text": text, "end": True, "context": {"seal_authentic": False}}
    text = (f"AUTHENTIC SEAL {code}\n"
            f"{seal['drug']}\n"
            f"{seal['batch']} - Exp {seal['expiry']}\n"
            f"SHA-256 verified (1st scan)")
    return {"text": text, "end": True, "context": {"seal_authentic": True}}


def ai_triage(context: dict, data: dict) -> dict:
    query = str(context.get("symptom_query", "")).lower()
    best = max(data["triage"], key=lambda item: sum(1 for k in item["keywords"] if k in query))
    hits = sum(1 for k in best["keywords"] if k in query)
    answer = best["answer"] if hits > 0 else data["defaultTriage"]
    topic = best["topic"] if hits > 0 else "general"
    return {"text": answer, "end": True, "context": {"triage_topic": topic}}
