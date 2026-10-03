# Enabling Developer Mode on the Fire TV Stick

## Prerequisites

- [Authentication](AUTHENTICATION.md) complete (`vega devmode login` succeeded, vendor record exists).
- Fire TV Stick 4K Select on the same network (or reachable via tailnet — see [TAILNET-SETUP.md](TAILNET-SETUP.md)).

## Steps

### 1. Unlock Developer Options on the TV

1. **Settings → My Fire TV → About** → select the device name.
2. Press the center/select button **7 times** → "You are now a developer".
3. Back out → **Developer Options** → **Developer Mode** → Continue.

### 2. Get the developer code

The TV shows a **6-digit code**. It expires in ~5 minutes; use "Request a New Code" if it times out.

### 3. Enable from the CLI

```bash
vega devmode enable-device --code <6-digit-code>
```

Output:
```
Using vendor: Seth Kellner Photography
✓ Device enabled successfully
```

If you have multiple vendors, add `--vendor <ID>` to skip the interactive selection.

### 4. Device reboots

The Fire Stick **reboots automatically**. After it comes back:
**Settings → My Fire TV → Developer Options → Developer Mode = Enabled**.

## What changes on the device

| Before | After |
|---|---|
| Port 5555 closed | Port 5555 open (ADB/VDA over network) |
| `vda connect` fails | `vda connect 10.0.0.151:5555` succeeds |
| No sideloading | `vega run-app` / `install-app` work |

**Important:** A closed port 5555 is *not* a network fault — it's the pre-devmode state. ADB-over-network only works after `enable-device` succeeds.

## Connection mode: USB vs Network

In **Developer Options**, there's a connection mode setting:

- **USB** — the stick listens for ADB over USB only. Port 5555 stays closed on the network.
- **Network** — the stick listens on port 5555 over Wi-Fi/LAN. **This is what you want** for wireless deployment.

If `vda connect` fails with "connection refused" after devmode is enabled, check this setting — it's the most common cause.

## Dev-mode states

The CLI reports: `enable` (full devmode: shell access, package management, component debugging), `authenticating`, `disable`.

## On-device shells (post-devmode)

- **Default dev shell** (`vda shell`) — filesystem restricted mostly to `/tmp`.
- **Component shell** — `vda shell -t <component-id>` (e.g. `com.kellner.missioncontrol.main`) gives access to that component's directories; `/scratch` is the writable bind mount.
- **`vsh`** — the developer shell. **`vpm`** — package manager. **`vlcm list`** — component monitor.

## Notes

- Only **non-Amazon package IDs** can be sideloaded (nothing starting with `com.amazon`).
- The developer code is single-use and time-limited. Get a fresh one each time you run `enable-device`.
- If the stick was factory reset, devmode must be re-enabled from scratch.
