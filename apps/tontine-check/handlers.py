"""Tontine-Check handlers: pure financial computations (context, data) -> text. No I/O."""
from __future__ import annotations

import hashlib
import hmac


def _fcfa(amount: float) -> str:
    return f"{amount:,.0f}".replace(",", " ") + " FCFA"


def _member(context: dict, data: dict) -> tuple[str, dict | None]:
    code = str(context.get("member_code", "")).upper()
    return code, data["members"].get(code)


def member_turn(context: dict, data: dict) -> dict:
    code, member = _member(context, data)
    if member is None:
        return {"text": f"Member {code} not found in {data['group']['name']}.", "end": True}
    group = data["group"]
    pot = group["contribution"] * group["members"]
    when = f"paid on {member['turnDate']}" if member["received"] else f"on {member['turnDate']}"
    text = (f"{code} {member['name']}\n"
            f"Turn {member['rank']}/{group['members']} {when}\n"
            f"Pot: {_fcfa(pot)}\n"
            f"Contributions: {member['status']}")
    return {"text": text, "end": True, "context": {"member_name": member["name"]}}


def compute_penalty(context: dict, data: dict) -> dict:
    """penalty = amount x rate x days, capped at penaltyCapRatio x amount, rounded to the FCFA."""
    rules = data["rules"]
    amount, days = float(context["amount"]), int(context["days"])
    raw = amount * rules["penaltyRatePerDay"] * days
    cap = amount * rules["penaltyCapRatio"]
    penalty = round(min(raw, cap))
    capped = " (cap)" if raw > cap else ""
    text = (f"Contribution: {_fcfa(amount)}\n"
            f"Late: {days} d x {rules['penaltyRatePerDay'] * 100:g}%/d\n"
            f"Penalty: {_fcfa(penalty)}{capped}\n"
            f"Total due: {_fcfa(amount + penalty)}\n"
            f"{rules['article']}: pay before the next meeting.")
    return {"text": text, "end": True, "context": {"penalty": penalty}}


def relief_summary(context: dict, data: dict) -> dict:
    relief, group = data["relief"], data["group"]
    caps = relief["caps"]
    text = (f"Relief fund: {_fcfa(relief['balance'])}\n"
            f"Up to date: {relief['upToDate']}/{group['members']} members\n"
            f"Max aid: illness {caps['illness'] // 1000}k, death {caps['death'] // 1000}k, "
            f"birth {caps['birth'] // 1000}k")
    return {"text": text, "end": False}


def check_relief_eligibility(context: dict, data: dict) -> dict:
    code, member = _member(context, data)
    if member is None:
        return {"text": f"Member {code} not found.", "end": True}
    relief = data["relief"]
    reasons = []
    if member["status"] != "UP TO DATE":
        reasons.append("late contributions")
    if member["seniorityMonths"] < relief["minSeniorityMonths"]:
        reasons.append(f"seniority {member['seniorityMonths']} months (min {relief['minSeniorityMonths']})")
    verdict = "ELIGIBLE" if not reasons else "NOT ELIGIBLE: " + ", ".join(reasons)
    return {"text": f"{code} {member['name']}\nEmergency aid: {verdict}", "end": True}


def _fingerprint(code: str, receipt: dict, secret: str) -> str:
    """Control fingerprint printed on paper/SMS receipts: first 8 hex chars of SHA-256."""
    payload = f"{code}|{receipt['member']}|{receipt['amount']}|{receipt['date']}|{secret}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8].upper()


def verify_receipt(context: dict, data: dict) -> dict:
    code = str(context.get("receipt_code", "")).upper()
    receipt = data["receipts"].get(code)
    if receipt is None:
        return {"text": f"Receipt {code}: UNKNOWN.\nDo not accept this receipt.", "end": True}
    valid = hmac.compare_digest(_fingerprint(code, receipt, data["receiptSecret"]), receipt["fingerprint"])
    member = data["members"].get(receipt["member"], {}).get("name", receipt["member"])
    status = "VALID" if valid else "TAMPERED (bad fingerprint)"
    text = (f"Receipt {code}\n"
            f"Member: {receipt['member']} {member}\n"
            f"Amount: {_fcfa(receipt['amount'])} on {receipt['date']}\n"
            f"Status: {status}")
    return {"text": text, "end": True, "context": {"receipt_valid": valid}}
