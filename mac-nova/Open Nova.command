#!/bin/bash
# RideBy Nova — Mac launcher (double-click)
cd "$(dirname "$0")"
NOVA_URL="https://rideby-ai.vercel.app/nova"

open_app_window() {
  local app="$1"
  open -na "$app" --args --app="$NOVA_URL" 2>/dev/null
}

if open_app_window "Google Chrome"; then
  exit 0
fi
if open_app_window "Chromium"; then
  exit 0
fi
if open_app_window "Microsoft Edge"; then
  exit 0
fi

open -a Safari "$NOVA_URL"
