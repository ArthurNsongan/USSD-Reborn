#!/usr/bin/env bash
# Replays USSD sessions exactly as Africa's Talking would send them (form-urlencoded, cumulative text).
# Usage: BASE_URL=http://127.0.0.1:8000 bash scripts/demo_curl.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
PHONE="+237690000000"

ussd() { # ussd <sessionId> <serviceCode> <text>
  printf '\n> serviceCode=%s text="%s"\n' "$2" "$3"
  curl -sS -X POST "$BASE_URL/ussd" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "sessionId=$1" \
    --data-urlencode "serviceCode=$2" \
    --data-urlencode "phoneNumber=$PHONE" \
    --data-urlencode "text=$3"
  printf '\n'
}

echo "=== AgriPulse *384*1#: plantain price at Douala Sandaga ==="
SID="ATUid_demo_agri_$RANDOM"
ussd "$SID" '*384*1#' ''
ussd "$SID" '*384*1#' '1'
ussd "$SID" '*384*1#' '1*1'
ussd "$SID" '*384*1#' '1*1*1'

echo "=== AgriPulse *384*1#: cocoa diagnosis with 99 pagination ==="
SID="ATUid_demo_cocoa_$RANDOM"
ussd "$SID" '*384*1#' '2*1'
ussd "$SID" '*384*1#' '2*1*99'

echo "=== Tontine-Check *384*2#: late penalty 25 000 FCFA, 5 days ==="
SID="ATUid_demo_tontine_$RANDOM"
ussd "$SID" '*384*2#' ''
ussd "$SID" '*384*2#' '2'
ussd "$SID" '*384*2#' '2*25000'
ussd "$SID" '*384*2#' '2*25000*5'

echo "=== Tontine-Check *384*2#: tampered receipt ==="
ussd "ATUid_demo_receipt_$RANDOM" '*384*2#' '4*QT-2026-860'

echo "=== Unknown service code ==="
ussd "ATUid_demo_unknown_$RANDOM" '*000#' ''
