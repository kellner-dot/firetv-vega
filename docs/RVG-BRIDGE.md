# RVG Bridge for Fire Stick (Vega OS)

The "hack" that gives us remote control of the Fire Stick without a real on-device RVG agent.

## Why a bridge?

A normal on-device RVG server can't work on Vega OS. Third-party Vega apps can't:

- Listen as a TCP/HTTP server through ordinary React Native APIs
- Capture system screenshots
- Inject global input
- Execute arbitrary shell commands
- Enumerate all installed apps

A limited WebSocket client app was built (`com.kellner.rvg.main`) but it only handles app-side operations (status, notifications, `pkg://` launches).

## The hack: ADB on the VM

We already have ADB access to the Fire Stick through a socat tunnel:

```bash
socat TCP-LISTEN:15555,fork,reuseaddr \
  PROXY:hatch-egress-proxy:10.0.0.151:5555,proxyport=3130
vda connect 127.0.0.1:15555
```

So instead of fighting Vega's sandbox, we run an HTTP server **on the Linux VM** and translate RVG API calls into ADB/vega-CLI commands sent through the tunnel:

```
RVG client → HTTP (port 8898) → [this server] → vda/ADB → [Fire Stick]
```

## Server

- **Location:** `~/workspace/vega-rvg-bridge/server.py`
- **Port:** `8898` (localhost-only)
- **Auth:** `X-RVD-Token` header, token in `~/workspace/vega-rvg-bridge/token.txt` (mode `0600`)
- **Persistence:** systemd service `rvg-bridge.service` + `adb-tunnel.service` (both survive reboots)

## Endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/rvd/status` | Device info (hostname, model, uptime, OS) |
| `GET` | `/rvd/shot` | Screenshot via `screencap` (503 on production builds) |
| `POST` | `/rvd/input` | Remote input: keys, tap, swipe, text |
| `POST` | `/rvd/exec` | Restricted shell (allowlist only) |
| `POST` | `/rvd/notify` | 501 (no toast API reachable via ADB) |
| `GET` | `/rvd/apps` | Installed app list |
| `POST` | `/rvd/launch` | Launch app by component ID |
| `POST` | `/rvd/send` | Queue a URL in the TV inbox (Send to TV) |
| `POST` | `/rvd/action/emby-rescan` | Trigger Emby library rescan |
| `POST` | `/rvd/action/find-phone` | Ping the Razr via its RVG agent |
| `POST` | `/rvd/action/reboot-pc` | Reboot SETHS-PC (60s abortable delay) |

## Input payload

```json
{"key": "up"}            // DPAD: up/down/left/right/ok/enter/back/home
{"key": "playpause"}      // media keys
{"tap": [960, 540]}       // touch tap at coordinates
{"swipe": [100,500,900,500]}
{"text": "hello"}         // type text
```

## Architecture notes

- The Fire Stick **cannot** reach the VM's tailnet IP (verified via ADB curl → HTTP 000). So the TV dashboard can't call the bridge directly — it reads public GitHub Pages (inbox polling works), while device actions are triggered from the phone remote (which has tailnet access).
- Key translation uses `inputd-cli` on Vega OS (Linux input-event key names), not Android `input keyevent`.
- Bridge token is in `~/workspace/vega-rvg-bridge/token.txt` — needed once in the phone remote page.

## Companion pieces

- `keepalive.sh` — health check script
- `nowplaying.py` — Emby now-playing poller (cron every 2 min → `nowplaying.json`)
- `goodnight.py` — Good night routine (pause → home → launch Mission Control)
- `never-sleep-keepalive.sh` — Never-sleep lock keeper (see [NEVER-SLEEP.md](NEVER-SLEEP.md))
