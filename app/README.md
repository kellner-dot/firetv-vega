# Mission Control for Vega OS

React Native WebView app for the Fire TV Stick 4K Select (Vega OS).

## What it does

Loads the Mission Control fleet dashboard
(`https://kellner-dot.github.io/seth-dashboard/mission-control/`)
in a native Vega WebView — full-screen on the TV.

## Project layout

- `src/App.tsx` — WebView pointing at the live dashboard URL
- `manifest.toml` — Vega package manifest (`com.kellner.missioncontrol`)
- `assets/index.html` — bundled fallback page

## Build

```bash
# Install dependencies (npm needs --no-bin-links in restricted containers)
npm install --no-bin-links --no-audit --no-fund --ignore-scripts

# Build for armv7 (Fire TV Stick 4K Select)
vega build --target armv7 --buildType Release --build-number <N>

# Validate — MUST NOT be the ~4.7 KB empty package
vega exec vpt validate build/armv7-release/missioncontrol_armv7.vpkg
```

The validated `.vpkg` lands in `build/armv7-release/`.

## Deploy

```bash
# Fire Stick must be in devmode with ADB open (port 5555)
vega run-app build/armv7-release/missioncontrol_armv7.vpkg
```

See `../scripts/devmode.sh` and `../scripts/deploy.sh`.
