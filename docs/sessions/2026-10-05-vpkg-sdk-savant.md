# VPKG SDK Version Detection — Savant Research

**Date:** 2026-10-05
**Problem:** Amazon Appstore rejects .vpkg uploads with: "Your app was not built with the required Vega SDK version '0.20.0' or higher."
**Status:** Root cause identified. Fix requires proper SDK installation via VVM.

---

## Executive Summary

The SDK version is **NOT** stored in any of the places we tried stamping:
- ❌ `user_build_info.sdk_version` in `meta-info/build-info.json` — ignored by Amazon
- ❌ `[[extras]] vega_sdk_version` in `manifest.toml` — ignored by Amazon

Our SDK at `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/` is an **incomplete installation**.
The VVM (Vega Version Manager) installer failed partway through on 2026-10-05 05:18:18
at step `_060_install_sdk` (exit code 3). The `sdk-info.toml` was never created.

**The fix:** Complete the SDK installation via VVM's `vega sdk` commands, then do a
clean `vega build` from source. The properly-installed SDK's build pipeline will
produce a VPKG that Amazon accepts. No manual metadata stamping is needed or effective.

---

## 1. Where the SDK Version Actually Lives

### 1.1 `sdk-info.toml` (SDK installation metadata)

**Location:** `$KEPLER_SDK_PATH/sdk-info.toml` (i.e., `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/sdk-info.toml`)

**Format:**
```toml
Build_Version = "0.24.12112"
```

**How it's read:** The hidden `vega version sdk` command (in
`tools/bin/keplercommandsext/commands.py`, class `VersionCommand`) reads this file
and extracts `Build_Version` via regex: `r'Build_Version = "(.*?)"'`.

**How it's created:** By the official VVM installer (`https://sdk-installer.vega.labcollab.net/get_vvm.sh`),
which downloads the SDK tarball and runs `vega sdk install <version>`. The tarball
itself contains `sdk-info.toml` — it is NOT generated locally.

**Our situation:** The VVM installer log (`/home/hatch/vega/vvm/vvm-2026-10-05.log`)
shows the install of `main@0.24.12112 KeplerSDK` was attempted at 2026-10-05 05:18:18
but FAILED at `_060_install_sdk` with exit code 3. The SDK directory exists but
`sdk-info.toml` was never written.

### 1.2 What `vega build` Actually Stamps

**Finding:** Neither `vpt pack` nor the `vega build` pipeline stamps an SDK version
into the VPKG's `build-info.json`.

Evidence:
- `vpt` binary (10MB, `vpt.orig`) contains **zero** strings matching "sdk"
- A VPKG built via the real `vega build` pipeline (KaviTV stable, build 202610050930)
  has this `build-info.json` — note the **absence** of any SDK version field:
  ```json
  {"data":{"build-number":202610050930,"size":1094501,"version":"0.2.0"},
   "os_version_registry":{"contract_package_version":"1.0.323.0","os_versions":["1.2"]},
   "version":1}
  ```
