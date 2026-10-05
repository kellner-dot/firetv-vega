# KaviTV 10s Termination — Root Cause & Fix (2026-10-05)

## Problem
KaviTV (com.kellner.channels) launched but terminated after ~10s, never becoming VISIBLE.
Mission Control (com.kellner.missioncontrol) worked fine.

## Root Causes Found

### 1. The 3ms Crash (already fixed before this session)
`w3cmedia_2` in `[needs.module]` caused the package manager to abort the app
immediately on launch. Fixed by removing it from the manifest.

### 2. The 10s Termination (fixed this session)
The `keplerscript-app-config.json` (generated during `vega build`) referenced:
- Native libraries in `linkDynamic`: `AmazonW3CMediaFCCLibStable`, `KeplerMediaControlsServerTM`, `KeplerMediaControlsClientTM`, `keplermediadescriptor`
- JS bundles in `systemBundles`: `index.amzn__react-native-w3cmedia-2.hermes.bundle`, `amzn__kepler-media-controls.hermes.bundle`, `index.amzn__keplermediadescriptor-1.hermes.bundle`

These media modules were NOT declared in `[needs.module]` (to avoid the 3ms crash),
so when the app tried to load them during the READY→VISIBLE transition, the
FOREGROUND event failed (`Completed: false`). Vega's ~10s watchdog then killed the app.

## The Fix
1. Removed `@amazon-devices/react-native-w3cmedia` from package.json (npm uninstall)
2. Removed w3cmedia JS imports from `src/App.tsx` and `src/screens/PlayerScreen.tsx`
3. After `vega build`, manually strip from `build/private/vega/armv7/Release/`:
   - `manifest.toml`: Remove `w3cmedia_2`, `kepler_media_controls_1`, `keplermediadescriptor_1` from `[needs.module]`. KEEP `expo_file_system_2` (storage.ts uses it).
   - `assets/raw/keplerscript-app-config.json`: Set `linkDynamic: []`, `appLibraries: []`, and `systemBundles: {common: ['index.amzn__react-native-kepler-4.hermes.bundle']}` (keep the RN runtime!)
4. Copy JS bundles from `build/lib/rn-bundles/Release/` to `build/private/vega/armv7/Release/bundle/` (vega build doesn't copy them due to a CLI error)
5. `vpt pack` the stripped directory

## Critical Gotcha
My first strip was too aggressive — I emptied `systemBundles` entirely, removing the
React Native runtime (`index.amzn__react-native-kepler-4.hermes.bundle`). The app
stayed in READY but never became VISIBLE. The RN kepler bundle MUST be kept.

## Build System Issue (needs proper fix)
KMMB (Kepler Module Manifest Builder) re-adds the media modules to the manifest
during every `vega build`, even though `@amazon-devices/react-native-w3cmedia` was
removed from package.json. The source of these phantom modules is unknown.
The manual strip step is required until KMMB is fixed or configured.

## Verification
- Build: `kavitv-vega-0.2.0-stable_armv7.vpkg` (479KB, build 202610050930)
- Test 1: VISIBLE for 26s, then exited (no crash)
- Test 2: VISIBLE for 41s+ (goal exceeded)
- State transitions: IDLE → LAUNCHED → READY → VISIBLE (clean)

## Files
- Working build: `~/workspace/kavitv-vega-app/kavitv-vega-0.2.0-stable_armv7.vpkg`
- Fixed manifest: `~/workspace/kavitv-vega-app/manifest.toml.fixed`
- Fixed keplerscript config: `~/workspace/kavitv-vega-app/keplerscript-app-config.json.fixed`
