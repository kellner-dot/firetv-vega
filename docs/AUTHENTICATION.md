# Vega CLI Authentication

How `vega devmode login` works, why it breaks on headless machines, and the custom Secret Service that fixes it.

## The short version

1. Create an **Amazon Developer account** at [developer.amazon.com](https://developer.amazon.com) and complete the **Appstore developer profile** (this creates your *vendor record* — required, free).
2. Run `vega devmode login` — it prints a code, you approve it at `amazon.com/us/code`.
3. The CLI stores tokens in your OS keyring. On headless Linux (no desktop keyring), this fails — see [The keyring problem](#the-keyring-problem) below.
4. Verify with `vega devmode list-vendors` (hidden command) — it should show your vendor.

## Prerequisites: Amazon Developer account + vendor record

`vega devmode login` uses **Login with Amazon (LWA) device authorization** (RFC 8628-style):

1. CLI requests a code pair from `https://api.amazon.com/auth/o2/create/codepair` using Amazon's internal LWA client ID. The consent screen labels it **"Vega Authentication Test"**.
2. CLI prints a `user_code` (e.g. `FY4TSM`) and `verification_uri` (`amazon.com/us/code`), and tries to open your browser.
3. You approve at `amazon.com/us/code` → "Device connected to your account."
4. CLI polls `https://api.amazon.com/auth/o2/token` with `grant_type=device_code` until approval.
5. Token response contains an **access token + refresh token**, which the CLI saves to the keyring.

Requested scopes (from the binary):
```
profile:name profile:email appstore::vega_development appstore::apps:readwrite
```

**The critical detail:** Amazon only attaches the `appstore::` scopes for accounts with a **completed Appstore developer profile** (a vendor record). Without one, the token is valid for `profile:` but the developer-mode API rejects it with HTTP 401 `{"error":"invalid_token"}`. That 401 is an *authorization* failure (no vendor), not an *authentication* failure, despite the message.

A vendor record is created **only** by completing every Developer Console registration profile page and accepting the Developer Services Agreement at `developer.amazon.com/console`. Signing in alone is insufficient. It's free — no tax/banking info needed for devmode (those are only for paid apps).

After login, the CLI calls:
```
GET https://developer.amazon.com/developer-mode/api/vendors
```
- **One vendor** → proceeds silently.
- **Multiple** → interactive "Select a vendor" prompt (or `--vendor <ID>` to skip).
- **Zero** → `No vendors found for your account. You must have at least one registered vendor to use developer mode.`

Our vendor: **Seth Kellner Photography** (`M3LH42DOKX7GYG`).

## The keyring problem

The CLI stores tokens via `github.com/zalando/go-keyring` **v0.2.6**, which on Linux **always** uses the D-Bus Secret Service (`org.freedesktop.secrets`). Its "fallback" provider just returns `ErrUnsupportedPlatform` on Linux — there is no file backend, no environment variable to change the backend.

On a headless machine (container, server, VM without a desktop), there is no Secret Service running, so login fails at the token-save step with `failed to save access token data` — even though the OAuth flow itself succeeded.

### Failure modes (each is a different layer)

| Error | Meaning |
|---|---|
| `exec: "dbus-launch": executable file not found in $PATH` | No D-Bus session bus at all |
| `The name org.freedesktop.secrets was not provided by any .service files` | Bus exists, but no Secret Service registered |
| `secret not found in keyring` | Service exists, item absent (logged out / never stored) |
| `failed to unlock correct collection '...'` | Secret Service contract violation (see below) |

### The solution: custom Secret Service shim

We implemented a minimal D-Bus Secret Service in Node.js (`secret_service.js`) that satisfies go-keyring v0.2.6's exact contract. The critical details (verified against the actual v0.2.6 source, not just the freedesktop spec):

1. **`OpenSession`** — input `sv`, output **`vo`** (Variant first, ObjectPath second). The spec says `o,v`; go-keyring decodes `v,o`. Match go-keyring.
2. **`Unlock`** — must echo the requested object paths in the `unlocked` list, and the prompt path must be `/`. Any other prompt path causes an **infinite hang** (no timeout).
3. **`CreateItem`** — input `a{sv}(oayays)b`, output `oo`. Three args: properties dict, the Secret struct as a separate arg (session `o`, params `ay`, value `ay`, content-type `s`), boolean replace flag. Must return item path + `/` prompt path.
4. **`GetSecret`** — output `(oayays)`. The content-type string is **required** — godbus `Store` into the 4-field Go struct fails without it.
5. **Collection alias** — export a working Collection object at `/org/freedesktop/secrets/aliases/default`. go-keyring falls back to this path when the `Collections` property read fails (which it will on a minimal service with no Properties interface).
6. **Attribute key** — `org.freedesktop.Secret.Item.Attributes` (not `org.freedesktop.Secret.Attributes`).

### Running it

```bash
# 1. Start a D-Bus session bus
dbus-daemon --session --address=unix:path=/tmp/dbus-vega --fork --print-pid

# 2. Start the Secret Service on that bus
DBUS_SESSION_BUS_ADDRESS="unix:path=/tmp/dbus-vega" node secret_service.js &

# 3. Run vega with the same bus address
DBUS_SESSION_BUS_ADDRESS="unix:path=/tmp/dbus-vega" vega devmode login
```

Every `vega` invocation that needs auth (login, list-vendors, enable-device, device commands) must have `DBUS_SESSION_BUS_ADDRESS` pointing at the bus where the Secret Service is running, because the CLI re-reads the token from the keyring each time.

### Token storage

The shim persists to a JSON file (mode `0600`). **This is plaintext on disk** — acceptable as a bootstrap, but the long-term plan is to replace it with a proper encrypted keyring. A backup copy is stored in Google Drive (`vega-secret-store.json`).

**Never** print token values to logs, commit them to git, or paste them in chat.

## Useful commands

| Command | Notes |
|---|---|
| `vega devmode login [--json]` | Device OAuth flow |
| `vega devmode logout [--force]` | Clears credentials; `--force` skips the prompt |
| `vega devmode list-vendors [--json]` | **Hidden** (not in `--help`); lists registered vendors |
| `vega devmode enable-device --code CODE [--vendor ID]` | Enables the stick; `--vendor` skips vendor selection |

## Sources

- `zalando/go-keyring` v0.2.6 source: `secret_service/secret_service.go`, `keyring_unix.go`
- [go-keyring#45](https://github.com/zalando/go-keyring/issues/45) — same error on Docker, `gnome-keyring-daemon --unlock` fix
- [Amazon Vega developer-mode docs](https://developer.amazon.com/docs/vega/0.24/developer-mode)
