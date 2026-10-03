# Vega OS App Development — The Genius Guide

*Researched from primary sources: Vega SDK 0.24.12112, Vega CLI 1.4.2, `@amazon-devices/react-native-kepler` 4.0.1, `@amazon-devices/webview` 4.0.2, Amazon Vega developer docs, and open-source Vega apps. Written 2026-10-03.*

---

## Part 1: What Vega OS Actually Is

### The one-paragraph version

Vega OS is Amazon's **Linux-based, React Native-first operating system** for Fire TV devices. It is **not** Android. It does not run APKs, has no ART/Dalvik, no Android framework, no Google services. Every app is a **React Native application** compiled to native ARM code, running its JavaScript on **Hermes**, talking to OS services through **TurboModules** (React Native's new-architecture native module system). The "native" layer is Amazon's **Kepler** application framework — a C++ runtime that hosts the React Native renderer, manages the component model, and brokers IPC to system services.

### How it differs from Fire OS (Android)

| Dimension | Fire OS (Android) | Vega OS |
|---|---|---|
| Kernel | Linux + Android patches | Linux (Yocto-derived "Vodka" build system) |
| App format | APK (DEX bytecode) | VPKG (Zstandard-compressed bundle) |
| UI framework | Android Views / Jetpack Compose | React Native (Kepler fork of RN 0.83) |
| JS engine | V8 (if using WebView) or none | Hermes (ahead-of-time compiled) |
| Web rendering | Android System WebView | Kepler WebView (Chromium 118, TurboModule) |
| Native modules | JNI | TurboModules via KeplerScript |
| IPC | Binder | Kepler IPC (component model) |
| Permissions | AndroidManifest.xml | manifest.toml `[needs.privilege]` |
| Distribution | APK sideload / Appstore | VPKG sideload (devmode) / Appstore |
| ADB | Full ADB | ADB-compatible `vda` (subset) |

### The Kepler runtime — the actual "OS" your app talks to

"Kepler" is the name of Amazon's application framework that sits between your React Native code and the Linux kernel. Think of it as the equivalent of Android's framework layer:

- **KeplerScript**: The native runtime that hosts Hermes, loads your `.hermes.bundle`, and exposes TurboModules. Your app's `keplerscript-app-config.json` (embedded in every VPKG) declares which native libraries to dynamically link (`linkDynamic`) and which system JS bundles to load (`systemBundles`).
- **Component model**: Apps are not monoliths. They are collections of **components** — interactive components (things with UI that the user launches) and services (background capabilities). Components declare dependencies on each other through the manifest.
- **IPC via OmniKit**: Components communicate through **OmniKit** (formerly APMF) — Amazon's cross-language, cross-process IPC system. APIs are defined in **IDL** (Interface Definition Language), and OmniKit generates bindings for C++, JavaScript (via TurboModules), and other languages. This is the equivalent of Android's Binder + AIDL. The `idl-turbo-module` project template lets you define your own OmniKit APIs.

### The build system ("Vodka")

The SDK ships a full cross-compilation toolchain named **Vodka**: `VodkaClangArmv7`, `VodkaClangAarch64`, `VodkaClangX86_64`, `VodkaNinja`, `VodkaCMake`. When you run `vega build`, it:
1. Bundles your JS with Metro → Hermes bytecode (`index.hermes.bundle`)
2. Cross-compiles any native code with Clang for the target arch
3. Packages everything into a `.vpkg` using Zstandard compression (not ZIP)

---

## Part 2: The Component Model (the core abstraction)

This is the single most important concept. Vega does not have "apps" in the Android sense — it has **packages** containing **components**.

### Component types

**Interactive components** (`[[components.interactive]]`):
- Have UI. Are launchable. What the user thinks of as "the app."
- Each has an `id` (reverse-DNS, e.g. `com.kellner.missioncontrol.main`), a `runtime-module` (which Kepler runtime hosts it), a `launch-type`, and `categories`.
- `launch-type = "singleton"`: only one instance ever exists. Per Amazon docs, the **default is `new-instance`** (not singleton or standard) — always declare explicitly for TV apps.

**Lifespan** (docs + screentinker):
- `lifespan = "permanent"` — never killed for inactivity (signage, dashboards)
- `"long"` / `"short"` / `"transient"` — progressively more aggressive reclamation
- `timeout-secs` — inactivity timeout before OS reclaims the component

**Tasks** (`[tasks]`): Only `install` mode works — others are silently ignored.

**Messages** (`[[message]]`): Declarative `pkg://` auto-launch without code.

**Offers nuances**: `required-privileges` is a no-op for non-system apps; `offers.interaction` is legacy (now a validation error).

**Processes** (`[processes]`): Same process group = same `runtime-module` enforced.

**Extras** (`[[extras]]`): Arbitrary TOML tables serialized to strings, passed at launch.

**`[os.version]` required since SDK 0.24**. Only minted versions accepted — **OS 1.2 is the only minted version**. RN 0.83 apps can't set min below 1.2.

**OS-version guards**: `isPresentOnOS()` runtime check + `// @os-version-ok` assertion + ESLint `no-unguarded-os-api` + `vega project doctor` (CI-gateable).

**Services** (`[[wants.service]]` / `[[offers.service]]`):
- Background capabilities provided by the OS or other apps.
- Your app **wants** services (declares dependencies) and can **offer** services (expose capabilities to others).

### The dependency contract: needs / wants / offers

```toml
[needs]
[[needs.module]]
id = "/com.amazon.vega.os@IVega_1_2"          # Hard requirement: OS interface version

[[needs.module]]
id = "/com.amazon.kepler.webview_4@IWebview_4" # Hard requirement: WebView v4 API

[[needs.privilege]]
id = "com.amazon.privilege.security.file-sharing"  # Hard requirement: privilege

[wants]
[[wants.service]]
id = "com.amazon.webview.renderer_service"     # Soft desire: want if available

[offers]
[[offers.service]]
id = "com.amazon.gipc.uuid.*"                  # Expose: I provide this
```

**Mechanism**: `needs` are **hard** — the package will not install if they can't be satisfied. `wants` are **soft** — the app gets the service if present, degrades gracefully if not. `offers` advertises capabilities other components can consume. The `*` in `com.amazon.gipc.uuid.*` is a wildcard — this app offers IPC endpoints under any UUID namespace.

### Categories — how the launcher finds your app

