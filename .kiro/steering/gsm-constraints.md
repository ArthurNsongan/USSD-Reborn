---
inclusion: always
---

# GSM / USSD invariants (never break these)

1. Every USSD frame starts with exactly `CON ` (session continues) or `END ` (session closes).
2. A full frame, prefix and pagination footer included, is at most **160 characters**.
   - Body budget: `160 - len("CON ")` = 156 characters.
   - Intermediate pages end with `\n99. Suite`, so their body budget is 146 characters.
3. Only GSM-7 basic-alphabet characters are emitted (one septet each):
   printable ASCII minus `` ` `` and the extension characters `[ ] { } \ ^ ~ |`, plus `\n`.
   - Transliterate accents (`e`-acute to `e`, `a`-grave to `a`, `c`-cedilla to `c`, `oe` ligature to `oe`).
   - Replace typographic characters (curly quotes to `'`, dashes to `-`, euro sign to `EUR`).
   - Drop emojis and anything else outside the alphabet.
4. Reserved navigation keys on every screen: `0` back, `00` home, `99` next page.
5. The optional LLM compressor has a hard **1.8 s** timeout. On timeout, network error,
   missing key, or an over-budget / non-GSM-7 answer, the deterministic local fallback
   (manifest abbreviations, then word-boundary pagination) is used immediately.
6. Sessions expire after `sessionTimeoutSec` (180 s by default) with an `END` frame.
7. Invalid input never crashes a session: the current screen is re-rendered with a short
   error line (manifest `invalidMessage`).

Any change touching `core/gsm_compressor.py` or `core/session_engine.py` must keep
`tests/test_gsm_constraints.py` green.
