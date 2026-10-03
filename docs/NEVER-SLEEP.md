# Fire Stick Never-Sleep

Seth wanted the Fire TV Stick to never sleep. The standard Android approach doesn't work on Vega OS.

## Problem

```bash
settings put system screen_off_timeout 2147483647
```

Fails — Vega OS has no `settings` command. The option also wasn't findable in the TV menus.

## Solution: Vega Activity Lock (`alcli`)

Vega OS has a native **Activity Locking** API. The `alcli` (Activity Locking CLI) tool holds a `UserPresence` lock that tells the idle manager the user is present, preventing:

- Screensaver activation
- Display/screen turn-off
- System idle state entry

```bash
alcli lock UserPresence:kavi-never-sleep , sleep 86400000
```

The lock is held as long as the `alcli` process is alive.

### Why not just change the timeout?

- Vega OS idle timeouts live in `com.amazon.devconf/system/idle/TimeoutToScreenOff`
- These are system-level settings, not writable from `app_user` context
- Config files in `/etc/idle-manager/` are read-only
- `autosleep_forbidden` is already `true` in `/etc/power/power-manager.json`, but screensaver/display-off still occur

### Key findings

- `alcli` requires the format: `alcli lock <Reason>:<name> , sleep <ms>`
- Background with `( ... &)` subshell — **not** `setsid` or `nohup` (those fail with IPC errors)
- The idle manager has a 5-minute debounce before idle entry, so a 2-minute keepalive is safely inside the window
- Process PIDs change; always locate it with `pgrep -f 'kavi-never-sleep'`

## Persistence

The `alcli` process dies on Fire Stick reboot or when ADB sessions get cleaned up. A keepalive cron re-establishes it:

- **Script:** `~/workspace/vega-rvg-bridge/never-sleep-keepalive.sh`
- **Cron:** `fire-stick-never-sleep-keepalive` (every 2 minutes)
- The script checks for the lock with `pgrep`; if dead, re-establishes it via the subshell method
- Each run also sends a harmless mouse-move activity pulse as a backup idle-timer reset

## Verification

```bash
# Check lock is active
vda -s 127.0.0.1:15555 shell "pgrep -f 'kavi-never-sleep'"
```

Result: the Fire Stick stays awake indefinitely.
