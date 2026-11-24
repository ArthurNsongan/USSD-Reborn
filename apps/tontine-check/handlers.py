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
        return {"text": f"Membre {code} inconnu dans {data['group']['name']}.", "end": True}
    group = data["group"]
    pot = group["contribution"] * group["members"]
    when = f"recu le {member['turnDate']}" if member["received"] else f"le {member['turnDate']}"
    text = (f"{code} {member['name']}\n"
            f"Tour {member['rank']}/{group['members']} {when}\n"
            f"Cagnotte: {_fcfa(pot)}\n"
            f"Cotisation: {member['status']}")
    return {"text": text, "end": True, "context": {"member_name": member["name"]}}


def compute_penalty(context: dict, data: dict) -> dict:
    """penalty = amount x rate x days, capped at penaltyCapRatio x amount, rounded to the FCFA."""
    rules = data["rules"]
    amount, days = float(context["amount"]), int(context["days"])
    raw = amount * rules["penaltyRatePerDay"] * days
    cap = amount * rules["penaltyCapRatio"]
    penalty = round(min(raw, cap))
    capped = " (plafond)" if raw > cap else ""
    text = (f"Cotisation: {_fcfa(amount)}\n"
            f"Retard: {days} j x {rules['penaltyRatePerDay'] * 100:g}%/j\n"
            f"Penalite: {_fcfa(penalty)}{capped}\n"
            f"Total a verser: {_fcfa(amount + penalty)}\n"
            f"{rules['article']}: regler avant la prochaine seance.")
    return {"text": text, "end": True, "context": {"penalty": penalty}}


def relief_summary(context: dict, data: dict) -> dict:
    relief, group = data["relief"], data["group"]
    caps = relief["caps"]
    text = (f"Caisse de secours: {_fcfa(relief['balance'])}\n"
            f"A jour: {relief['upToDate']}/{group['members']} membres\n"
            f"Aide max: maladie {caps['maladie'] // 1000}k, deces {caps['deces'] // 1000}k, "
            f"naissance {caps['naissance'] // 1000}k")
    return {"text": text, "end": False}


def check_relief_eligibility(context: dict, data: dict) -> dict:
    code, member = _member(context, data)
    if member is None:
        return {"text": f"Membre {code} inconnu.", "end": True}
    relief = data["relief"]
    reasons = []
    if member["status"] != "A JOUR":
        reasons.append("cotisations en retard")
    if member["seniorityMonths"] < relief["minSeniorityMonths"]:
        reasons.append(f"anciennete {member['seniorityMonths']} mois (min {relief['minSeniorityMonths']})")
    verdict = "ELIGIBLE" if not reasons else "NON ELIGIBLE: " + ", ".join(reasons)
    return {"text": f"{code} {member['name']}\nAide d'urgence: {verdict}", "end": True}


def _fingerprint(code: str, receipt: dict, secret: str) -> str:
    """Control fingerprint printed on paper/SMS receipts: first 8 hex chars of SHA-256."""
    payload = f"{code}|{receipt['member']}|{receipt['amount']}|{receipt['date']}|{secret}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8].upper()


def verify_receipt(context: dict, data: dict) -> dict:
    code = str(context.get("receipt_code", "")).upper()
    receipt = data["receipts"].get(code)
    if receipt is None:
        return {"text": f"Quittance {code}: INCONNUE.\nNe pas accepter ce recu.", "end": True}
    valid = hmac.compare_digest(_fingerprint(code, receipt, data["receiptSecret"]), receipt["fingerprint"])
    member = data["members"].get(receipt["member"], {}).get("name", receipt["member"])
    status = "VALIDE" if valid else "ALTEREE (empreinte fausse)"
    text = (f"Quittance {code}\n"
            f"Membre: {receipt['member']} {member}\n"
            f"Montant: {_fcfa(receipt['amount'])} le {receipt['date']}\n"
            f"Statut: {status}")
    return {"text": text, "end": True, "context": {"receipt_valid": valid}}
