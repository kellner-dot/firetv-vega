# Mission Control for Fire TV

A native Vega OS app wrapping the Mission Control fleet dashboard — Seth's device/service status board, optimized for TV.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Vega app (com.kellner.missioncontrol)      │
│  ┌───────────────────────────────────────┐  │
│  │  React Native WebView (full-screen)   │  │
│  │  → https://kellner-dot.github.io/    │  │
│  │    seth-dashboard/mission-control/    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│  GitHub Pages (kellner-dot/seth-dashboard)  │
│  ├── index.html  (TV-optimized dashboard)   │
│  ├── tv.html     (same, alternate URL)      │
│  └── status.json (fleet data, 5-min refresh)│
└─────────────────────────────────────────────┘
                     ▲
                     │
┌─────────────────────────────────────────────┐
│  Collector (mission-control-collector cron)  │
│  Runs every 5 min, writes status.json       │
└─────────────────────────────────────────────┘
```

The app itself is a thin wrapper — all UI and data live on GitHub Pages. Updating the dashboard is a `git push`, no app rebuild needed (unless the WebView URL changes).

**App ID:** `com.kellner.missioncontrol`
**Component:** `com.kellner.missioncontrol.main`
**Template:** `vegaWebview`
**Target:** `armv7`, Release

## The TV dashboard

The dashboard was redesigned for TV after the phone layout proved unusable on the big screen (zoomed-in, cards cut off, tiny text).

TV version features:
- **1080p layout** — `<meta name="viewport" content="width=1920">`, 4-column card grid
- **Big text** — 26px body, 34px card titles, 52px header, 64px clock (readable from the couch)
- **DPAD navigation** — arrow keys move focus between cards, focused card gets a glowing outline + scale-up; Enter opens a fullscreen detail overlay; Back/Escape closes it. Handles Fire TV Back keycodes (10009/461).
- **Graphics** — pulsing status dots (green/amber/red), animated storage meters, signal-strength bars, gradient stat numbers
- **Fancy icons** — 13 premium gradient SVG icons (server rack with LEDs, aluminum laptop, glass phone, TV with sunset scene, GitHub octocat, Apple Music note, vinyl record, film strip, cloud, magnet, shield, calendar, lightning bolt)
- **Auto-refresh** — every 30 seconds, preserving DPAD focus across refreshes
- **Live clock** + "● LIVE" freshness indicator

18 cards across 4 sections: **FLEET** (Gaming PC, MacBook Air, iPhone, Razr+), **MEDIA** (Emby, TeraBox, BiglyBT, Apple Music, Plex, Jellyfin), **OPS** (GitHub, KaviGuard, Calendar, Pi-hole), **INFRA** (Kiosk, Docker, Watchtower).

Data source: `status.json`, written by the `mission-control-collector` cron every 5 minutes. The dashboard fetches with `cache: 'no-store'`.

## Key files

| Path | Purpose |
|---|---|
| `app/manifest.toml` | App definition (id, icon, component, services) |
| `app/src/App.tsx` | WebView component, points at the dashboard URL |
| `app/assets/image/icon.png` | 512×512 launcher icon |
| `app/dist/missioncontrol_armv7.vpkg` | Built package (do not commit stale builds) |

## manifest.toml

```toml
[package]
title = "Mission Control"
version = "0.1.0"
build_number = 3
id = "com.kellner.missioncontrol"
icon = "@image/icon.png"

[os.version]
min = "1.2"
target = "1.2"

[components]
[[components.interactive]]
id = "com.kellner.missioncontrol.main"
runtime-module = "/com.amazon.kepler.runtime.react_native_kepler_4@IReactNativeKepler_0"
launch-type = "singleton"
categories = ["com.amazon.category.main"]

[wants]
# WebView renderer, input method, media, audio, UCC publisher, group IPC
[[wants.service]]
id = "com.amazon.webview.renderer_service"
# ... (see app/manifest.toml for the full list)
```

## App.tsx highlights

```tsx
<WebView
  hasTVPreferredFocus
  javaScriptEnabled
  domStorageEnabled
  mediaPlaybackRequiresUserAction={false}
  mixedContentMode="compatibility"
  source={{ uri: "https://kellner-dot.github.io/seth-dashboard/mission-control/" }}
  onLoad={hideSplashScreenCallback}
  onError={...} onHttpError={...} onSslError={...}
/>
```

`hasTVPreferredFocus` is important for TV — it gives the WebView focus for DPAD input.

## Updating the dashboard vs updating the app

- **Dashboard content** (cards, icons, layout) → edit in `kellner-dot/seth-dashboard`, push. The Fire Stick picks it up on next app launch (or page refresh). **No rebuild needed.**
- **App wrapper** (URL, icon, manifest, WebView settings) → edit in `app/`, rebuild with bumped `--build-number`, revalidate, redeploy. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Roadmap

- [ ] **IPTV player integration** — wrap a web IPTV player (TV Navigator recommended: open-source, TV-optimized, Xtream Codes + M3U, HLS.js) as a second screen/section in the app. Flix Pro itself is Android-only, no web version.
- [ ] **Auto-update** — in-app update checker that pings GitHub for new VPKG versions.
- [ ] **RVG agent for Fire Stick** — remote control server (status/screenshot/input) running on the stick. In progress.
