"""Bite2G food delivery handlers: pure functions (context, data) -> dict | str. No I/O."""
from __future__ import annotations

import hashlib


def _fcfa(amount: float) -> str:
    return f"{amount:,.0f}".replace(",", " ") + " FCFA"


def place_order(context: dict, data: dict) -> dict:
    kitchen_id = str(context.get("kitchen", "mamaput"))
    tier = str(context.get("tier", "sig"))
    qty = int(context.get("qty", 1))
    landmark = str(context.get("landmark", "Gate")).strip()
    kitchen = data["kitchens"][kitchen_id]
    meal = kitchen["meals"][tier]
    total = meal["price"] * qty + data["deliveryFee"]
    seed = f"{kitchen_id}:{tier}:{qty}:{landmark}".encode("utf-8")
    digest = int(hashlib.sha256(seed).hexdigest()[:6], 16)
    order_id = f"ORD-{100 + (digest % 899)}"
    pin = f"{10 + (digest % 89)}"
    text = (f"Order {order_id} confirmed!\n"
            f"{qty}x {meal['title']}\n"
            f"To: {landmark} ({kitchen['etaMin']} min)\n"
            f"Total: {_fcfa(total)} (MoMo/Cash)\n"
            f"Rider PIN: {pin}")
    return {"text": text, "end": True, "context": {"order_id": order_id, "pin": pin, "total": total}}


def track_order(context: dict, data: dict) -> dict:
    code = str(context.get("order_id", "")).upper()
    order = data["orders"].get(code)
    if order is None:
        return {"text": f"Order {code} not found.\nCheck your SMS or dial *384*2*1# to order.", "end": True}
    text = (f"{code}: {order['status']}\n"
            f"{order['meal']}\n"
            f"Rider: {order['rider']}\n"
            f"Tel: {order['phone']} | PIN: {order['pin']}")
    return {"text": text, "end": True, "context": {"order_status": order["status"]}}


def match_craving(context: dict, data: dict) -> dict:
    query = str(context.get("craving", "")).lower()
    best = max(data["cravingRules"], key=lambda r: sum(1 for k in r["keywords"] if k in query))
    hits = sum(1 for k in best["keywords"] if k in query)
    answer = best["answer"] if hits > 0 else data["defaultCraving"]
    tag = best["tag"] if hits > 0 else "chef_pick"
    return {"text": answer, "end": True, "context": {"craving_tag": tag}}


def check_voucher(context: dict, data: dict) -> dict:
    code = str(context.get("voucher", "")).upper()
    promo = data["vouchers"].get(code)
    if promo is None:
        return {"text": f"Voucher {code}: INVALID or EXPIRED.\nTry KIRO26 or NIGHTFREE.", "end": True}
    text = (f"Voucher {code}: ACTIVE\n"
            f"Deal: {promo['discount']}\n"
            f"Min order: {_fcfa(promo['minOrder'])}\n"
            f"Valid until {promo['validUntil']}")
    return {"text": text, "end": True, "context": {"voucher_valid": True}}
