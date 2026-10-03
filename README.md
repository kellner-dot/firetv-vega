# Fire TV Stick — Vega OS Development

Development workspace for Seth's **Fire TV Stick 4K Select** (Vega OS).

## What this is

- **Mission Control app** — a native Vega OS app version of the [Mission Control Center](https://kellner-dot.github.io/seth-dashboard/mission-control/) fleet dashboard (device status for SETHS-PC, Emby, TeraBox, MacBook Air, iPhone, Razr, Fire TV).
- **SDK setup & build docs** — how to install Amazon's Vega SDK, build for `armv7`, and deploy to the stick.
- **Tailnet access** — how the Fire Stick is reachable over Tailscale via subnet routing.

## Device

| Item | Value |
|---|---|
| Device | Fire TV Stick 4K Select |
| OS | Vega OS (Linux-based, **not** Android) |
| Developer Mode | Enabled |
| LAN IP | 10.0.0.151 |
| Tailnet access | Via SETHS-PC subnet router → see `docs/TAILNET-SETUP.md` |

## Docs

**Start here:** [`docs/README.md`](docs/README.md) — full documentation index.

| Guide | What it covers |
|---|---|
| [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) | Vega CLI login, Amazon Developer vendor record, and the headless keyring solution |
| [`docs/DEVMODE.md`](docs/DEVMODE.md) | Enabling developer mode on the Fire Stick (TV code flow) |
| [`docs/APP-DEVELOPMENT.md`](docs/APP-DEVELOPMENT.md) | Building Vega OS apps — quick start (full reference: `VEGA-APP-GENIUS.md`) |
| [`docs/VEGA-APP-GENIUS.md`](docs/VEGA-APP-GENIUS.md) | **The definitive 2,100-line Vega OS app development guide** — architecture, manifest reference, code examples, media, debugging |
| [`docs/MISSION-CONTROL.md`](docs/MISSION-CONTROL.md) | Our app: architecture, TV-optimized dashboard, roadmap |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deploying over the tailnet (socat tunnel, `vda` commands) |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Common issues: launcher visibility, stale bundles, caching, Alexa |
| [`docs/URL-INVESTIGATION.md`](docs/URL-INVESTIGATION.md) | Trust analysis of the Vega SDK installer URL (`sdk-installer.vega.labcollab.net`). Verdict: legitimate Amazon distribution point. |
| [`docs/TAILNET-SETUP.md`](docs/TAILNET-SETUP.md) | Subnet router architecture: PC advertises `10.0.0.0/24` so the stick is reachable via tailnet. |
| [`docs/VEGA-KNOWLEDGE.md`](docs/VEGA-KNOWLEDGE.md) | Build runbook: devmode flow, React Native build, packaging. |

## Quick start

```bash
# 1. Install the SDK (Linux, non-root)
/vegahome/bin/vega sdk config setup --non-interactive

# 2. Build the app for armv7
cd app && npx react-native build-vega

# 3. Validate the package
vega exec vpt validate

# 4. Deploy (stick must be in devmode, ADB reachable)
./scripts/deploy.sh
```

## Layout

```
firetv-vega/
├── README.md            # this file
├── docs/                # investigations, setup guides, runbooks
├── app/                 # Vega React Native app source
└── scripts/             # devmode helpers, deploy script
```

## Notes

- Vega OS has **no general sideloading** (unlike Fire OS/Android) — devmode + CLI is the only path.
- `vega build` alone can produce empty packages — the real React Native build is `npx react-native build-vega`.
- TV developer codes expire after ~5 minutes.
- Sideloaded apps need `[package].icon` in the manifest for a launcher tile — see [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md#app-not-in-launcher).
