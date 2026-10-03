# Vega OS App Development

> **For the complete reference** (2,100+ lines: architecture, manifest field reference, code examples, media/input/lifecycle, debugging), see **[VEGA-APP-GENIUS.md](VEGA-APP-GENIUS.md)**. This page is the quick-start summary.

## What Vega OS is

Amazon's Linux-based smart-TV OS (launched Oct 2025), replacing Fire OS (Android) on new Fire TV hardware. It is **not** Android:

- **No APKs.** The only install path for unsigned apps is the developer flow: Amazon Developer account → `vega devmode login` → `vega devmode enable-device` → `install-app`.
- Apps are **React Native** (0.83 in SDK 0.24) running on **Kepler**, Amazon's app framework.
- Packages are **`.vpkg`** files (Zstandard-compressed), validated by **VPT** (Vega Packaging Tool).
- Native code compiles to **armv7** for physical sticks (aarch64/x86_64 for the Virtual Device).

## Toolchain

The `vega` binary (`/home/hatch/vega/bin/vega`, CLI 1.4.2) is a multi-call Go binary (also `kepler` and `vvman` personalities). Key commands:

```bash
vega build --target armv7 --buildType Release --build-number N
vega exec vpt validate <package.vpkg>     # must report 0 errors
vega exec vda connect HOST:5555           # connect to device (ADB analogue)
vega device list                          # list connected devices
vega run-app <package.vpkg> --deviceId SERIAL   # install + launch
```

`vega exec` runs SDK tools with the component-aware environment applied. `vega build` alone can emit a ~4.7 KB **manifest-only** `.vpkg` — always check the size (a real app is 100+ KB) and run `vpt validate`.

## Project structure

Scaffold with `vega project generate` (templates: `helloWorld`, `basic-turbo-module`, **`vegaWebview``). Our app uses the **`vegaWebview`** template: a full-screen `WebView` (`@amazon-devices/webview`) loading a URL.

```
app/
├── manifest.toml      # THE app definition (see below)
├── package.json       # RN 0.83, react-native-kepler 4.0
├── src/App.tsx        # WebView component
└── assets/image/      # icons (see Launcher note)
```

## manifest.toml essentials

```toml
[package]
title = "Mission Control"
version = "0.1.0"
build_number = 2
id = "com.kellner.missioncontrol"
icon = "@image/icon.png"        # REQUIRED for launcher visibility!

[os.version]
min = "1.2"
target = "1.2"

[components]
[[components.interactive]]
id = "com.kellner.missioncontrol.main"
runtime-module = "/com.amazon.kepler.runtime.react_native_kepler_4@IReactNativeKepler_0"
launch-type = "singleton"
categories = ["com.amazon.category.main"]   # correct category for Home launcher
```

**Launcher visibility requires `icon`.** Without `[package].icon` pointing to a 512×512 PNG in `assets/image/`, the app installs and runs but is invisible in the TV's app grid and can't be resolved by Alexa. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#app-not-in-launcher).

Do **not** add `com.amazon.category.launcher` (system-reserved, validation error for third-party apps).

## Build → validate → deploy

```bash
# 1. Build (bump build-number every time)
vega build --target armv7 --buildType Release --build-number 3

# 2. Validate
vega exec vpt validate dist/missioncontrol_armv7.vpkg
# → must report 0 errors

# 3. Deploy (see DEPLOYMENT.md for the tunnel setup)
vega run-app dist/missioncontrol_armv7.vpkg --deviceId 127.0.0.1:15555
```

**Gotcha:** `vega build` doesn't always rebuild the JS bundle from `src/`. If the app doesn't reflect `src/` changes, the bundle in `build/lib/rn-bundles/Release/index.bundle` is stale. Either force a JS rebuild or patch the bundle directly (see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#stale-js-bundle)).

## WebView capabilities

Vega WebView is Chromium-based. Confirmed working: HLS.js, DASH.js, Shaka Player for adaptive streaming; H.264/H.265/VP9/AV1 video; AAC/MP3/Dolby audio; TV remote DPAD key events. See [VEGA-APP-GENIUS.md](VEGA-APP-GENIUS.md) §Media for the full matrix including DRM (Widevine L1/L3, PlayReady).

## Going deeper

[VEGA-APP-GENIUS.md](VEGA-APP-GENIUS.md) covers: OS architecture, component model (KPM), Kepler runtime internals, manifest field reference with enums/defaults, app lifecycle (LCM), focus management, media stack (GStreamer), input handling, headless JS pitfalls, debugging (`loggingctl`, `vda shell`), and Appstore submission.
