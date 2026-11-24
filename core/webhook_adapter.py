"""FastAPI surface: one /ussd endpoint for telecom gateways (form) and the simulator (JSON)."""
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from core.manifest_loader import AppRegistry
from core.models import UssdRequest
from core.session_engine import SessionEngine


async def _parse(request: Request, as_json: bool) -> UssdRequest:
    if as_json:
        return UssdRequest.model_validate(await request.json())
    body = parse_qs((await request.body()).decode("utf-8", "replace"), keep_blank_values=True)
    form = {key: values[0] for key, values in body.items()}  # Africa's Talking field names
    return UssdRequest(session_id=form.get("sessionId", ""), service_code=form.get("serviceCode", ""),
                       phone_number=form.get("phoneNumber", ""), text=form.get("text", ""))


def create_app(registry: AppRegistry, engine: SessionEngine, audit: Callable[[], dict] | None = None,
               static_dir: Path | None = None, cors_origins: list[str] | None = None) -> FastAPI:
    api = FastAPI(title="USSD-Reborn GhostSignal", version="1.0.0")
    origins = cors_origins or []
    api.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])

    @api.post("/ussd")
    async def ussd(request: Request) -> Any:
        as_json = "application/json" in request.headers.get("content-type", "")
        try:
            payload = await _parse(request, as_json)
        except (ValidationError, ValueError) as exc:  # JSONDecodeError is a ValueError
            detail = exc.errors(include_url=False) if isinstance(exc, ValidationError) else str(exc)
            return JSONResponse({"detail": detail}, 422) if as_json else PlainTextResponse("END Invalid request.", 400)
        app = registry.resolve(payload.app_id or payload.service_code)
        if app is None:
            return JSONResponse({"detail": "Unknown service code"}, 404) if as_json else \
                PlainTextResponse("END Unknown service code.")
        frame = await engine.handle(app, payload.session_id, payload.phone_number, payload.text, payload.input_mode)
        return JSONResponse(frame.model_dump()) if as_json else PlainTextResponse(frame.raw_response)

    @api.get("/api/apps")
    def list_apps() -> list[dict[str, Any]]:
        return [a.manifest.model_dump() for a in registry.apps.values()]

    @api.get("/api/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "apps": len(registry.apps)}

    @api.get("/api/metrics")
    def metrics() -> dict[str, Any]:
        live = {"apps_loaded": len(registry.apps), "active_sessions": engine.store.count_active(time.time() - 180)}
        return {**(audit() if audit else {}), **live}

    if static_dir and Path(static_dir).is_dir():
        api.mount("/", StaticFiles(directory=static_dir, html=True), name="simulator")
    return api
