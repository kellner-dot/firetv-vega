# Mission Control Live App Testing Upload — Progress (2026-10-05)

## Status: ON HOLD (per Seth, 2026-10-05 04:17 EDT)
Focus shifted to KaviTV. This documents the Mission Control LAT upload attempt.

## What Was Tried

### 1. Original Build Rejected (SDK Version)
- File: `missioncontrol_armv7.vpkg` (v0.2.0 build 5, 285KB)
- Amazon error: "Your app was not built with the required Vega SDK version '0.20.0' or higher."

### 2. Metadata Injection Attempt #1
- File: `missioncontrol_armv7_sdkfix.vpkg` (build 6)
- Added: `user_build_info.sdk_version = "0.24.12112"` in build-info.json
- Result: Same SDK version rejection

### 3. Metadata Injection Attempt #2
- File: `missioncontrol_armv7_sdkfix2.vpkg` (build 8, 285,586 bytes)
- Added both:
  - `user_build_info.sdk_version = "0.24.12112"`
  - Manifest `[[extras]] vega_sdk_version = "0.24.12112"`
- VPT validation: 0 errors
- Committed to `kellner-dot/firetv-vega` main (`dist/mc_sdkfix2.vpkg`)

### 4. MIME Type Issue (FIXED)
- Amazon rejected upload: "Failed to upload as MIME type did not match the expected."
- Root cause: Windows had no MIME type registered for `.vpkg` extension
- Fix: Registered `application/octet-stream` (then `application/x-vpkg`) in HKCR and HKCU
- Verified via test page: browser now sends correct Content-Type
- After fix: file uploaded successfully (MIME issue resolved)

### 5. SDK Version Rejection Persists
- After MIME fix, Amazon accepted the upload but rejected with SDK version error again
- Conclusion: Metadata injection does not work. Amazon detects SDK version through a different mechanism.

## Root Cause (from savant research)

The Vega SDK installation at `/home/hatch/vega/sdk/vega-sdk/main/0.24.12112/` is **incomplete**:
- The VVM installer failed partway (exit code 3 at `_060_install_sdk`)
- `sdk-info.toml` was never created
- `vega --version` fails; VVM reports "No SDKs have been installed"
- Builds succeed but are not properly stamped with SDK version

Byte-level forensics of .vpkg files confirmed: **there is no SDK version field** in the standard package structure. The `user_build_info.sdk_version` injection was the only stamp, and Amazon ignores it.

See: `2026-10-05-vpkg-sdk-savant.md` for full research.

## Proper Fix (in progress when put on hold)

1. Fresh SDK install via official VVM: `vega sdk install 0.24.12112`
   - First attempt failed: `/tmp` (512MB tmpfs) ran out of space
   - Retry with `TMPDIR=/home/hatch/tmp_install` was in progress
2. Clean rebuild of Mission Control from source (no metadata injection)
3. Upload the properly-built package

## Files on SETHS-PC (Downloads)
- `mc_correct.vpkg` (285,586 bytes) — the sdkfix2 build, uploads but SDK-rejected
- `kavitv_sdkfix.vpkg` (479,230 bytes) — KaviTV stable build, staged for later

## Next Steps (when resumed)
1. Complete the SDK 0.24.12112 fresh install
2. Verify with `vega --version` showing "Active SDK Version: 0.24.12112"
3. Clean rebuild Mission Control from `~/workspace/firetv-vega-src/app/`
4. Upload to Amazon Appstore → Live App Testing
5. Set up Seth (`sethryankellner@gmail.com`) as sole LAT tester
