# Live App Testing upload checklist (manual, ~5 minutes)

CI builds and validates the `.vpkg` — this is the one step Amazon keeps
console-only. Do it from a GitHub prerelease (`.vpkg` + `SHA256SUMS`).

1. **Verify the checksum.** Download the prerelease `.vpkg`, run
   `sha256sum -c SHA256SUMS`. Must say OK.
2. **Developer Console** → Your Apps → Mission Control → **Live App Testing**
   → Create new test (or edit the open one).
3. **Upload the `.vpkg`.** First version per app is console-only — expected.
4. **Testers:** add Seth's email only (private test). Invites expire in 30
   days but the test persists until ended — resend the invite when it lapses.
5. **On the stick:** open the **Appstore Beta Hub** app → install the test
   build. This is what gives the real launcher tile + pinning (sideloaded
   builds sit disabled with generic icons).
6. **Smoke test on the stick:** tile appears, launches, Back exits cleanly,
   Home relaunch doesn't leak audio, HDMI-disconnect pauses, Alexa
   interruption and screensaver behave.
7. **Voice:** "Alexa, open Mission Control" lights up after LAT — no extra step.

**Submission copy rules:** never write the word "Vega" in any field; write it
as a Fire TV app. Bump BOTH version and build number every submission
(CI does the build number automatically via `github.run_number`).

**Review tests Amazon runs:** Back-to-exit, Home relaunch without audio
leakage, HDMI disconnect pause, Alexa interruption, screensaver behavior.
