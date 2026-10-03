# app/

Placeholder for the Mission Control Vega OS app source (React Native).

## Status

The app source has not been created yet — it will be scaffolded from the Vega SDK's
hello-world template once the SDK installation completes.

## Build process

```bash
cd app

# Regenerate package.json from the SDK hello-world template (if starting fresh)

# Build for armv7 (Fire TV Stick 4K Select architecture)
npx react-native build-vega

# Validate the package — MUST contain the Metro bundle, not be an empty
# manifest-only package (~4.7 KB). A valid .vpkg is MBs in size.
vega exec vpt validate
```

**Warning:** `vega build` alone can produce empty packages. Always use
`npx react-native build-vega` for the real React Native build.

## Deploy

```bash
../scripts/deploy.sh
```

(requires the stick in devmode with ADB port 5555 reachable — see `../docs/TAILNET-SETUP.md`)
