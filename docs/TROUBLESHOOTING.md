# Troubleshooting

## App not in launcher / no tile on home screen {#app-not-in-launcher}

**Symptom:** The app installs and launches via CLI, appears in Settings → Applications → Manage Installed Applications, but has no tile in the app grid and no Launch option.

**Root cause:** Missing `[package].icon` in `manifest.toml`. The Vega launcher needs an icon asset to render the tile. Without it, the app is effectively invisible in the grid.

**Fix:**
1. Create a 512×512 PNG (≤1 MB) at `app/assets/image/icon.png`.
2. Add `icon = "@image/icon.png"` to `[package]` in `manifest.toml`.
3. Bump `build_number`, rebuild, revalidate, redeploy.
4. **Reboot the Fire Stick** — the launcher caches tiles; reboot forces re-enumeration.

`com.amazon.category.main` is already the correct category (do NOT add `com.amazon.category.launcher` — it's system-reserved and fails validation).

**If it still won't pin:** Vega OS deliberately degrades devmode-sideloaded apps. The escalation is Appstore submission — the vendor record ("Seth Kellner Photography", `M3LH42DOKX7GYG`) is already active, so submission is unblocked.

## Alexa: "not supported on this device"

Alexa resolves app launches through the launcher's app registry. An icon-less, tile-less app can't be resolved by name. Fix the launcher visibility first (above), then retry "Alexa, open Mission Control".

Note: Alexa voice-launch for sideloaded (devmode) apps may never fully work — that's an Amazon restriction, not a bug. Appstore-published apps get full Alexa support.

## App shows stale / old content after redeploy {#stale-js-bundle}

**Symptom:** You changed `src/App.tsx` (e.g. the WebView URL), rebuilt, redeployed — but the TV still shows the old page.

**Root cause:** `vega build` doesn't always rebuild the JS bundle from `src/`. The bundle at `build/lib/rn-bundles/Release/index.bundle` can be stale.

**Diagnosis:**
```bash
grep -o "mission-control[^\"]*" build/lib/rn-bundles/Release/index.bundle | head -3
# If this shows the OLD URL, the bundle is stale
```

**Fix options:**
1. Force a JS rebuild (find the right invocation for your setup), **or**
2. Patch the bundle directly with a Python byte-replacement (pad the replacement to the same length with null bytes to avoid breaking offsets), then `vega build` to repackage, **or**
3. **Simplest when only the URL changed:** make the old URL serve the new content (e.g. we replaced `mission-control/index.html` with the TV layout so both `/` and `/tv.html` serve it). No rebuild needed at all.

Also: uninstall before reinstall to clear the WebView cache:
```bash
vega device uninstall-app --device 127.0.0.1:15555 \
  --appName com.kellner.missioncontrol.main
```

## WebView caching

The WebView caches aggressively. If the dashboard was updated on GitHub Pages but the TV shows old content:
- Relaunch the app (fresh WebView instance).
- Or uninstall/reinstall (clears the cache entirely).
- The dashboard itself fetches `status.json` with `cache: 'no-store'` to avoid stale data.

## "Unable to detect remote" on the TV

That's the Fire Stick losing track of its physical Bluetooth remote — common after reboots, unrelated to our app. Hold the **Home button** ~10 seconds to re-pair. If that fails, pop the batteries out and back in.

## Port 5555 closed / `vda connect` refused

- **Before devmode:** port 5555 is closed by design. Enable devmode first ([DEVMODE.md](DEVMODE.md)).
- **After devmode:** check **Developer Options → connection mode**. If it's **USB**, the stick only listens over USB. Switch to **Network** for wireless ADB.
- **Tunnel down:** if deploying from the sandboxed VM, the socat tunnel (`:15555 → 10.0.0.151:5555` via proxy) must be running. See [DEPLOYMENT.md](DEPLOYMENT.md).

## `vega devmode login` fails

See [AUTHENTICATION.md](AUTHENTICATION.md). Common causes:

| Error | Fix |
|---|---|
| `failed to save access token data` | Secret Service shim not running, or `DBUS_SESSION_BUS_ADDRESS` not exported |
| `{"error":"invalid_token"}` (401) | No vendor record — complete the Developer Console registration |
| `exec: "dbus-launch": executable file not found` | No D-Bus session bus — start `dbus-daemon` first |
| `The name org.freedesktop.secrets was not provided` | Bus exists but no Secret Service — start the shim |

## Build produces a ~4.7 KB .vpkg

That's a **manifest-only** package — the JS bundle wasn't included. Don't deploy it. Check the build logs for JS bundle errors, verify `build/lib/rn-bundles/Release/index.bundle` exists and is non-trivial, then rebuild.

## `vpt validate` errors

- `build_number` must be > 0. Bump it every build.
- Icon must exist at the declared path and be ≤1 MB.
- Package ID must not start with `com.amazon` (reserved).

## Fire Stick can't reach the dashboard URL

The WebView loads `https://kellner-dot.github.io/...` — the stick needs internet access. If the dashboard shows a blank/error page, check the stick's Wi-Fi. The URL must be HTTPS (or set `mixedContentMode` appropriately).
