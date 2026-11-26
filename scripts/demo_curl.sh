#!/usr/bin/env bash
# Replays USSD sessions across all 4 apps in Africa's Talking format (form-urlencoded, cumulative text).
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

echo "=== SIM 1: NightRx 24/7 (*384*1#) — Counterfeit medicine seal check ==="
ussd "ATUid_rx_$RANDOM" '*384*1#' '3*RX-2026-860'

echo "=== SIM 2: Bite2G Delivery (*384*2#) — Order 2x Poulet DG with Rider PIN ==="
ussd "ATUid_bite_$RANDOM" '*384*2#' '1*1*1*2*Akwa Total Gate'

echo "=== SIM 3: AgriPulse (*384*3#) — Plantain price at Douala Sandaga ==="
ussd "ATUid_agri_$RANDOM" '*384*3#' '1*1*1'

echo "=== SIM 4: Tontine-Check (*384*4#) — Late penalty 25 000 FCFA, 5 days ==="
ussd "ATUid_tontine_$RANDOM" '*384*4#' '2*25000*5'
