#!/usr/bin/env bash
# Deploy the Mission Control .vpkg to the Fire TV Stick 4K Select.
# Requires: stick in devmode, ADB port 5555 reachable (via tailnet — see docs/TAILNET-SETUP.md)
set -euo pipefail

STICK_IP="${STICK_IP:-10.0.0.151}"
STICK_PORT="${STICK_PORT:-5555}"
VPKG="${1:-}"

if [[ -z "$VPKG" ]]; then
  echo "Usage: $0 <path-to-.vpkg>"
  echo "  Env: STICK_IP (default 10.0.0.151), STICK_PORT (default 5555)"
  exit 1
fi

if [[ ! -f "$VPKG" ]]; then
  echo "ERROR: package not found: $VPKG"
  exit 1
fi

# Sanity check: reject the known-empty 4.7 KB manifest-only package
SIZE=$(stat -c%s "$VPKG")
if [[ "$SIZE" -lt 100000 ]]; then
  echo "WARNING: package is only $SIZE bytes — likely the empty manifest-only build."
  echo "Rebuild with: npx react-native build-vega"
  read -rp "Continue anyway? [y/N] " ans
  [[ "$ans" == "y" ]] || exit 1
fi

echo "Validating package..."
vega exec vpt validate "$VPKG"

echo "Connecting to $STICK_IP:$STICK_PORT..."
adb connect "$STICK_IP:$STICK_PORT"

echo "Installing $VPKG..."
vega install "$VPKG" --device "$STICK_IP:$STICK_PORT"

echo "Done. Launch from the stick's app list (sideloaded apps get a generic icon)."