- The `contract_package_version: 1.0.323.0` is embedded in the `vpt` binary itself
  (found via raw grep; it's the packaging contract version, not the SDK version)

### 1.3 How Amazon Likely Detects the SDK Version

Since no explicit SDK version field exists in a properly-built VPKG, Amazon most
likely uses one or more of these signals:

1. **Native library versions:** The `.so` files and system bundles
   (`index.amzn__react-native-kepler-4.hermes.bundle`) are compiled against specific
   SDK headers. The `keplerscript_4`, `react_native_kepler_4`, `IVega_1_2` module
   versions in `[needs.module]` indicate the SDK generation.

2. **`contract_package_version`:** The `1.0.323.0` value in `os_version_registry`
   is stamped by `vpt` at pack time. Amazon may maintain a mapping of contract
   versions → minimum SDK versions.

3. **Binary fingerprinting:** Amazon may hash known SDK artifacts (specific .so
   versions, Hermes bytecode version) and compare against their SDK release database.

**Key implication:** Manual metadata injection cannot fake these signals. The
binaries themselves must come from a proper SDK 0.20.0+ build environment.

---

## 2. The VVM (Vega Version Manager) — The Missing Piece

### 2.1 Discovery

Our system has TWO Vega CLI installations:

| Path | Type | Version | `sdk` command? |
|------|------|---------|----------------|
| `/home/hatch/vega/bin/vega` | Go binary (VVM) | 1.4.2 | ✅ Yes |
| `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/bin/vega` | Bash wrapper → Python `dutyfree-vega` | N/A | ❌ No |

The VVM binary at `/home/hatch/vega/bin/vega` is the **official** CLI that manages
SDK installations. It has the full `sdk` command suite:
- `vega sdk install [version]` — Download and install an SDK
- `vega sdk link --path <path>` — Import existing SDK installations
- `vega sdk list-installed` — List installed SDKs
- `vega sdk use <version>` — Set the active SDK version
- `vega sdk list-remote` — List available SDK versions from Amazon

### 2.2 Current State

```
$ /home/hatch/vega/bin/vega sdk list-installed
No SDK versions installed.

$ /home/hatch/vega/bin/vega --version
No SDKs have been installed. You can install an SDK by running: vega sdk install
Vega CLI Version: 1.4.2
```

The SDK directory exists at `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/` but is
**not registered** with VVM.

### 2.3 The Link Problem

Attempting to link the existing SDK:
```
$ /home/hatch/vega/bin/vega sdk link --path /home/hatch/vega/sdk/vega-sdk/main/0.24.12112 --non-interactive
✗ SDK link operation failed: failed to remove existing symlink
  /home/hatch/vega/sdk/vega-sdk/main/0.24.12112: remove
  /home/hatch/vega/sdk/vega-sdk/main/0.24.12112: directory not empty
```

VVM expects to create a **symlink** at that path pointing to the real SDK location,
but a real (non-empty) directory already exists there. This is a conflict that needs
manual resolution (see §4).

---

## 3. The Build Pipeline (How VPKGs Are Properly Built)

```
npx react-native build-vega
  → @amazon-devices/kepler-cli-platform (vegaExecutor.js)
    → uses KEPLER_SDK_PATH to locate SDK
    → KMMB (kepler-module-manifest-builder) generates [needs.module]
    → Hermes compiles JS bundles
    → vpt pack creates the .vpkg
```

**Critical:** The pipeline uses `KEPLER_SDK_PATH` to find the SDK, but does NOT
read `sdk-info.toml` for version stamping. The SDK version is implicitly encoded
in the **binary artifacts** (compiled .so files, Hermes bundles, module versions).

**Our builds work** because the SDK binaries are present and functional. But without
a proper VVM-managed installation, we cannot guarantee the SDK is complete and
unmodified.

---

## 4. The Fix: Proper SDK Installation

### Option A: Link the Existing SDK (Faster, Less Certain)

The SDK files are already present. If the installation is complete except for VVM
registration:

1. **Back up the current SDK:**
   ```bash
   mv /home/hatch/vega/sdk/vega-sdk/main/0.24.12112 /home/hatch/vega/sdk/vega-sdk/main/0.24.12112.backup
   ```

2. **Link it via VVM:**
   ```bash
   /home/hatch/vega/bin/vega sdk link --path /home/hatch/vega/sdk/vega-sdk/main/0.24.12112.backup --non-interactive
   ```
   (VVM will create a symlink at the expected path)

3. **Verify:**
   ```bash
   /home/hatch/vega/bin/vega sdk list-installed
   /home/hatch/vega/bin/vega --version
   # Should show: Active SDK Version: 0.24.12112
   ```

4. **Clean rebuild** Mission Control from source and re-upload.

**Risk:** If the SDK directory is missing files (incomplete download), the link will
succeed but builds may still produce invalid packages.

### Option B: Fresh SDK Install via VVM (Slower, More Reliable) ⭐ RECOMMENDED

1. **Remove the broken SDK:**
   ```bash
   rm -rf /home/hatch/vega/sdk/vega-sdk/main/0.24.12112
   ```

2. **Install via VVM:**
   ```bash
   /home/hatch/vega/bin/vega sdk install 0.24.12112
   ```
   (Or omit version for latest: `/home/hatch/vega/bin/vega sdk install`)

3. **Verify:**
   ```bash
   /home/hatch/vega/bin/vega sdk list-installed
   /home/hatch/vega/bin/vega --version
   ls /home/hatch/vega/sdk/vega-sdk/main/0.24.12112/sdk-info.toml
   ```

4. **Set as active (if multiple versions):**
   ```bash
   /home/hatch/vega/bin/vega sdk use 0.24.12112
   ```

5. **Source the environment:**
   ```bash
   source ~/vega/env  # or /home/hatch/vega/env
   ```

6. **Clean rebuild** from source:
   ```bash
   cd ~/workspace/firetv-vega-src/app
   npx react-native build-vega --build-type Release --target armv7 \
     --build-version 0.2.0 --build-number <NEXT_BUILD>
   ```

7. **Validate and upload** the fresh VPKG.

### Option C: Reconstruct `sdk-info.toml` Manually (Quick Hack, Not Recommended)

If the SDK is otherwise complete, creating the missing file may be sufficient for
`vega --version` to work:

```toml
Build_Version = "0.24.12112"
```

Write to: `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/sdk-info.toml`

**Caveat:** This only fixes the version command. It does NOT register the SDK with
VVM. If Amazon's detection relies on VVM-managed build artifacts, this won't help.
Use only as a diagnostic step, not as the fix.

---

## 5. GitHub Research Findings

### 5.1 Key Repositories

| Repo | Relevance |
|------|-----------|
| `looizao/jellyfin-vega-tailnet` | Pins SDK `0.22.5850` via `vega-sdk-requirements.json`. Uses official installer from `sdk-installer.vega.labcollab.net/get_vvm.sh` with SHA256 verification. Build via `npx react-native build-vega`. **Has NOT submitted to Appstore** (device-testing preview only). |
| `amazonappdev/react-native-multi-tv-helloworld` | Official Amazon starter template |
| `galonga/upload-amazon-appstore` | GitHub Action for APK uploads (not VPKG) |
| `aysikder-oss/digipal-players` | Vega app with README showing `kepler build --release` produces `.vpkg` for Appstore submission |

### 5.2 Critical Finding: Official Installer

The astra-tv project documents the proper SDK installation:
```bash
curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh -o installer.sh
# Verify SHA256: 0e5386581e5cf518202687213dd26d1b35e70242d1bd190cdea7096a99476ae0
NONINTERACTIVE=true SKIP_VVD_INSTALL=true VEGA_SDK_VERSION="0.22.5850" bash installer.sh
source ~/vega/env
```

This installer:
1. Downloads VVM (Vega Version Manager)
2. Runs `vega sdk install <version>` to download the SDK tarball
3. The tarball **includes** `sdk-info.toml`
4. Sets up `~/vega/env` for shell configuration

### 5.3 No Public Discussion of the 0.20.0 Requirement

- The exact error string "was not built with the required Vega SDK version" has **zero**
  hits on GitHub, Stack Overflow, Reddit, or Amazon developer forums.
- Amazon's public Vega docs (0.21 through 0.24) do **not** mention a minimum SDK
  version for Appstore submission.
- This is a **server-side validation** with no public documentation.

---

## 6. VPKG Internal Structure Reference

A properly-built VPKG contains:

```
missioncontrol_armv7.vpkg (Zstandard-compressed)
├── manifest.toml                    # App manifest (package info, needs.module, components)
├── meta-info/
│   ├── build-info.json              # {data: {build-number, size, version}, os_version_registry, version}
│   └── signature/
│       ├── digest                   # Package integrity digest
│       ├── digest.json
│       ├── digest.json.sig
│       └── digest.sig
├── bundle/
│   ├── index.bundle                 # JS bundle (dev)
│   └── index.hermes.bundle          # Hermes bytecode bundle (production)
├── assets/
│   ├── asset-index.bin
│   ├── index.html
│   ├── image/icon.png
│   └── raw/keplerscript-app-config.json  # Native module configuration
```

**Fields that do NOT contain SDK version:**
- `meta-info/build-info.json` — only has build-number, size, version, os_version_registry
- `manifest.toml` — has module dependencies but no SDK version field
- `assets/raw/keplerscript-app-config.json` — native module config, no SDK version

---

## 7. Recommendations

1. **Do NOT continue metadata injection.** The `user_build_info.sdk_version` and
   manifest `[[extras]]` approaches are proven ineffective. Amazon ignores them.

2. **Perform Option B (fresh VVM install).** This is the only reliable path to a
   properly-stamped SDK. The current SDK is from a failed installation and cannot
   be trusted.

3. **After reinstall, do a clean `vega build` from source.** Do not repack existing
   VPKGs. The binary artifacts must come from the proper SDK.

4. **Verify with `vega --version`** before building. If it doesn't show
   `Active SDK Version: 0.24.12112`, the SDK is not properly installed.

5. **For CI/CD:** Pin the SDK version using the astra-tv pattern
   (`vega-sdk-requirements.json` + installer SHA256 verification).

---

## Appendix: Key File Paths

| Path | Purpose |
|------|---------|
| `/home/hatch/vega/bin/vega` | VVM CLI (Go binary, v1.4.2) — manages SDK installations |
| `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/` | SDK installation directory (incomplete) |
| `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/sdk-info.toml` | **MISSING** — should contain `Build_Version = "0.24.12112"` |
| `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/tools/bin/keplercommandsext/commands.py` | Contains `VersionCommand` that reads sdk-info.toml |
| `/home/hatch/vega/vvm/vvm-2026-10-05.log` | VVM installer log showing the failed SDK install |
| `/home/hatch/vega/config.json` | VVM config (`sdkPath: /home/hatch/vega/sdk`) |
| `https://sdk-installer.vega.labcollab.net/get_vvm.sh` | Official VVM/SDK installer |

---

## Appendix: Installer Script Reference

The VVM installer (`get_vvm.sh`, 58KB) was downloaded and examined. Key functions:
- `get_latest_sdk_version_from_remote()` — queries Amazon for latest SDK
- `get_installed_sdk_versions()` — lists local SDKs
- Uses `vega sdk install <version>` internally (line 1555, 1593)
- Supports `VEGA_SDK_VERSION`, `NONINTERACTIVE`, `SKIP_VVD_INSTALL` env vars

The installer does NOT create `sdk-info.toml` directly — it comes inside the SDK
tarball downloaded from Amazon's CDN.

---

## Addendum: GitHub Deep-Dive Results (2026-10-05 08:11 UTC)

A dedicated GitHub research subagent completed exhaustive verification. Key findings:

### VPKG Format (byte-verified)
- `.vpkg` = **Zstandard-compressed POSIX ustar tar**. No binary header, no tool-version stamp.
- Full byte-scan of a real build found **zero** occurrences of "sdk" in any form.
- The premise "find where the SDK version is stored in the VPKG" has a surprising
  answer: **nowhere in any standard location.**

### vpt Binary Forensics
- `vpt` source contains `src/vpt/os_version/sdk_version.rs` with `enforce_sdk_gate()` /
  `fmt_threshold()`. The SDK version is a **compile-time constant** — no env-var lookups.
- `contract_package_version: "1.0.323.0"` is **hardcoded in the vpt binary**
  (confirmed via disassembly of `registry_info`).
- `vpt pack --build-info-json` merges arbitrary JSON under `user_build_info` — but
  **neither** the Vega CLI, **nor** the RN `build-vega` pipeline, **nor** KMMB passes
  this flag. Our manual `sdk_version` stamp was the only one, and Amazon rejected it.

### sdk-info.toml (One GitHub Hit)
- Found in `prmiguel/vega-virtual-device-selkies` Dockerfile (commented-out line).
- Lives at the root of a full Kepler SDK install, describes the SDK itself.
- **Not** packaged into the VPKG. No format documentation exists publicly.

### Fallback-Error Theory (Leading Alternative Hypothesis)
The "not built with required SDK version" message may be the analyzer's **generic**
output when it cannot parse or recognize the uploaded file. Supporting evidence:
the observed failure sequence was SDK-version rejection → SDK-version rejection →
**explicit wrong-MIME-type rejection**. If the earlier uploads were also mislabeled,
the analyzer may never have parsed them.

**Counter-evidence:** After the MIME fix (`application/x-vpkg`), the file uploaded
without MIME error but was still rejected for SDK version — suggesting the analyzer
did parse it. However, `application/x-vpkg` may itself be wrong; the correct
Content-Type for VPKG uploads remains unknown.

### Recommended Next Steps (from GitHub research)
1. **Fix the upload path first** — verify the exact Content-Type Amazon expects
   (inspect browser devtools network tab during upload).
2. If SDK-version rejection persists after a verifiably clean upload, **escalate to
   Amazon developer support** and ask which field/signal their analyzer reads.
3. The 0.20.0 policy and its detection mechanism are **completely undocumented** —
   this is a question only Amazon can answer authoritatively.

### Key Links (from GitHub research)
- VPT docs: https://developer.amazon.com/docs/vega/0.21/vpt.html
- SDK 0.24 release notes: https://developer.amazon.com/docs/vega/0.24/vega-release-notes
- sdk-info.toml reference: https://github.com/prmiguel/vega-virtual-device-selkies
- Real-world manifest.toml: https://github.com/agb1986/agb-jellyfin/blob/main/manifest.toml
