# Requirements: USSD Gateway

## Introduction
The gateway is the telecom half of the skeleton: a session state machine speaking the
`CON`/`END` protocol, a GSM-7 compressor that guarantees 160-character frames, and a
webhook adapter compatible with Africa's Talking and with the web simulator.

## Requirement 1: Protocol framing
**User story:** As a telecom gateway, I want strictly valid USSD frames, so that no operator drops a session.

### Acceptance criteria
1. THE SYSTEM SHALL prefix every response with `CON ` or `END `.
2. THE SYSTEM SHALL never emit a frame longer than 160 characters, prefix and footer included.
3. THE SYSTEM SHALL only emit GSM-7 basic-alphabet characters (printable ASCII except `` ` [ ] { } \ ^ ~ | ``, plus newline).
4. WHEN text contains accents, ligatures, typographic quotes, dashes, the euro sign or emojis THE SYSTEM SHALL transliterate or drop them.

## Requirement 2: Compression and pagination
**User story:** As a user on 2G, I want long answers to stay readable, so that I never get a truncated sentence.

### Acceptance criteria
1. WHEN content fits the 156-character body budget THE SYSTEM SHALL send it unchanged (mode `direct`).
2. WHEN content is too long AND the node enables `useAiCompression` AND an LLM key is configured THE SYSTEM SHALL request a telegraphic rewrite with a hard 1.8 s timeout (mode `ai`).
3. IF the LLM times out, errors, is not configured, or returns over-budget or non-GSM-7 text THEN THE SYSTEM SHALL apply the deterministic fallback: manifest abbreviations then word-boundary pagination (mode `deterministic_fallback`).
4. WHEN the assembled body exceeds 156 characters THE SYSTEM SHALL split it on line or word boundaries and end every non-final page with `nextPageLabel`.
5. THE SYSTEM SHALL report telemetry for every frame: `raw_length`, `compressed_length`, `page_count`, `mode`, `fallback_reason`, `latency_ms`, `gsm7_valid`.

## Requirement 3: Session state machine
**User story:** As a user, I want to navigate menus like on any operator USSD, so that the service feels native.

### Acceptance criteria
1. WHEN a session starts with empty text THE SYSTEM SHALL reset the stack and render `entryNode`.
2. WHEN the user sends `nextPageKey` and pages remain THE SYSTEM SHALL show the next stored page without recomputing it.
3. WHEN the user sends `backKey` THE SYSTEM SHALL pop the navigation stack and render the parent node.
4. WHEN the user sends `homeKey` THE SYSTEM SHALL clear the stack and render `entryNode`.
5. WHEN the input is invalid for the current node THE SYSTEM SHALL keep the session on that node and prepend `invalidMessage` (or the node `errorMessage`).
6. IF the last activity is older than `sessionTimeoutSec` THEN THE SYSTEM SHALL answer `END` + `expiredMessage` and delete the session.
7. WHEN an `END` frame is sent THE SYSTEM SHALL delete the session.
8. THE SYSTEM SHALL persist sessions in SQLite (`ussd_sessions` table).

## Requirement 4: Cumulative and step inputs
**User story:** As an integrator, I want Africa's Talking cumulative text (`1*2*1`) and simulator step input to behave identically.

### Acceptance criteria
1. WHEN `input_mode` is `cumulative` AND text extends the previous text by `*segment` THE SYSTEM SHALL process only the new segments.
2. WHEN `input_mode` is `cumulative` AND text does not extend the previous text THE SYSTEM SHALL restart the session and replay every segment.
3. WHEN `input_mode` is `step` THE SYSTEM SHALL process the given text as new segments.
4. WHEN a new session receives non-empty text THE SYSTEM SHALL replay its segments from `entryNode` (dial shortcuts such as `1*1*1`).
5. WHEN a replayed segment reaches an end node THE SYSTEM SHALL stop processing the remaining segments.

## Requirement 5: Webhook adapter
**User story:** As a telecom operator, I want a standard webhook, and as a judge I want rich JSON.

### Acceptance criteria
1. WHEN `POST /ussd` receives `application/x-www-form-urlencoded` (`sessionId`, `serviceCode`, `phoneNumber`, `text`) THE SYSTEM SHALL answer `text/plain` with the raw frame.
2. WHEN `POST /ussd` receives `application/json` THE SYSTEM SHALL answer the frame plus `prefix`, `body`, `char_count`, `max_chars`, `gsm7_valid`, `page_index`, `total_pages`, `current_node`, `stack`, `context` and `telemetry`.
3. IF the service code or app id is unknown THEN THE SYSTEM SHALL answer `END` with a neutral message (plain text) or HTTP 404 (JSON).
4. IF the payload fails validation (missing session id, oversized text) THEN THE SYSTEM SHALL answer HTTP 400 (form) or 422 (JSON) without touching the session store.
5. THE SYSTEM SHALL expose `GET /api/health`, `GET /api/apps` and `GET /api/metrics`.