```toml
[[components.interactive]]
categories = ["com.amazon.category.main"]
```

`com.amazon.category.main` is the **only** category needed for Home launcher visibility. (Verified against Amazon's manifest-components doc and the working jellyfin-vega-os app, which uses the identical category.) Other categories:
- `com.amazon.category.launcher` — **system-reserved**, do not use
- `com.amazon.category.caf` — for Alexa Capability Agents (voice skill backends), not for being voice-launched

**Critical launcher finding**: The launcher tile requires an `icon` in `[package]`:
```toml
[package]
icon = "@image/icon.png"   # @image/ maps to assets/image/
```
The PNG must be 512×512, ≤1MB. Without it, the app installs and runs but gets **no launcher tile** — it's only reachable via Settings → Applications or programmatic launch. (This was root-caused empirically: our icon-less build had no tile; the icon build did, after a reboot to force launcher re-enumeration.)

---

## Part 3: manifest.toml — Complete Reference

```toml
schema-version = 1          # Manifest schema version. Always 1 currently.

[package]
title = "Mission Control"  # Display name in launcher
version = "0.1.0"          # Semantic version (display)
build_number = 3           # Integer, must increment for updates
id = "com.kellner.missioncontrol"  # Package ID, reverse-DNS, immutable
icon = "@image/icon.png"   # Launcher tile icon. @image/ → assets/image/

[os.version]
min = "1.2"                # Minimum Vega OS version
target = "1.2"             # Target Vega OS version (API contract)

[needs]                    # HARD dependencies (install fails if unsatisfied)
[[needs.module]]
id = "/com.amazon.vega.os@IVega_1_2"  # Format: /<module>@<interface>_<version>

[[needs.module]]
id = "/com.amazon.kepler.keplerscript_4@IKeplerScript_0"

[[needs.module]]
id = "/com.amazon.kepler.webview_4@IWebview_4"

[[needs.privilege]]        # Privileges are Android-permission equivalents
id = "com.amazon.privilege.security.file-sharing"

[components]
[[components.interactive]]
id = "com.kellner.missioncontrol.main"  # Component ID (what you launch)
runtime-module = "/com.amazon.kepler.runtime.react_native_kepler_4@IReactNativeKepler_0"
launch-type = "singleton"  # or "standard"
categories = ["com.amazon.category.main"]

[wants]                    # SOFT dependencies (graceful degradation)
[[wants.service]]
id = "com.amazon.webview.renderer_service"  # Web content rendering

[[wants.service]]
id = "com.amazon.inputmethod.service"       # Keyboard/IME support

[[wants.service]]
id = "com.amazon.media.server"              # Video playback

[[wants.service]]
id = "com.amazon.mediametrics.service"      # Playback metrics

[[wants.service]]
id = "com.amazon.mediabuffer.service"       # Stable media APIs
[[wants.service]]
id = "com.amazon.mediatransform.service"

[[wants.service]]
id = "com.amazon.audio.stream"              # Audio playback
[[wants.service]]
id = "com.amazon.audio.control"             # Audio focus, volume

[[wants.service]]
id = "com.amazon.kepler.ucc.publisher"      # Accessibility support

[[wants.service]]
id = "com.amazon.gipc.uuid.*"               # Group IPC (media services)

# DRM (uncomment for encrypted media):
# [[wants.service]]
# id = "com.amazon.drm.key"
# [[wants.service]]
# id = "com.amazon.drm.crypto"

[offers]
[[offers.service]]
id = "com.amazon.gipc.uuid.*"
```

### The media service stack explained

The `wants.service` entries for media form a **layered stack**:
1. `com.amazon.media.server` — the actual media pipeline (decoding, rendering)
2. `com.amazon.mediabuffer.service` + `com.amazon.mediatransform.service` — "stable APIs" layer (buffer management, format transformation)
3. `com.amazon.mediametrics.service` — telemetry (required if you want playback metrics)
4. `com.amazon.audio.stream` + `com.amazon.audio.control` — audio routing, focus (ducking when Alexa speaks), volume
5. `com.amazon.audio.system` — system audio (discovered in jellyfin-vega-os; needed for full audio pipeline)
6. `com.amazon.media.playersession.service` — PlayerSession integration (discovered in jellyfin-vega-os)
7. `com.amazon.drm.key` + `com.amazon.drm.crypto` — Widevine/PlayReady DRM (only needed for encrypted content)

**If you omit these**: `<video>` in WebView may still work for basic playback (Chromium handles software decode), but you lose hardware acceleration, audio focus management, and DRM.

**Silent failure warning** (from jellyfin-vega-os): *"Omitting any of them does not surface as a permission error — the player reports a generic failure to attach."* If your video player fails with a generic error, check your `wants.service` list first.

### Expo modules on Vega

Amazon publishes Vega-compatible forks of Expo modules under `@amazon-devices/`:
- `@amazon-devices/expo-file-system` → `/com.amazon.kepler.expo_file_system_2@IExpoFileSystem_0`
- `@amazon-devices/expo-sqlite` → `/com.amazon.kepler.expo_sqlite_2@IExpoSQLite_0`
- `@amazon-devices/react-native-svg` → `/com.amazon.kepler.svg_3@ISVG_0`
- `@amazon-devices/react-native-w3cmedia` → `/com.amazon.kepler.w3cmedia_2@IW3cmedia_3`
- `@amazon-devices/kepler-system-info` → `/com.amazon.kepler.kepler_system_info_1@IKeplerSystemInfo_0`

**Install with**: `vega project install <package>` (not plain `npm install` — this resolves OS-version-compatible versions).

**Input method warning** (from jellyfin-vega-os): *"Required for `<TextInput>` to reach the on-screen keyboard. Without it a focused field never opens the keyboard, and the only clue is `InputMethodEditorImpl: no active connection to input method service` in the device log — not a permission error."* Always include `com.amazon.inputmethod.service` if you have any text input.

### Undocumented / under-documented manifest fields (from production apps)

These appear in working Vega apps (including one on the Amazon Appstore) but are unclear or absent in Amazon's docs:

```toml
# Screensaver / lifespan policy (from screentinker — digital signage app)
[[components.interactive]]
lifespan = "permanent"      # App is never killed for inactivity
timeout-secs = 86400        # Screensaver timeout (24h) — NOT a wake lock

# Media playback server declaration (from astra-tv — Appstore app)
[extras]
# Declares IMediaPlaybackServer interface provider with
# command_options / attribute_options / features.
# Without Next/Previous declared here, remote skip buttons degrade to seeks.

# Cleartext HTTP policy (from THEOplayer sample)
[network-traffic-policy.cleartext]
allowed-domains = ["example.com"]  # HTTP (not HTTPS) allowed for these domains
```

Additional services and privileges seen in the wild:
- `kepler.pcon.service.main` (service, THEOplayer sample)
- `media.secureplayback` (privilege, secure video path)
- `network.privilege.net-info` (privilege, network info access)
- `com.amazon.devconf.privilege.accessibility` (privilege, jellyfin-vega-os)

**Gap**: No open-source app implements deep links. There is no deep-link manifest section in any examined manifest — launch is always the single `com.amazon.category.main` component.

**Build gotchas** (from astra-tv):
- `[needs.module]` is **regenerated from package.json on every `vega build`** — hand edits are lost
- `build-vega` can exit 0 **without emitting a package** — always verify the VPKG exists
- Amazon submission **rejects `build_number` 0** — start at 1

---

## Part 4: App Types and Architecture Choices

### 1. WebView apps (what we built)

**Architecture**: Thin React Native shell (`App.tsx` ~50 lines) hosting a full-screen `@amazon-devices/webview` component. All UI is HTML/CSS/JS loaded from a URL.

**When to use**: Dashboards, media browsers, content apps, anything where web tech is faster to iterate.

**The bridge**: `window.ReactNativeWebView.postMessage(data)` sends strings from web → native. The `onMessage` prop receives them. `injectJavaScript` and `injectedJavaScriptBeforeContentLoaded` send code native → web.

**Key props** (from WebViewTypes.d.ts source):
- `allowSystemKeyEvents` — **critical for TV**: when `true`, Back button (keyCode 27) and other system keys are delivered to the **web JavaScript** instead of the native layer. Only the most recent WebView instance receives them. Default `false`.
- `allowJavaScriptInBackground` — let JS run when app is backgrounded. **Warning from source**: "when app goes to background it can be killed anytime depending the system resource state... apps should complete the work (persisting app state) before returning."
- `allowsDefaultMediaControl` — activates Kepler media session integration for `<video>`/`<audio>`. Default `true`.
- `mediaPlaybackRequiresUserAction` — set `false` for autoplay (TV apps).
- `mixedContentMode` — `"never"` (default) / `"always"` / `"compatibility"`.
- `domStorageEnabled` — localStorage/sessionStorage.
- `injectedJavaScriptBeforeContentLoaded` — runs after document creation, before subresources. Ideal for polyfills, viewport fixes.

### 2. Pure React Native apps

**Architecture**: Full RN component tree, no WebView. Uses Kepler's native views.

**When to use**: When you need 60fps animations, complex gestures, or deep OS integration (Alexa directives, PlayerSession).

**TV-specific APIs** (from source):
- `useTVEventHandler(callback)` — subscribes to **HWEvent** from the remote. Event types: `up`, `down`, `left`, `right`, `select`, `menu`, `back`, `playpause`, `rewind`, `forward`, `volume_up`, `volume_down`, `mute`, `channel_up`, `channel_down`, `red`, `green`, `yellow`, `blue`, `info`, `page_up`, `page_down`, number keys, and more. Each event has `eventKeyAction` (0=down, 1=up) and `deviceIdentifier` (Bluetooth address, vendor/product IDs).
- `TVFocusGuideView` — declarative focus management (Apple's UIFocusGuide equivalent). Props: `destinations`, `autoFocus`, `trapFocusUp/Down/Left/Right`.
- `nextFocusUp/Down/Left/Right` on View — explicit focus graph.
- `useTVEventHandler` on Kepler uses `UserInputManager.addHWEventListenerCallback` (root-tag-based), not the legacy `TVEventHandler.enable()`.

### 3. Choosing between them

| Need | WebView | Pure RN |
|---|---|---|
| Rapid iteration | ✅ Deploy web changes without rebuild | ❌ Rebuild + redeploy VPKG |
| 60fps animations | ❌ Chromium compositing overhead | ✅ Native views |
| Remote control | Manual JS key handling | ✅ `useTVEventHandler` + focus system |
| Video playback | ✅ `<video>` + HLS.js | ✅ `PlayerSession` API |
| Alexa integration | ❌ Limited | ✅ `AlexaManager` directives |
| Offline | ❌ Needs bundled HTML | ✅ Fully native |
| Team skills | Web developers | React Native developers |

**Hybrid** is common: RN shell with WebView for content areas + native components for video player and navigation.

---

## Part 5: The JavaScript Runtime (Hermes)

Your JS does **not** run on V8 or JavaScriptCore. It runs on **Hermes**, Meta's ahead-of-time-compiled JS engine.

**What this means practically**:
- The Metro bundler compiles your JS to Hermes **bytecode** (`index.hermes.bundle`), not source. This is why `vega build` doesn't pick up `src/` changes unless the bundle step runs — the `.bundle` in `build/lib/rn-bundles/` is the actual artifact packaged.
- **No JIT**. Performance characteristics differ from V8: slower for hot loops, faster startup, lower memory.
- **ES features**: Hermes supports most ES2022, but check before using exotic syntax. The `rn-get-polyfills.js` in react-native-kepler shows what's polyfilled.
- **Debugging**: Hermes supports the Chrome DevTools Protocol via `vega` debugging tools (`KeplerCLIDebuggingTools`, `KeplerCLIKeplerDebug` in the SDK).

---

## Part 6: The WebView (Chromium 118)

### Engine

The Kepler WebView is **Chromium** exposed as a React Native TurboModule (`AmazonWebViewTurboModule`, native lib `libkeplerscript-webview-lib-2.so`, UI component `/com.amazon.kepler.webview`).

**Version note**: Reports vary by SDK — Chromium 118 (SDK 0.24.12112, webview 4.0.2) vs. Chromium 144 (reported in giojump research doc for the same SDK/webview version). Verify with `navigator.userAgent` in your WebView at runtime; do not assume. Either way, you get a 2023+ era Chrome: HLS.js, DASH.js, and Shaka Player all work. Modern CSS (grid, flexbox, custom properties) works. WebGL2 and WebAudio are available.

**Never replace the User-Agent** (from screentinker): the Chromium token is used for adaptive stream selection (e.g., hls.js picks renditions based on it).

### Web APIs: what's available vs. limited

From the TypeScript source (`WebViewTypes.d.ts`):

**Available**:
- `window.ReactNativeWebView.postMessage(string)` — injected when `onMessage` is set
- Touch event synthesis (`dispatchTouchEvent`)
- Cookie management (`CookieManager` — RFC 6265, full cookie attributes)
- Geolocation permission (`PermissionType.GEOLOCATION` — the **only** permission type currently exposed)
- SSL error handling (`onSslError` with proceed/cancel)
- Client certificate auth (`onClientCertAuthentication`, PKCS#12)

**Notable limitations**:
- Only **one** permission type (geolocation). No camera/mic permission API surfaced.
- `thirdPartyCookiesEnabled` exists but is commented out in the template — likely restricted.
- `allowFileAccess` — "not needed to access assets in the /pkg/assets directory" (implying file access is sandboxed to the package).
- **Cleartext HTTP blocked by default** (WebView 4.0.2). To allow HTTP for specific domains:
  ```toml
  [network-traffic-policy.cleartext]
  allowed-domains = ["example.com"]
  ```
- Sandboxed filesystem layout: `/pkg` (read-only package), `/data` (app private), `/tmp` (scratch)

### The postMessage bridge pattern

```javascript
// In web page (tv.html):
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'PLAY_VIDEO',
  url: 'https://...'
}));

// In App.tsx:
<WebView
  onMessage={(event) => {
    const msg = JSON.parse(event.nativeEvent.data);
    if (msg.type === 'PLAY_VIDEO') {
      // Handle natively, e.g., launch PlayerSession
    }
  }}
/>
```

---

## Part 7: Input — The TV Remote

### Two input paths

**Path 1: Native (React Native)**
```javascript
import { useTVEventHandler } from 'react-native';

useTVEventHandler((event) => {
  // event.eventType: 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | ...
  // event.eventKeyAction: 0 (down) | 1 (up)
  if (event.eventType === 'back' && event.eventKeyAction === 0) {
    // Handle back
  }
});
```

**Path 2: Web (WebView)**
Set `allowSystemKeyEvents={true}` on the WebView, then handle `keydown` in JavaScript:
```javascript
document.addEventListener('keydown', (e) => {
  // e.keyCode: 37/38/39/40 (arrows), 13 (select), 27 (back), 179 (play/pause)
});
```
**Critical**: When `allowSystemKeyEvents` is `true`, system keys go **only** to the web layer, **not** to native. Only the most recent WebView instance receives them.

### Keycode reference (empirically observed)

| Remote button | keyCode | HWEvent type |
|---|---|---|
| Up | 38 | `up` |
| Down | 40 | `down` |
| Left | 37 | `left` |
| Right | 39 | `right` |
| Select/OK | 13 | `select` |
| Back | 27 (or 10009/461 on some firmware) | `back` |
| Menu | — | `menu` |
| Play/Pause | 179 | `playpause` |
| Rewind | 227 | `rewind` |
| Fast Forward | 228 | `forward` |

**Note**: Our TV dashboard handles Back via keycodes 27, 10009, and 461 — firmware variations exist.

### Remote-key hazards in production (from astra-tv)

Three hazards when handling remote keys:

1. **Double delivery**: The same keypress can arrive twice. Implement idempotency or debouncing.
2. **350ms dedupe window**: Async handlers that take longer than ~350ms can outlive the platform's duplicate-suppression window, causing the action to fire twice.
3. **Dual channels**: Skip buttons (and potentially others) fire on **both** the DPAD channel (`useTVEventHandler`) **and** the Kepler Media Controls channel (`PlayerSession`). If you handle both, guard against double-handling.

**MediaControl Menu-key capture** (from giojump): `allowsDefaultMediaControl={true}` (the default) causes the WebView to **capture the Menu key** for media controls. Set `allowsDefaultMediaControl={false}` if your app needs the Menu button.

### The back-button rule (from jellyfin-vega-os)

**Use `KeplerBackHandler`, not `useTVEventHandler`, for Back.** From the source:

> "`KeplerBackHandler` is used rather than a raw key listener because it is the only way to *consume* the press. Observing Back through `useTVEventHandler` leaves the platform's default in place, so the app closed even when there was somewhere to go back to. Returning `true` here claims the press; returning `false` at the root lets the platform close the app, which is the behaviour a TV user expects."

```tsx
import {useKeplerBackHandler} from '@amazon-devices/react-native-kepler';

const Router = () => {
  const navigation = useNavigation();
  const backHandler = useKeplerBackHandler();

  useEffect(() => {
    // Return true = I handled it (stay in app)
    // Return false = let platform close the app (at root)
    const subscription = backHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) {
        navigation.pop();
        return true;   // Consumed — don't close app
      }
      return false;    // At root — let platform close app
    });
    return () => subscription.remove();
  }, [backHandler, navigation]);
};
```

**Handle Back in exactly one place** (the router), not per-screen. This is the TV UX contract: Back navigates up the stack; Back at the root exits.

### Focus management

For pure RN apps: use `TVFocusGuideView` with `autoFocus`, or explicit `nextFocus*` props. For WebView apps: implement your own focus ring in JS (add/remove CSS classes on arrow key navigation), as we did in tv.html.

---

## Part 8: Media Playback

### Two playback paths

**Path 1: Web `<video>`** (simplest)
- Works with `allowsDefaultMediaControl={true}` for Kepler media session integration
- HLS.js / DASH.js / Shaka Player for adaptive streaming
- Codecs: H.264, H.265, VP9, AV1 (video); AAC, MP3, Dolby (audio) — per Amazon docs
- DRM: declare `com.amazon.drm.key` + `com.amazon.drm.crypto` services, use EME (Encrypted Media Extensions) in the web layer

**Path 2: PlayerSession API** (native, more control)
The `PlayerSession` module is Vega's equivalent of Android's MediaSession:
- `PlayerMediaOps` bitmask: PLAY, PAUSE, PREPARE, REWIND, SEEK_TO, SET_VOL, SHUFFLE, FF, STOP, SKIP_NEXT, SKIP_PREV, PLAY_URI, etc.
- `PlayerRepeatMode`: NONE, CURRENT, PLAYLIST
- `PlayerShuffleMode`: NONE, PLAYLIST_OFF, PLAYLIST_ON
- `PlayerSpeedMode`: -4x to +4x in 0.25x increments
- `PlayerTrackRating`: NONE through 5 stars, thumbs up/down
- Integrates with system transport controls (the overlay that appears when you press play/pause)

**Path 3: W3C Media API** (hardware decoding, pure RN)
The `@amazon-devices/react-native-w3cmedia` package exposes `VideoPlayer` and `MediaSource` — a W3C-standard media element API backed by the platform's **hardware decoders**. This is what the jellyfin-vega-os app uses, and it's the highest-performance option.

**Critical constraint** (from jellyfin-vega-os source): *"Vega OS 1.2 will not open a media URL directly — `set_src_uri` is rejected before any decoding is attempted."* You **must** use Media Source Extensions:
1. Fetch the HLS/DASH manifest in JavaScript
2. Parse it, select variants
3. Fetch segments as ArrayBuffers
4. `sourceBuffer.appendBuffer(bytes)` to push into the pipeline
5. The hardware decoder handles the rest

**Alternative: vendored players** (from astra-tv, finloop):
- **astra-tv** (on the Amazon Appstore) runs **vendored Shaka Player 4.8.5 inside a fake DOM** — 6 polyfills to make Shaka think it's in a browser, with a headless w3cmedia element as the render target
- **finloop/react-native-jellyfin-client** vendors **hls.js as `.mjs`** with polyfills
- **THEOplayer** uses its own TurboModule transmuxer for HLS-TS

These approaches work when you need a full-featured player (ABR, DRM, subtitles) without writing your own MSE pipeline. The tradeoff is bundle size and polyfill maintenance.

```typescript
import {MediaSource, VideoPlayer} from '@amazon-devices/react-native-w3cmedia';

const player = new VideoPlayer();
await player.initialize();

const mediaSource = new MediaSource();
// Fetch HLS manifest, parse, fetch segments...
const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
sourceBuffer.appendBuffer(segmentBytes);  // Hardware decodes from here

player.src = mediaSource;  // NOT a URL — a MediaSource object
await player.play();
```

**Why not just use a URL?** The platform team disabled direct URL loading (likely for DRM/security policy enforcement — all media must go through the app-controlled MSE pipeline where the app can enforce its own access control).

### Runtime capability detection

The W3C Media package exposes `decodingInfo` — the W3C Media Capabilities API. Query at runtime what the hardware can actually decode:

```typescript
import {decodingInfo} from '@amazon-devices/react-native-w3cmedia';

const info = await decodingInfo({
  type: 'file',
  video: {
    contentType: 'video/mp4; codecs="avc1.42E01E"',
    width: 1920,
    height: 1080,
    bitrate: 8_000_000,
    framerate: 30,
  },
});

if (info?.supported) {
  // Hardware can decode this configuration
}
```

**Why this matters**: The platform answers for a *concrete configuration* (resolution + bitrate + framerate), not a codec in the abstract. A device might decode 1080p H.264 but not 4K. Probe the configurations you actually need at startup, then request appropriate streams from your server.

**When to use which**: Web `<video>` for content apps (simpler, HLS.js handles ABR). PlayerSession when you need lock-screen-style transport controls, background audio, or Alexa "pause" voice commands. W3C Media when you need hardware decoding + pure RN (best performance, most code).

### Media stack internals (from Amazon docs)

**GStreamer** is the underlying media framework. The Vega media stack is:
- `VideoPlayer` (JS API) + `KeplerVideoView` (native view) — must call `initialize()` before use
- Hardware decoders via GStreamer plugins

**DRM matrix**:
- Widevine: L1 (hardware) / L3 (software)
- PlayReady: SL2000 / SL3000 / SL150

**Media controls three-tier enablement** (for `IMediaPlaybackServer`):
1. **Core** — play/pause always available
2. **Optional** via `command_options` — declare which commands you support
3. **Feature-gated** via `features` — FF/Rewind require `VariableSpeed` feature flag

---

## Part 9: App Lifecycle

From `KeplerAppStateManagerSpec.d.ts` source:

### States
- `active` — foreground, user interacting
- `background` — user in another app or on home screen
- `inactive` — transition state (rarely observed for RN apps)
- `unknown` — initial value before state is determined

### Events
- `change` — state transitioned
- `memoryWarning` — OS is low on memory, free caches NOW
- `focus` — user is interacting with the app
- `blur` — user is not actively interacting
- `reconfigure` — e.g., `homePressed`
- `displayChange` — display connected/disconnected (`displayConnected`/`displayDisconnected`)

### The background kill rule

From the WebView source docs: **"when app goes to background it can be killed anytime depending the system resource state."** There is no Android-style background service guarantee. If you need to complete work, do it in the `background` transition — don't assume you'll get CPU time afterward.

### Lifecycle mechanics (from Amazon docs)

**LCM** (Lifecycle Manager) tracks component states. Key behaviors:
- **Home-clears-backstack**: Pressing Home clears your navigation stack (unless you handle it)
- **Deep-link-preserves**: Launching via deep link preserves existing state

**CLI tools**:
- `vpm` — Vega Package Manager (install/uninstall packages)
- `vlcm` — Vega Lifecycle Manager (launch/terminate components, e.g., `vlcm launch-app`)
- `vmsgr` — Vega Messenger (send messages between components)

**Component shells**: Running components get a scratch directory at `/tmp/scratch/<package-id>/` — useful for debugging (inspect runtime state).

### Headless JS (from docs)

Vega supports headless JS (no UI), but it's a minefield:
- Only **deep-import** modules work (not top-level package imports)
- w3cmedia headless code lives in `/dist/headless`
- `DeviceInfo` **crashes in Release builds** (use guards)
- Chrome DevTools shows **only the most-recent JS context** — headless contexts are invisible

### Code pattern

```javascript
import { useKeplerAppStateManager } from 'react-native';

const manager = useKeplerAppStateManager();
useEffect(() => {
  const sub = manager.addEventListener('change', (state) => {
    if (state === 'background') {
      // Persist state NOW. You may be killed.
      saveAppState();
    }
  });
  return () => sub.remove();
}, []);
```

---

## Part 9.5: Storage — What Actually Persists

**Critical** (from jellyfin-vega-os empirical testing): Not all storage APIs work as expected on Vega OS 1.2:

| API | Status | Notes |
|---|---|---|
| `@amazon-devices/expo-file-system` | ✅ **Works** | Writes to `/data/` (app private dir). Survives restart. Cleared on uninstall. **Use this.** |
| `@amazon-devices/kepler-file-system` | ❌ **Broken** | `readFileAsString`/`writeStringToFile` fail with `IoError` for every path. Only `exists`, `getEntries`, `openFile` work. |
| `AsyncStorage` | ⚠️ **In-memory only** | Accepts writes, reads back within session, but **does not survive restart**. |
| WebView `localStorage` | ✅ Works | If `domStorageEnabled={true}`. Scoped to WebView, survives restart. |

```typescript
import * as FileSystem from '@amazon-devices/expo-file-system';

// Write
await FileSystem.writeAsStringAsync(
  `${FileSystem.documentDirectory}session.json`,
  JSON.stringify(session)
);

// Read
const raw = await FileSystem.readAsStringAsync(
  `${FileSystem.documentDirectory}session.json`
);
```

---

## Part 10: The VPKG Format

### Structure

A `.vpkg` is a **Zstandard-compressed** archive (not ZIP) containing:

```
manifest.toml                          # App manifest
bundle/index.bundle                    # Metro JS bundle (debug)
bundle/index.hermes.bundle             # Hermes bytecode (release)
bundle/assets/app.json                 # RN asset manifest
assets/image/icon.png                  # Launcher icon
assets/index.html                      # Bundled web assets (optional)
assets/raw/keplerscript-app-config.json # Native linkage config
assets/asset-index.bin                 # Asset index
assets/kepler-sdk-version              # SDK version marker
meta-info/build-info.json              # Build number, version, OS contract
meta-info/signature/digest             # Integrity digest
meta-info/signature/digest.sig         # Signature
```

### The keplerscript-app-config.json

This is generated at build time and declares the native linkage:

```json
{
  "schemaVersion": 1,
  "mainBundle": "index.hermes.bundle",
  "developmentEnabled": false,
  "linkLaunch": [],
  "linkDynamic": ["AmazonWebViewLib", "WebViewTurboModules"],
  "appLibraries": [...],
  "systemBundles": {
    "common": [
      "index.amzn__react-native-kepler-4.hermes.bundle",
      "index.amzn__webview-4.hermes.bundle"
    ]
  }
}
```

**Key insight**: `systemBundles` are shared OS-provided JS (React Native core, WebView component). Your VPKG only contains **your** code — the framework ships with the OS. This keeps VPKGs small (~150KB–800KB typical).

### Inspecting a VPKG

```bash
vega exec vpt show-contents app.vpkg    # List contents
vega exec vpt dump app.vpkg <path>      # Extract a file
vega exec vpt validate app.vpkg         # Validate (0 errors = good)
vega exec vpt info app.vpkg             # Package info
```

---

## Part 11: Devmode Under the Hood

### What devmode actually does

1. **Authentication**: `vega devmode login` uses Amazon's **LWA device flow** (`/auth/o2/create/codepair` → user enters code on amazon.com → `/auth/o2/token`). Tokens are stored in the OS keyring (or our custom Secret Service on headless Linux).

2. **Vendor verification**: `vega devmode list-vendors` queries Amazon Developer Services for your vendor record. Without a registered vendor, `enable-device` fails.

3. **Device enablement**: `vega devmode enable-device --code <CODE>` sends the on-screen TV code + your vendor ID to Amazon's servers. Amazon's backend then pushes a signed authorization to the Fire Stick, flipping its developer mode flag.

4. **ADB access**: Once enabled, the Fire Stick opens **port 5555** speaking the **ADB protocol**. The `vda` tool (Vega Device Adapter v2.6, Server Version 41) is ADB-compatible — `vda connect`, `vda devices`, `vda forward` all work.

### Security implications

- Devmode **disables signature verification** for sideloaded VPKGs. Any VPKG can be installed.
- Port 5555 is open on the local network. Anyone on the LAN can `vda connect` — **no authentication** by default (unless `vda pair` was used).
- **Recommendation**: Disable devmode when not actively developing, or use `vda pair` for secure TCP/IP.

---

## Part 12: Debugging

### Virtual Device

For development without physical hardware:

```bash
vega virtual-device start    # Start emulator (x86_64)
vega virtual-device status   # Check status
vega virtual-device stop     # Stop
```

The virtual device runs the x86_64 build of Vega OS. Deploy with `vega run-app app.vpkg --deviceId VirtualDevice`.

**Limitation**: Hardware decoding, DRM, and some media features behave differently on the emulator. Always test media on physical hardware.

### Logs

```bash
# Stream device logs
vega device start-log-stream --device <serial>

# Copy crash reports
vega device copy-logs --device <serial>

# Get log info
vega device get-log-info --device <serial>
```

### DevTools

The SDK includes `KeplerCLIDebuggingTools` and `KeplerCLIKeplerDebug`. For Hermes debugging, Chrome DevTools Protocol is supported — connect to the Hermes inspector.

**Debugging gotchas** (from docs):
- **Hybrid debugging**: Use kepler + keplerNative (GDB) configs together for JS + native
- `disableAppTimeout` defaults to **true** (app won't be killed during debug sessions)
- **CDT (Chrome DevTools) unsupported on RN 0.83** — use Hermes inspector directly
- **loggingctl**: Log sessions restart on reboot — re-establish after device restart

### Submission notes (from docs)

- **"Don't mention Vega"**: Appstore listings should not reference Vega OS specifically — market as Fire TV app
- **Versioning**: Same-listing updates vs. separate listings have tradeoffs; version codes and build numbers are independent and **both must increase** for updates

### Common issues

| Symptom | Cause | Fix |
|---|---|---|
| No launcher tile | Missing `icon` in manifest | Add 512×512 PNG, rebuild, reboot device |
| App shows old web content | Hermes bundle not rebuilt | Ensure Metro bundling ran; `vega build` uses cached `build/lib/rn-bundles/` |
| `vega run-app` says "no devices" | vda not connected | `vda connect <ip>:5555` first |
| Alexa "not supported" | Sideloaded apps aren't in Alexa's registry | Expected; use launcher tile instead |
| Back button doesn't work in WebView | `allowSystemKeyEvents` is false | Set `allowSystemKeyEvents={true}` |
| Video won't autoplay | `mediaPlaybackRequiresUserAction` default true | Set to `false` |
| JS stops in background | Background execution disabled | Set `allowJavaScriptInBackground`, but don't rely on it |

---

## Part 13: Distribution and Updates

### Sideloading (development)

```bash
vda connect <fire-stick-ip>:5555
vega run-app app.vpkg --deviceId <ip>:5555 [appId]
```

### Appstore submission

1. Vendor record must be active (we have `M3LH42DOKX7GYG` / "Seth Kellner Photography")
2. VPKG must pass `vpt validate` with 0 errors
3. Submit through the Amazon Developer Console (developer.amazon.com)
4. Amazon reviews (content policy, stability, performance)
5. Updates: increment `build_number`, resubmit. The Appstore handles delta updates.

### Self-updating sideloaded apps

For apps not in the Appstore, implement in-app updates:
1. Web layer fetches a version manifest from your server (e.g., GitHub Pages)
2. If newer version exists, show update prompt
3. Download new VPKG → use native module to trigger install
4. **Caveat**: Sideloaded update still requires devmode. There's no silent self-update for sideloaded apps.

---

## Part 14: Project Structure and Build

### Template structure

```
vega-app/
├── manifest.toml          # App manifest
├── package.json           # NPM + kepler config (projectType, targets)
├── src/
│   └── App.tsx            # React Native entry
├── assets/
│   ├── image/icon.png     # Launcher icon (512×512)
│   ├── index.html         # Bundled web content (optional)
│   └── raw/               # Raw assets
├── build/                 # Build output (gitignored)
│   └── lib/rn-bundles/Release/index.bundle  # THE JS bundle that gets packaged
└── dist/
    └── missioncontrol_armv7.vpkg  # Final package
```

### The critical build insight

`vega build` does **not** always regenerate the JS bundle from `src/`. It uses the cached bundle in `build/lib/rn-bundles/`. If you change `App.tsx` and the VPKG doesn't reflect it:

1. Delete `build/` and rebuild, OR
2. Manually verify the bundle contains your changes: `grep "your-string" build/lib/rn-bundles/Release/index.bundle`

### Build commands

```bash
# Full build
vega build --target armv7 --buildType Release --build-number N

# Validate
vega exec vpt validate dist/app_armv7.vpkg

# Deploy
vega run-app dist/app_armv7.vpkg --deviceId <ip>:5555
```

### The KMMB mechanism (manifest auto-generation)

Your `manifest.toml`'s `[needs.module]` section is **not** hand-maintained — it's generated at build time by **KMMB** (Kepler Module Manifest Builder, `@amazon-devices/kepler-module-manifest-builder`).

**How it works**:
1. KMMB scans your `node_modules/` for `@amazon-devices/*` packages
2. Each package declares its Kepler API requirements in its `package.json` (`kepler` key) and `kepler-compatibility.json`
3. KMMB writes the "module ladder" — the `[[needs.module]]` entries like `/com.amazon.kepler.webview_4@IWebview_4` — ensuring the OS version you install on provides those module interfaces
4. `vega project update-manifest` regenerates this manually; otherwise it happens during `vega build`

**Backward compatibility**: `kmmb query <libraryName>` lists which older OS versions your app can target. You build once against the latest SDK, and KMMB ensures the manifest declares the minimum module versions needed — so the same VPKG installs on older Vega OS releases that provide those interfaces.

**Practical rule**: Don't hand-edit `[needs.module]`. Edit `[wants.service]`, `[needs.privilege]`, and `[components]` — let KMMB handle the module ladder.

### Project templates

`vega project list-templates` shows the starting points:

| Template | Purpose |
|---|---|
| `helloWorld` | Basic RN app (targets RN 0.83 / Kepler 4) |
| `helloWorld-rn72` | Basic RN app (targets RN 0.72 — older Kepler) |
| `vegaWebview` | WebView shell app (what Mission Control uses) |
| `basic-turbo-module` | Custom native TurboModule with stubs for your own native logic |
| `idl-turbo-module` | TurboModule bound to native OS APIs defined in IDL (Interface Definition Language) |

**Custom native modules**: If you need functionality beyond what Kepler exposes (e.g., custom hardware access), use `basic-turbo-module` to write C++ + TypeScript bindings. The `keplerscript-turbomodule-api` package provides the codegen (`cli.js`) that generates the native glue from your TypeScript spec — same pattern as React Native's TurboModule codegen, adapted for KeplerScript.

```bash
vega project generate --template vegaWebview --name MyApp
```

---

## Part 15: Code Patterns

### Minimal WebView app (App.tsx)

```tsx
import {WebView} from '@amazon-devices/webview';
import * as React from 'react';
import {useRef} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  useHideSplashScreenCallback,
  usePreventHideSplashScreen,
} from '@amazon-devices/react-native-kepler';

export const App = () => {
  const webRef = useRef(null);
  usePreventHideSplashScreen();
  const hideSplashScreenCallback = useHideSplashScreenCallback();

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        style={styles.webview}
        allowSystemKeyEvents          // Back button → web JS
        allowsDefaultMediaControl     // Kepler media session
        domStorageEnabled
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}  // Autoplay
        mixedContentMode="compatibility"
        source={{ uri: "https://example.com/tv.html" }}
        onLoad={() => hideSplashScreenCallback()}
        onMessage={(event) => {
          const msg = JSON.parse(event.nativeEvent.data);
          // Handle messages from web
        }}
        injectedJavaScriptBeforeContentLoaded={`
          // Runs before page scripts. Ideal for viewport/keyboard polyfills.
          window.IS_VEGA_TV = true;
        `}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  webview: {backgroundColor: '#000000'},
});
```

### TV remote handling in web (tv.html)

```javascript
// Focus management for DPAD navigation
let focusIndex = 0;
const cards = document.querySelectorAll('.card');

function setFocus(i) {
  cards[focusIndex]?.classList.remove('focused');
  focusIndex = Math.max(0, Math.min(cards.length - 1, i));
  cards[focusIndex]?.classList.add('focused');
  cards[focusIndex]?.scrollIntoView({block: 'nearest'});
}

document.addEventListener('keydown', (e) => {
  switch(e.keyCode) {
    case 37: setFocus(focusIndex - 1); break;      // Left
    case 39: setFocus(focusIndex + 1); break;      // Right
    case 38: setFocus(focusIndex - COLS); break;   // Up
    case 40: setFocus(focusIndex + COLS); break;   // Down
    case 13: activateCard(focusIndex); break;      // Select
    case 27: case 10009: case 461: goBack(); break; // Back (firmware variants)
    case 179: togglePlayPause(); break;           // Play/Pause
  }
  e.preventDefault();
});
```

### Native remote handling (pure RN)

```javascript
import { useTVEventHandler } from 'react-native';

function RemoteHandler() {
  useTVEventHandler((event) => {
    if (event.eventKeyAction !== 0) return; // Only key-down
    switch (event.eventType) {
      case 'up': moveFocus('up'); break;
      case 'down': moveFocus('down'); break;
      case 'select': activateFocused(); break;
      case 'back': navigateBack(); break;
      case 'playpause': togglePlayback(); break;
    }
  });
  return null;
}
```

### The canonical Focusable pattern (from jellyfin-vega-os)

This is the production-tested pattern for TV focus in pure RN Vega apps:

```tsx
import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {Pressable, View} from 'react-native';

export const Focusable = forwardRef(({children, onPress, autoFocus, ...props}, ref) => {
  const [focused, setFocused] = useState(false);
  const viewRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.requestTVFocus?.(),
  }));

  useEffect(() => {
    if (!autoFocus) return;
    // Deferred a frame: requesting focus during the first layout pass is
    // dropped, because the native view does not exist yet.
    const frame = requestAnimationFrame(() => viewRef.current?.requestTVFocus?.());
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  return (
    <Pressable
      ref={viewRef}
      focusable
      hasTVPreferredFocus={autoFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      {...props}>
      {children(focused)}
    </Pressable>
  );
});
```

**Key insights**:
- `hasTVPreferredFocus` marks the initial focus target
- `requestTVFocus()` must be deferred a frame — the native view doesn't exist during first layout
- The render-prop `children(focused)` lets each tile draw its own focus ring
- Platform handles spatial navigation (arrow keys move focus automatically); you only handle `onPress` and visual state

### Imperative focus control (FocusManager)

For programmatic focus management beyond the declarative props:

```typescript
import {FocusManager} from 'react-native';

// Get currently focused view
const focusedTag = FocusManager.getFocused();

// Imperatively focus a view
FocusManager.focus(viewTag);

// Define focus graph programmatically
FocusManager.setNextFocus(fromTag, toTag, 'right');
FocusManager.clearNextFocus(fromTag, 'right');

// Define focus scopes (focus stays within root until explicitly moved out)
FocusManager.setFocusRoot(containerTag, true);
```

Use this when the declarative `nextFocus*` props aren't flexible enough (e.g., dynamic grids where the focus graph changes at runtime).

### Focus algorithm (from Amazon docs)

The platform uses a **Cartesian weighted-distance algorithm** for spatial navigation:
- Ignores Z-order (pure 2D geometry)
- Precedence: direction match (3) > axis alignment (2) > distance (1)
- **No platform focus restoration** — if the focused view unmounts, focus is lost (you must restore it)
- **Synchronous focus** is opt-in and blocks the UI thread — use carefully

### App lifecycle handling

```javascript
import { useKeplerAppStateManager } from 'react-native';
import { useEffect } from 'react';

function LifecycleHandler() {
  const manager = useKeplerAppStateManager();

  useEffect(() => {
    const sub = manager.addEventListener('change', (state) => {
      if (state === 'background') {
        persistState(); // Save NOW — may be killed
      } else if (state === 'active') {
        refreshData();
      }
    });
    const memSub = manager.addEventListener('memoryWarning', () => {
      clearCaches(); // Free memory immediately
    });
    return () => { sub.remove(); memSub.remove(); };
  }, []);

  return null;
}
```

---

## Appendix: Key File Paths (SDK 0.24.12112)

| Path | Contents |
|---|---|
| `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/` | SDK root |
| `.../workspace/env/VegaPackagingTool-1.0/runtime/bin/vpt` | Packaging tool |
| `.../workspace/env/KeplerCLIVegaDeviceAdaptor-2.0/runtime/bin/vda` | Device adapter (ADB-compatible) |
| `.../workspace/env/KeplerCLI-2.0/` | Kepler CLI tools |
| `~/workspace/vega-app/node_modules/@amazon-devices/react-native-kepler/` | RN Kepler 4.0.1 (RN 0.83 fork) |
| `~/workspace/vega-app/node_modules/@amazon-devices/webview/` | WebView 4.0.2 (Chromium 118) |
| `~/workspace/vega-app/node_modules/@amazon-devices/keplerscript-turbomodule-api/` | TurboModule codegen |

---

## Appendix: Research Sources

- Vega CLI 1.4.2 binary strings (`devmodecli` package: `golang.a2z.com/KeplerDeveloperAuth/devmodecli`)
- `WebViewTypes.d.ts` — full WebView API surface with inline docs
- `TVTypes.d.ts` — HWEvent types (all remote buttons)
- `KeplerAppStateManagerSpec.d.ts` — lifecycle states and events
- `UserInputManager.d.ts` — input event names
- `PlayerSessionTypes.d.ts` — media session API
- `IAlexaManager.d.ts` — Alexa Voice Service integration
- `keplerscript-app-config.json` — runtime linkage model
- VPKG binary inspection via `vpt show-contents` / `vpt dump`
- Amazon Vega developer documentation (see vega-docs-synthesis.md)
- Open-source Vega apps (see vega-github-apps.md):
  - jonathanlemes/jellyfin-vega-os — pure RN Jellyfin client, W3C Media MSE pipeline
  - AmbientFlare/astra-tv — Appstore Jellyfin client, Shaka in fake DOM, IMediaPlaybackServer
  - screentinker/screentinker — WebView signage, lifespan/timeout-secs
  - giolaq/giojump — WebView game packaging research
  - finloop/react-native-jellyfin-client — vendored hls.js
  - finloop/react-native-kepler-udp — community UDP TurboModule
  - THEOplayer/react-native-optiview-vega-sample — reference manifest
  - efahsl/vega-developer-workshop-for-tv-apps, galaxies-dev/vega-react-native-demo

---

*End of guide. For the original authentication/keyring research, see KEYRING-GITHUB-RESEARCH.md. For the CLI/SDK architecture overview, see VEGA-GENIUS.md.*
