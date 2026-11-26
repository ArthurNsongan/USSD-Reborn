"""Webhook parity: Africa's Talking form-urlencoded vs simulator JSON, plus API endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

FORM = {"content-type": "application/x-www-form-urlencoded"}


def _form(client: TestClient, session: str, code: str, text: str):
    data = {"sessionId": session, "serviceCode": code, "phoneNumber": "+237690000000", "text": text,
            "networkCode": "62401"}
    return client.post("/ussd", data=data, headers=FORM)


def _json(client: TestClient, session: str, text: str, **extra):
    payload = {"session_id": session, "service_code": "*384*4#", "phone_number": "+237690000000", "text": text}
    return client.post("/ussd", json={**payload, **extra})


def test_africas_talking_form_returns_plain_text_frame(client: TestClient) -> None:
    reply = _form(client, "AT-1", "*384*1#", "")
    assert reply.status_code == 200
    assert reply.headers["content-type"].startswith("text/plain")
    assert reply.text.startswith("CON NightRx 24/7") and len(reply.text) <= 160


def test_africas_talking_cumulative_session(client: TestClient) -> None:
    for text in ("", "1", "1*1"):
        assert _form(client, "AT-2", "*384*3#", text).text.startswith("CON")
    final = _form(client, "AT-2", "*384*3#", "1*1*1")
    assert final.text.startswith("END Plantain - Douala Sandaga")


def test_json_returns_rich_frame(client: TestClient) -> None:
    body = _json(client, "J-1", "2*25000*5").json()
    assert body["prefix"] == "END" and body["raw_response"] == "END " + body["body"]
    assert body["char_count"] == len(body["raw_response"]) <= body["max_chars"] == 160
    assert body["gsm7_valid"] is True and body["current_node"] == "penalty_result"
    assert body["context"]["penalty"] == 2500
    assert {"mode", "latency_ms", "page_count", "gsm7_valid"} <= set(body["telemetry"])


def test_form_and_json_are_byte_identical(client: TestClient) -> None:
    for text in ("", "3", "4*QT-2026-841", "2*25000*40"):
        form = _form(client, f"F-{text}", "*384*4#", text).text
        as_json = _json(client, f"J-{text}", text).json()["raw_response"]
        assert form == as_json


def test_json_step_mode_and_app_id(client: TestClient) -> None:
    payload = {"session_id": "S-1", "app_id": "agripulse", "text": ""}
    client.post("/ussd", json={**payload, "input_mode": "step"})
    frame = client.post("/ussd", json={**payload, "text": "3", "input_mode": "step"}).json()
    assert frame["current_node"] == "weather_zone" and frame["app_id"] == "agripulse"


def test_callback_query_selects_app_for_gateway_assigned_code(client: TestClient) -> None:
    data = {"sessionId": "SB-1", "serviceCode": "*384*55021#", "phoneNumber": "+237690000000", "text": "1*M03"}
    reply = client.post("/ussd?app=tontine-check", data=data, headers=FORM)
    assert reply.text.startswith("END M03 Mbarga Aline")


def test_unknown_service_code(client: TestClient) -> None:
    assert _form(client, "U-1", "*000#", "").text == "END Unknown service code."
    assert client.post("/ussd", json={"session_id": "U-2", "service_code": "*000#"}).status_code == 404


@pytest.mark.parametrize("payload", [{"text": ""}, {"session_id": "", "app_id": "agripulse"},
                                     {"session_id": "x", "app_id": "agripulse", "text": "1" * 501},
                                     {"session_id": "x", "app_id": "agripulse", "input_mode": "turbo"}])
def test_json_validation_errors(client: TestClient, payload: dict) -> None:
    assert client.post("/ussd", json=payload).status_code == 422


def test_malformed_json_is_rejected(client: TestClient) -> None:
    reply = client.post("/ussd", content=b"{not json", headers={"content-type": "application/json"})
    assert reply.status_code == 422


def test_form_without_session_id_is_rejected(client: TestClient) -> None:
    reply = client.post("/ussd", data={"serviceCode": "*384*1#", "text": ""}, headers=FORM)
    assert reply.status_code == 400 and reply.text == "END Invalid request."


def test_api_apps_exposes_themes_and_graph(client: TestClient) -> None:
    apps = client.get("/api/apps").json()
    assert sorted(a["shortcode"] for a in apps) == ["*384*1#", "*384*2#", "*384*3#", "*384*4#"]
    assert len({a["theme"]["screenText"] for a in apps}) == 4
    assert all(a["nodes"][a["entryNode"]]["type"] == "menu" and a["quickPresets"] for a in apps)


def test_health_and_metrics(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok", "apps": 4}
    _form(client, "M-1", "*384*1#", "")
    metrics = client.get("/api/metrics").json()
    assert metrics["apps_loaded"] == 4 and metrics["active_sessions"] >= 1 and metrics["core_loc"] == 1
