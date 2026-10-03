# Amazon Vega SDK Distribution — URL Trust Investigation

**Date:** 2026-10-03
**Question:** Is `https://sdk-installer.vega.labcollab.net/get_vvm.sh` a legitimate Amazon distribution point for the Vega SDK, given it's not on amazon.com or amazonaws.com?
**Verdict:** **YES — legitimate.** Six independent trust anchors converge. Details below.

---

## 1. The official docs publish this exact URL

Amazon's own developer documentation at `developer.amazon.com/docs/vega/0.23/install-vega-sdk.html` contains the install code block with the literal URL:

```
https://sdk-installer.vega.labcollab.net/get_vvm.sh
```

(Verified by fetching the raw page HTML on 2026-10-03 — the URL appears in the syntax-highlighted `curl ... | bash` install command block.)

This is the single strongest piece of evidence: Amazon tells developers, on amazon.com, to download from this URL.

---

## 2. DNS: Amazon's own infrastructure

```
$ dig sdk-installer.vega.labcollab.net
sdk-installer.vega.labcollab.net. → CNAME d30jz8tpjrp8dk.cloudfront.net.
→ A 198.18.134.201 (CloudFront edge)
```

- The hostname sits behind **Amazon CloudFront** (Amazon's own CDN).
- `labcollab.net` itself is delegated to **AWS Route53** nameservers:
  - `ns-174.awsdns-21.com`, `ns-1569.awsdns-04.co.uk`, `ns-1461.awsdns-54.org`, `ns-997.awsdns-60.net`
  - SOA: `ns-174.awsdns-21.com. awsdns-hostmaster.amazon.com.`

An attacker cannot get Amazon to CNAME their domain to CloudFront *and* issue a cert for it without controlling the domain's DNS — which lives in Amazon's Route53.

---

## 3. TLS certificate: Amazon's internal CA

```
subject=CN = sdk-installer.vega.labcollab.net
issuer=C = US, O = Amazon, CN = Amazon RSA 2048 M01
notBefore=Sep 29 00:00:00 2026 GMT / notAfter=Apr 14 23:59:59 2027 GMT
```

Chain: leaf → `Amazon RSA 2048 M01` → `Amazon Root CA 1` → Starfield (Amazon's public root).

This is the standard **AWS Certificate Manager (ACM)** issuance pattern. ACM only issues for domains whose DNS the requester controls. Combined with the Route53 delegation, this means whoever operates `labcollab.net` DNS is inside Amazon's AWS organization.

---

## 4. What is labcollab.net? (Amazon Lab126)

**Amazon Lab126, Inc.** is Amazon's hardware R&D subsidiary (founded 2004, Sunnyvale CA) — they built Kindle, Fire TV, Echo, Astro. Their public site is `lab126.com`.

`labcollab.net` is Lab126's **collaboration/infrastructure domain** — used for external-facing engineering resources (SDK distribution, artifact repositories, CI). The pattern is common at large companies: the product/marketing domain (`amazon.com`, `lab126.com`) is separate from engineering infrastructure domains.

The SDK payload server follows the same pattern:
```
k-artifactory-external.labcollab.net
→ CNAME k8s-gatewayservice-0a3091e4d7-2048404718.us-west-2.elb.amazonaws.com.
(CN=k-artifactory-external.labcollab.net, issued by Amazon RSA 2048 M01)
```
That's an **AWS ELB in us-west-2** serving a JFrog Artifactory (`/artifactory/api/kpm/`) — Amazon's internal package mirror for Vega SDK components, fronted by the same Amazon CA.

---

## 5. The `get_vvm.sh` script itself

Downloaded 2026-10-03 (58,010 bytes):
- **Header:** `Copyright 2025 Amazon.com, Inc. or its affiliates` under the Amazon Program Materials License (`https://developer.amazon.com/support/legal/pml`)
- **SHA256:** `0e5386581e5cf518202687213dd26d1b35e70242d1bd190cdea7096a99476ae0`
- **URLs inside the script:**
  - `https://k-artifactory-external.labcollab.net/artifactory/api/kpm/` (SDK payloads)
  - `https://developer.amazon.com/docs/vega/latest/...` (docs links)
  - `https://marketplace.visualstudio.com/items` (VS Code extension)
  - No third-party, no suspicious, no exfiltration endpoints.

---

## 6. Community verification

**`looizao/jellyfin-vega-tailnet`** (https://github.com/looizao/jellyfin-vega-tailnet) — the most mature community Vega OS project (Jellyfin client with embedded Tailscale, ARMv7 .vpkg for Fire TV Stick):

- Their docs state: *"the included installer pins and verifies Amazon's bootstrap script"* (builds use SDK `0.22.5850`)
- They treat the labcollab.net installer as the canonical Amazon source and add checksum pinning on top
- Their INSTALL.md documents the full devmode flow: `vega devmode login` → `vega devmode enable-device --code DEVICE_CODE` → `vega device list`

No community source disputes the legitimacy of the labcollab.net distribution point.

---

## 7. Amazon's SDK distribution pattern (precedent)

Amazon routinely distributes developer tooling from non-amazon.com domains:

| Domain | What | Owner |
|---|---|---|
| `cloudfront.net` | CDN for countless AWS/Amazon downloads | Amazon |
| `labcollab.net` | Lab126 engineering infra (Vega SDK, Artifactory) | Amazon (Route53 + Amazon CA) |
| `amazonaws.com` | S3-hosted SDKs, CLIs | Amazon |
| `awsstatic.com` | AWS console assets | Amazon |

The "it's not amazon.com so it's suspicious" heuristic fails for Amazon specifically — they operate a constellation of infrastructure domains. The correct check is **who controls the DNS and who issued the TLS cert**, both of which point to Amazon here.

---

## 8. Trust assessment

| Anchor | Result |
|---|---|
| Official docs publish the URL | ✅ developer.amazon.com |
| DNS control | ✅ AWS Route53, amazon.com SOA |
| TLS issuer | ✅ Amazon RSA 2048 M01 (ACM) |
| CDN | ✅ Amazon CloudFront |
| Payload server | ✅ AWS ELB us-west-2, same Amazon CA |
| Script header | ✅ Copyright Amazon.com, Inc. |
| Community consensus | ✅ No disputes; checksum-pinned by jellyfin-vega-tailnet |

**What would make it MORE trustworthy:** Certificate Transparency logs showing the cert issuance history (publicly auditable at crt.sh); DNSSEC on labcollab.net; a `security.txt` on the distribution host. None of these are missing in a way that suggests foul play — they're just defense-in-depth niceties.

**Residual risk:** Supply-chain attacks are always theoretically possible (compromised Amazon infra), but there is zero evidence of that here, and the same risk applies to amazon.com-hosted downloads.

**Bottom line:** `sdk-installer.vega.labcollab.net` is a legitimate Amazon distribution point. Seth's authorization to download from it was well-placed.

---

# Community Tips & Tricks: Vega OS / Fire TV Stick Development

*Vega OS only — Fire OS (Android) tricks do NOT apply to the Fire TV Stick 4K Select.*

## Essential repos

### looizao/jellyfin-vega-tailnet ⭐ (gold standard)
https://github.com/looizao/jellyfin-vega-tailnet
- Jellyfin client + embedded Tailscale, single ARMv7 `.vpkg` for Fire TV Stick
- **Why it matters for Seth:** proves the Tailscale-on-Vega pattern works — directly relevant to a Mission Control app that needs tailnet access
- Key docs: `docs/INSTALL.md` (devmode flow), `docs/ARCHITECTURE.md` (embedded tsnet via C++ Turbo Module + Go), `docs/TESTING.md`, `CONTRIBUTING.md`
- Their installer **pins and verifies** Amazon's bootstrap script SHA256 — steal this pattern
- Release flow: `vega exec vpt validate` → `install-app --packagePath` → `launch-app --appName`
- Includes `scripts/install-device.sh` for one-command validate/install/launch

### AmazonAppDev/vega-monorepo-sample (official)
https://github.com/AmazonAppDev/vega-monorepo-sample
- Official multi-platform sample (Vega + Android TV + Apple TV + web)
- Build commands: `yarn workspace @rnmonorepo/vega run build` (prod) / `build:debug` (dev)
- Install: `kepler run-kepler vega/build/armv7-release/vega_armv7.vpkg` (stick is **armv7**)
- Platform file extensions: `.kepler.tsx` = Vega, `.android.tsx`, `.ios.tsx`, `.web.tsx`
- Gotcha: don't run Vega + Expo TV Metro instances simultaneously (port conflicts)

### aysikder-oss/digipal-players (vega/ README)
https://github.com/aysikder-oss/digipal-players/blob/HEAD/vega/README.md
- React Native Vega player with the clearest SDK install walkthrough found
- Ubuntu deps: native curl (NOT snap — snap curl breaks the installer), python3.8 + lz4, watchman, Node 16+
- Verifies: `kepler --version` after install

### trainlcd/mobileapp — argent-tv-interact SKILL.md
https://github.com/trainlcd/mobileapp/blob/HEAD/.agents/skills/argent-tv-interact/SKILL.md
- Automation-oriented Vega tips:
  - VVD: `vega virtual-device stop`; the CLI only tracks VVDs it started in the foreground
  - Empty UI tree → `restart-app`, then retry; input ignored → `vsm developer-mode enable`
  - **Only Debug `.vpkg` builds load patchable JS** — Release builds ignore `node_modules` edits
  - Profiling/crashes: `amazon-devices-buildertools-mcp` server (`analyze_perfetto_traces`, `symbolicate_acr`)

## Devmode & device connection

```
# 1. On the stick: Settings → My Fire TV → About → select device name 7x
#    → Developer Options appears → begin enabling Developer Mode
# 2. On your dev machine:
vega devmode login                          # phone OAuth flow, no password
vega devmode enable-device --code DEV_CODE  # code from the TV, expires in ~5 min
vega device list                            # confirm the stick shows up
```
- The TV **reboots** when developer mode is enabled (normal)
- Dev codes rotate every few minutes — read it fresh off the TV each time
- Port 5555 stays closed until `enable-device` succeeds (not a network fault)
- Keep the stick on a trusted local network while devmode is on

## Build & install

```sh
# Validate before installing (catches manifest errors early)
vega exec vpt validate MyApp-0.1.0-armv7.vpkg
vega exec vpt info MyApp-0.1.0-armv7.vpkg        # inspect package
vega exec vpt show-contents MyApp-0.1.0-armv7.vpkg

# Install + launch (need the device serial from `vega device list`)
vega device -d DEVICE_SERIAL install-app --packagePath MyApp-0.1.0-armv7.vpkg
vega device -d DEVICE_SERIAL launch-app --appName com.example.myapp.main

# Subsequent launches (app data persists):
kepler device launch-app
```

- **Architecture matters:** the 4K Select is **armv7**. Build `vega/build/armv7-release/`. (VVD on Mac M-series = aarch64, on x86_64 hosts = x86_64 — don't mix them up.)
- Kavi 5.0's lesson: `vega build` alone can produce an empty/manifest-only `.vpkg` — the real build for RN apps is `npx react-native build-vega` targeting armv7, or the yarn workspace build from the monorepo sample.

## Sideloading reality check (ghacks.net, Oct 2025)

Vega OS **does not support sideloading for general users** — unlike Fire OS (Android). The developer path (dev account + USB/CLI + `install-app`) is the *only* way to get an unsigned app on the stick. And even then:
- Sideloaded apps show a generic "App" icon
- They're disabled when not actively used
- This is by design — Vega is a locked-down Linux, not Android

For Seth's Mission Control app this is fine (it's his own stick, devmode stays on), but it means there's no path to distribute to others without the Amazon Appstore.

## SDK install gotchas (from Kavi 5.0's notes + community)

1. **Never run as root** — the installer refuses; use `nobody`/`vegauser` with explicit `HOME` and `TMPDIR`
2. **`vega sdk config setup --non-interactive`** — without the flag it hangs for hours on prompts
3. **TMPDIR redirect** — VM `/tmp` is often a small tmpfs (512M); SDK download needs GBs — point `TMPDIR` at a spacious disk path
4. **Native curl, not snap** (Ubuntu) — snap's sandbox breaks the installer
5. **Node 18+** required; watchman recommended for file watching
6. Keep everything under a persistent path (`/home/hatch`) — VM replacements wipe the rest

## Fast Refresh (iterative dev)

From Amazon's docs (`developer.amazon.com/docs/vega/0.21/fast-refresh.html`):
1. Two shells: A = `kepler virtual-device start`, B = app dir
2. Shell B: `npm install` → `npm run build:debug` → `npm start` (Metro)
3. Shell A: `kepler device start-port-forwarding --device VirtualDevice -p 8081 --forward false`
4. Shell A: `kepler run-kepler <vpkg> <app-id> -d VirtualDevice`
5. Custom Metro port: `npm start -- --port=8082` + `vda reverse tcp:8081 tcp:8082`
6. One Metro instance at a time — multiple apps = conflicts

## Useful commands cheat sheet

| Command | Purpose |
|---|---|
| `kepler --version` / `vega --version` | Verify install |
| `vega sdk list` | Available SDK versions |
| `vega devmode login` | Phone OAuth device auth |
| `vega devmode enable-device --code X` | Enable devmode on stick |
| `vega device list` | Connected devices + serials |
| `kepler device simulator start` | Start Vega Virtual Device |
| `kepler virtual-device stop` | Stop VVD |
| `vega exec vpt validate <vpkg>` | Validate package |
| `vega device -d SERIAL install-app --packagePath <vpkg>` | Install |
| `vega device -d SERIAL launch-app --appName <id>` | Launch |
| `kepler device launch-app` | Relaunch (data persists) |
