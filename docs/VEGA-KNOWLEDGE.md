# Vega OS Build Runbook

**Date:** 2026-10-03
**Source:** Reconstructed from Kavi 5.0's handoff notes (2026-10-03). The original `VEGA-KNOWLEDGE.md` from Kavi 5.0's expired VM was not committed anywhere — this is the rebuilt version. Verify each step against live behavior.

---

## SDK install

Official docs: https://developer.amazon.com/docs/vega/0.23/install-vega-sdk.html

```bash
# Download the official bootstrap installer (verified legitimate — see URL-INVESTIGATION.md)
curl -sSL https://sdk-installer.vega.labcollab.net/get_vvm.sh -o get_vvm.sh
bash get_vvm.sh
```

**Gotchas (confirmed from experience):**
- **Never run as root.** Run as a normal user (`nobody` or equivalent) with explicit `HOME` and `TMPDIR`.
- **Always `--non-interactive`** (`vega sdk config setup --non-interactive`) — otherwise it hangs waiting for input for hours.
- **Redirect TMPDIR** — the VM's `/tmp` may be a small tmpfs (512M). Point `TMPDIR` at a directory with real disk space.
- Use **native curl**, not the snap version.
- Expected versions: CLI `1.4.2`, SDK `main@0.24.12112`.

## Developer mode

1. On the stick: **Settings → About → tap the device name 7 times** to unlock developer options.
2. On your machine: `vega devmode login` — phone OAuth/device authorization flow. Approve on your phone.
3. On the TV screen, a developer code appears — **expires after ~5 minutes**.
4. `vega devmode enable-device --code <CODE>` — the TV reboots. This is normal.
5. After reboot, **ADB port 5555** opens on the stick (10.0.0.151:5555, reachable via tailnet — see TAILNET-SETUP.md).

## Building the app

**Critical:** `vega build` alone can produce an **empty/manifest-only package** (~4.7 KB). The real build is:

```bash
cd app
npx react-native build-vega
```

- Target architecture: the Fire TV Stick 4K Select is **armv7**.
- `package.json` must be regenerated from the SDK's hello-world template if starting fresh.
- Validate the package before installing: `vega exec vpt validate`
- A valid `.vpkg` contains the Metro bundle — check the size (should be MBs, not KBs).

## Deploy

```bash
./scripts/deploy.sh   # connects via ADB, installs .vpkg, launches
```

## Community reference

[`looizao/jellyfin-vega-tailnet`](https://github.com/looizao/jellyfin-vega-tailnet) — the most mature Vega OS community project (embedded Tailscale in a Vega app). Their `docs/INSTALL.md` has the cleanest devmode walkthrough, and their installer pins the bootstrap SHA256.

## Tips & tricks

- Vega OS has **no general sideloading** — devmode + CLI is the only install path (unlike Fire OS/Android).
- Sideloaded apps get a **generic icon** — fine for personal use.
- The `vega` CLI is the main interface for everything: `vega devmode`, `vega exec`, `vega sdk`.
- More community findings in `docs/URL-INVESTIGATION.md` (Community Tips & Tricks section).
