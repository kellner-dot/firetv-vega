#!/usr/bin/env bash
# Helper: walk through Vega devmode enablement for the Fire TV Stick 4K Select.
# The TV developer code expires ~5 minutes after appearing — move fast.
set -euo pipefail

echo "=== Vega devmode helper ==="
echo
echo "1. On the stick: Settings -> About -> tap the device name 7 times."
echo "   (Developer options are already enabled on this stick — skip if done.)"
echo
echo "2. Logging in via phone OAuth..."
vega devmode login

echo
read -rp "3. Enter the developer code shown on the TV screen: " CODE
if [[ -z "$CODE" ]]; then
  echo "ERROR: no code entered."
  exit 1
fi

echo "Enabling device (TV will reboot — this is normal)..."
vega devmode enable-device --code "$CODE"

echo
echo "Done. After the reboot, ADB port 5555 should be open on 10.0.0.151"
echo "(reachable via tailnet — see docs/TAILNET-SETUP.md)."
