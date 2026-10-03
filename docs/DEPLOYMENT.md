# Deploying to the Fire Stick

## The network problem

The build machine (a sandboxed VM) cannot make raw TCP connections to the Fire Stick at `10.0.0.151:5555` — direct connections return "Operation not permitted". It *can* reach the stick through the HTTP egress proxy (`hatch-egress-proxy:3130`), but ADB/VDA needs raw TCP, not HTTP.

**Solution: socat TCP tunnel.** Forward a local port through the proxy to the stick's ADB port:

```bash
# Start the tunnel (background, keep running)
socat TCP-LISTEN:15555,fork,reuseaddr \
  PROXY:hatch-egress-proxy:10.0.0.151:5555,proxyport=3130 &
```

This uses the proxy's HTTP CONNECT method to tunnel raw TCP. Then point VDA at the local port:

```bash
VDA="$(vega which vda)"
$VDA connect 127.0.0.1:15555
# → connected to 127.0.0.1:15555
```

## Full deploy cycle

```bash
# 0. Auth: every vega command needs the D-Bus Secret Service for token reads
export DBUS_SESSION_BUS_ADDRESS="unix:path=/tmp/dbus-vega-persistent"
export PATH="/home/hatch/vega/bin:$PATH"
export HOME=/home/hatch

# 1. Ensure the tunnel is up (see above)
# 2. Connect
"$(vega which vda)" connect 127.0.0.1:15555

# 3. Verify the device is visible
vega device list
# → Found the following device:
#   127.0.0.1:15555 : A1TGF7GBNNZ9EE

# 4. Install + launch (one step)
vega run-app /path/to/missioncontrol_armv7.vpkg --deviceId 127.0.0.1:15555
# → Installed ... on 127.0.0.1:15555
# → Successfully launched the app
```

The device serial (`A1TGF7GBNNZ9EE`) is the stick's identifier; `--deviceId 127.0.0.1:15555` selects it.

## Individual device commands

```bash
# Install without launching
vega device install-app --device 127.0.0.1:15555 \
  --packagePath /path/to/app.vpkg

# Launch an installed app
vega device launch-app --device 127.0.0.1:15555 \
  --appName com.kellner.missioncontrol.main

# Check if running
vega device is-app-running --device 127.0.0.1:15555 \
  --appName com.kellner.missioncontrol.main

# List installed apps / packages
vega device installed-apps --device 127.0.0.1:15555
vega device installed-packages --device 127.0.0.1:15555

# Uninstall (clears WebView cache too — useful when the app shows stale content)
vega device uninstall-app --device 127.0.0.1:15555 \
  --appName com.kellner.missioncontrol.main

# Reboot the stick
vega device reboot --device 127.0.0.1:15555

# Stream device logs
vega device start-log-stream --device 127.0.0.1:15555

# Shell access
"$(vega which vda)" -s 127.0.0.1:15555 shell "<command>"
```

Note the flag difference: `vega run-app` uses `--deviceId`, while `vega device <cmd>` uses `--device`.

## Build before deploy

```bash
cd app/

# Bump build-number EVERY build (vpt validate requires build_number > 0,
# and the device may ignore reinstalls with the same number)
vega build --target armv7 --buildType Release --build-number N

# Validate — must report 0 errors
vega exec vpt validate dist/missioncontrol_armv7.vpkg

# Sanity check: a real app is 100+ KB. ~4.7 KB = manifest-only, broken.
ls -la dist/missioncontrol_armv7.vpkg
```

Our good builds: ~150 KB (build 1), ~787 KB with icon (build 2+).

## After deploy: reboot for launcher

Vega caches launcher tiles. After installing a new build (especially the first one with an icon), **reboot the Fire Stick** (Settings → My Fire TV → Restart, or `vega device reboot`) so the launcher re-enumerates packages and picks up the icon.

## Quick reference: environment

```bash
export DBUS_SESSION_BUS_ADDRESS="unix:path=/tmp/dbus-vega-persistent"
export PATH="/home/hatch/vega/bin:$PATH"
export HOME=/home/hatch
VDA="$(vega which vda)"   # → .../KeplerCLIVegaDeviceAdaptor-2.0/runtime/bin/vda
```

The D-Bus Secret Service shim must be running on that bus (see [AUTHENTICATION.md](AUTHENTICATION.md)) or every `vega` command fails reading the token.
