# Documentation

Comprehensive guides for Vega OS development on the Fire TV Stick 4K Select.

## Start here

- **[Authentication](AUTHENTICATION.md)** — Vega CLI login, Amazon Developer account, and the headless keyring solution that makes `vega devmode login` work in containers/servers without a desktop keyring.
- **[Devmode](DEVMODE.md)** — Enabling developer mode on the Fire Stick: the TV code flow, vendor selection, and what changes on the device.
- **[App Development](APP-DEVELOPMENT.md)** — Building Vega OS apps: manifest, React Native/Kepler, WebView template, build flags. For the full 2,100-line deep dive, see [VEGA-APP-GENIUS.md](VEGA-APP-GENIUS.md).
- **[Mission Control](MISSION-CONTROL.md)** — Our app: architecture, the Netflix-style TV dashboard redesign, and how the pieces fit together.
- **[RVG Bridge](RVG-BRIDGE.md)** — The remote-control "hack": an HTTP server on the VM that translates RVG API calls into ADB commands for the Fire Stick.
- **[Never-Sleep](NEVER-SLEEP.md)** — How the Fire Stick stays awake indefinitely via Vega's `alcli` activity lock + keepalive.
- **[Feature Roadmap](FEATURE-ROADMAP.md)** — The 24-feature "cool features" backlog: TV dashboard, cross-device, automation, media, Kavi integration, fun/wow.
- **[Deployment](DEPLOYMENT.md)** — Deploying to the stick over the tailnet: the socat tunnel method, `vda` commands, and the install/launch cycle.
- **[Troubleshooting](TROUBLESHOOTING.md)** — Common issues and fixes: launcher visibility, WebView caching, bundle staleness, Alexa.

## Reference

- **[VEGA-APP-GENIUS.md](VEGA-APP-GENIUS.md)** — The definitive Vega OS app development guide (2,100+ lines). Architecture, manifest reference, code examples, media, input, lifecycle, distribution, debugging. Written from primary sources: SDK binaries, npm packages, Amazon docs, and open-source Vega apps.
- **[TAILNET-SETUP.md](TAILNET-SETUP.md)** — How the Fire Stick is reachable over Tailscale via subnet routing through SETHS-PC.
- **[URL-INVESTIGATION.md](URL-INVESTIGATION.md)** — Trust analysis of the Vega SDK installer URL.
- **[VEGA-KNOWLEDGE.md](VEGA-KNOWLEDGE.md)** — Build runbook: devmode flow, React Native build, packaging.

## Environment

| Item | Value |
|---|---|
| Device | Fire TV Stick 4K Select |
| OS | Vega OS (Linux-based, **not** Android) |
| Vega CLI | 1.4.2 |
| SDK | 0.24.12112 (channel `main`) |
| Build target | `armv7` |
| LAN IP | 10.0.0.151 (via Tailscale subnet route) |
| ADB port | 5555 (open only after devmode is enabled) |
