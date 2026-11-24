"""Typed view of the skeleton contract and of the frames the gateway emits."""
from typing import Any, Literal

from pydantic import BaseModel, Field

MAX_FRAME_CHARS = 160


class Navigation(BaseModel):
    backKey: str = "0"
    homeKey: str = "00"
    nextPageKey: str = "99"
    sessionTimeoutSec: int = 180
    nextPageLabel: str = "99. More"
    backLabel: str = "0. Back"
    invalidMessage: str = "Invalid choice."
    expiredMessage: str = "Session expired. Dial again."
    errorMessage: str = "Service unavailable. Try later."


class MenuOption(BaseModel):
    key: str
    label: str
    next: str
    set: dict[str, Any] = Field(default_factory=dict)


class Validation(BaseModel):
    kind: Literal["numeric", "text", "code"] = "text"
    pattern: str | None = None
    min: float | None = None
    max: float | None = None


class NodeSpec(BaseModel):
    type: Literal["menu", "input", "action", "static"]
    title: str = ""
    text: str = ""
    prompt: str = ""
    options: list[MenuOption] = Field(default_factory=list)
    validation: Validation = Field(default_factory=Validation)
    saveAs: str | None = None
    next: str | None = None
    errorMessage: str | None = None
    example: str | None = None
    handler: str | None = None
    useAiCompression: bool = False
    end: bool = False


class AppManifest(BaseModel):
    """Theme and presets are opaque to the engine; their shape is enforced by the JSON Schema."""
    id: str
    name: str
    tagline: str
    shortcode: str
    version: str
    locale: str
    entryNode: str
    theme: dict[str, str]
    navigation: Navigation = Field(default_factory=Navigation)
    compression: dict[str, dict[str, str]] = Field(default_factory=dict)
    quickPresets: list[dict[str, str]] = Field(default_factory=list)
    nodes: dict[str, NodeSpec]


class UssdRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    service_code: str = Field(default="", max_length=32)
    app_id: str | None = Field(default=None, max_length=40)
    phone_number: str = Field(default="", max_length=32)
    text: str = Field(default="", max_length=500)
    input_mode: Literal["cumulative", "step"] = "cumulative"


class UssdFrame(BaseModel):
    """telemetry: raw_length, compressed_length, mode, fallback_reason, latency_ms, page_count, gsm7_valid."""
    app_id: str
    session_id: str
    prefix: Literal["CON", "END"]
    body: str
    raw_response: str
    char_count: int
    max_chars: int = MAX_FRAME_CHARS
    gsm7_valid: bool
    page_index: int
    total_pages: int
    current_node: str
    stack: list[str]
    context: dict[str, Any]
    telemetry: dict[str, Any]
