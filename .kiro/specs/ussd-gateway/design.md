# Design: USSD Gateway

## Components
| File | Responsibility |
| --- | --- |
| `core/webhook_adapter.py` | FastAPI factory `create_app()`, content-type detection, form/JSON parity. |
| `core/session_engine.py` | `SessionStore` (SQLite) and `SessionEngine` (state machine + rendering). |
| `core/gsm_compressor.py` | `to_gsm7`, `is_gsm7`, `paginate`, async `compress` with optional LLM. |
| `main.py` | Composition root: registry, store, engine, purity audit, static frontend. |

## Request sequence (Africa's Talking)
```mermaid
sequenceDiagram
    participant AT as Africa's Talking
    participant W as webhook_adapter
    participant E as SessionEngine
    participant S as SQLite
    participant C as gsm_compressor
    participant H as app handler
    AT->>W: POST /ussd (form) sessionId, serviceCode, text="1*2"
    W->>W: UssdRequest validation, registry.resolve(serviceCode)
    W->>E: handle(app, sid, phone, "1*2", cumulative)
    E->>S: load(sid)
    E->>E: diff with last_text -> new segments ["2"]
    E->>E: step(): option / input / back / home / next page
    E->>H: handler(context, data) (action nodes only)
    E->>C: compress(content, budget, use_ai)
    C-->>E: text, mode, fallback_reason, latency
    E->>C: paginate(assembled body)
    E->>S: save(state) or delete(sid) on END
    E-->>W: UssdFrame
    W-->>AT: text/plain "CON ..." (<= 160 chars)
```

## Session state machine
```mermaid
stateDiagram-v2
    [*] --> Entry: text == "" or new session
    Entry --> Node: option key / valid input
    Node --> Node: invalid input (notice)
    Node --> Parent: backKey (pop)
    Node --> Entry: homeKey (clear stack)
    Node --> NextPage: nextPageKey and pages remain
    NextPage --> Node
    Node --> Ended: end node rendered (last page)
    Node --> Expired: idle > sessionTimeoutSec
    Ended --> [*]
    Expired --> [*]
```

## SQLite model
```sql
CREATE TABLE IF NOT EXISTS ussd_sessions (
  session_id TEXT PRIMARY KEY,
  app_id     TEXT NOT NULL,
  state_json TEXT NOT NULL,   -- node, stack, context, pages, page_index, last_text, telemetry, end
  updated_at REAL NOT NULL
);
```
A single JSON column keeps the core small while remaining inspectable with any SQLite tool.

## Compressor pipeline
```mermaid
flowchart LR
    T[content] --> G[to_gsm7]
    G --> F{len <= budget?}
    F -- yes --> D[direct]
    F -- no --> A{useAi and key?}
    A -- yes --> L[LLM 1.8 s timeout]
    L --> K{GSM-7 and <= budget?}
    K -- yes --> AI[ai]
    K -- no --> X[abbreviations]
    A -- no --> X
    X --> FB[deterministic_fallback]
    D & AI & FB --> P[assemble + paginate]
```
- Budget for content = `156 - len(options + footer)`, at least 40.
- `paginate` splits at the last newline in the page window if it is past half the page,
  otherwise at the last space, otherwise hard-cuts.
- LLM providers use the OpenAI-compatible `/chat/completions` endpoint; presets for
  `openai`, `groq` and `gemini`, or any `LLM_BASE_URL`.

## Testing strategy
- `tests/test_gsm_constraints.py`: transliteration, pagination of 50 to 1200 characters, LLM timeout and over-budget fallback (monkeypatched).
- `tests/test_session_engine.py`: navigation keys, replay, invalid input, expiry with an injected clock, persistence across engine instances.
- `tests/test_webhook_adapter.py`: form vs JSON parity, unknown service code, validation errors.
