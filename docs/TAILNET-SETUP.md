# Fire TV Stick on Tailnet — Subnet Router Setup

**Date:** 2026-10-03
**Status:** PC configured, awaiting route approval in Tailscale admin console

## Why subnet routing (not native Tailscale)

Vega OS is a locked-down Linux — no shell access for users, no package manager, no way to install Tailscale natively. Amazon only allows Vega-format (.vpkg) apps from their store or via developer mode. There is no Tailscale build for Vega OS, and there likely never will be (Amazon controls the platform).

The `jellyfin-vega-tailnet` project proved Tailscale *can* run on Vega OS — but only by embedding the Tailscale client library inside a custom Vega app. That's a heavy lift for just getting ADB access.

**Subnet routing** is the right tool: SETHS-PC is already on both the home LAN (10.0.0.98) and the tailnet (100.124.240.93). By advertising the LAN subnet, the PC becomes a gateway — any tailnet device can reach any LAN device through it.

## Network architecture

```
Tailnet (100.x.x.x/8)
    │
    │ Tailscale encrypted tunnel
    │
    ▼
SETHS-PC (100.124.240.93 tailnet / 10.0.0.98 LAN)
    │  ← IP forwarding enabled (IPEnableRouter=1)
    │  ← Advertises 10.0.0.0/24 to tailnet
    ▼
Home LAN (10.0.0.0/24)
    ├── Fire TV Stick 4K Select (10.0.0.151) — ADB port 5555
    ├── Router (10.0.0.1)
    └── Other LAN devices (printer, etc.)
```

**Traffic flow** (e.g., this VM → Fire Stick ADB):
1. VM sends packet to 10.0.0.151
2. VM's Tailscale client sees 10.0.0.0/24 is routed via 100.124.240.93
3. Encrypted through tailnet to SETHS-PC
4. PC's IP forwarding routes it to the LAN interface
5. Fire Stick receives it on 10.0.0.151:5555
6. Return traffic follows the reverse path

## What was configured (2026-10-03)

### On SETHS-PC (via RVG)

1. **IP forwarding enabled:**
   ```
   HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\IPEnableRouter = 1
   ```
   Verified: returns `1`. Note: takes effect immediately on Windows (no reboot needed for this key).

2. **Tailscale route advertisement:**
   ```
   tailscale up --advertise-routes=10.0.0.0/24 --unattended
   ```
   Verified via `tailscale debug prefs`: `"AdvertiseRoutes": ["10.0.0.0/24"]`

3. **Windows Firewall:** Tailscale inbound rules already present and enabled (Tailscale-Process, Tailscale-In). No changes needed.

### Still needed: Admin console approval

Tailscale requires explicit approval of subnet routes in the admin console (security feature — prevents a compromised node from hijacking traffic).

**Seth's steps:**
1. Go to https://login.tailscale.com/admin/machines
2. Find **SETHS-PC** in the machine list
3. Click the **⋯** (three dots) menu → **Edit route settings**
4. Under "Subnet routes," check **10.0.0.0/24**
5. Click **Save**

The route becomes active within ~60 seconds. No restart needed on any device.

## Verification (after approval)

From this VM (or any tailnet device):

```bash
# Ping the Fire Stick through the subnet route
ping -c 3 10.0.0.151

# Check ADB port
nc -zv -w 5 10.0.0.151 5555
# or: python3 -c "import socket; s=socket.create_connection(('10.0.0.151',5555),timeout=5); print('ADB reachable')"
```

Expected: ping succeeds, port 5555 open (once `vega devmode enable-device` is done on the stick).

## What else becomes reachable

Advertising 10.0.0.0/24 exposes the **entire home LAN** to the tailnet. This includes:
- **Router admin** (10.0.0.1) — web UI accessible via tailnet
- **Network printer** (if Seth has one on LAN)
- **Any other LAN devices** (smart home hubs, NAS, etc.)
- **Other computers** on the home network

**Security note:** Tailnet ACLs still apply. Only devices/users Seth's tailnet policy allows can use the subnet route. The route doesn't bypass Tailscale's identity-based access control — it just makes the LAN *addressable*. If Seth wants to restrict which tailnet devices can use the route, that's configured in the admin console under Access Controls.

## Mission Control integration

`~/workspace/mission-control/collect.py` updated to check the Fire Stick via tailnet:
- Tries TCP connect to 10.0.0.151:5555 (through subnet route)
- Falls back to "unreachable" if the route isn't approved yet or the stick is offline
- The dashboard's Fire TV card now shows real tailnet reachability instead of a static note

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Route not in `tailscale status` | Not approved in admin console | Seth approves at login.tailscale.com |
| Ping works, ADB port closed | Stick's devmode not enabled | `vega devmode enable-device` on the stick |
| No route after approval | Tailscale client needs refresh | `tailscale up` on the client, or wait 60s |
| PC reboots, route gone | Tailscale prefs persist, but IPEnableRouter is registry (persists) | Should survive reboot; verify with `tailscale debug prefs` |
