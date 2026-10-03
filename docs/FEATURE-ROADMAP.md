# Mission Control / Fire Stick — Feature Roadmap

**For:** Seth · **Date:** 2026-10-03 · **Status:** Design / brainstorm — nothing here is committed until Seth says so.

This is the "cool features" backlog for the Fire Stick + Mission Control ecosystem: the Vega TV apps, the GitHub Pages dashboard, the RVG bridge, and the whole fleet (Gaming PC, MacBook Air, iPhone, Razr, Fire Stick; Emby, TeraBox, BiglyBT, Apple Music, GitHub, KaviGuard).

**Ground rules used while designing:** every feature must be buildable with the current stack — Vega WebView apps (Chromium 118), the GitHub Pages dashboard + 5-minute collector, the RVG bridge on `:8898` (keys/tap/swipe/text/launch via ADB), the socat tunnel, and Tailnet. No new hardware, no paid services.

**Legend:** Difficulty — 🟢 easy (dashboard JS or collector change, no app rebuild) · 🟡 medium (app rebuild/redeploy, or a small backend) · 🔴 hard (new subsystem or research). Priority — **P0** must-have · **P1** nice-to-have · **P2** moonshot.

---

## 1. TV Dashboard Enhancements

### 1.1 Ambient Mode 🌙
*One-line pitch: The TV becomes a beautiful clock/photo/weather display when idle.*

**User perspective:** Stop touching the remote for 10 minutes and Mission Control melts into a slow, gorgeous ambient screen — big clock, today's weather, a slideshow of Seth's photography, and whatever's now-playing. Touch any button and the dashboard snaps back.

**How it works:** Pure dashboard JS. A `setTimeout` idle timer (reset on any keydown) toggles a full-screen ambient layer: CSS gradients + canvas, photos pulled from a `photos.json` manifest on GitHub Pages, weather from a free API (Open-Meteo, no key needed) cached by the collector. No app rebuild — it's all in `index.html`.

**Difficulty:** 🟢 easy · **Priority:** P1

### 1.2 Notification Center 🔔
*One-line pitch: KaviGuard alerts and fleet warnings pop up on the TV like a phone.*

**User perspective:** When something needs attention — Razr battery low, TeraBox nearly full, BiglyBT download finished, KaviGuard flags something — a sleek banner slides in over the dashboard. Dismiss with BACK.

**How it works:** The collector already gathers fleet state every 5 minutes. Add an `alerts[]` array to `status.json` with severity levels; the dashboard renders a notification stack and an unread badge. Alert rules live in `collect.py` (thresholds per device/service). Optional: Kavi pushes urgent alerts via the RVG bridge `notify` path once a toast mechanism exists.

**Difficulty:** 🟢 easy · **Priority:** P0

### 1.3 Device Action Cards ⚡
*One-line pitch: Every fleet card gets remote actions — reboot the PC from the couch.*

**User perspective:** Focus the Gaming PC card, hit OK, and get actions: *Reboot PC*, *Rescan Emby library*, *Ping device*. Focus the Razr card: *Play find-my-phone sound*. The TV becomes a universal remote for the whole fleet.

**How it works:** Dashboard detail overlay gains an actions row. Actions call small endpoints: PC actions go through the existing RVG agent on SETHS-PC (`:8899`); Razr actions through RVG Android; Emby rescan through the Emby API (key from Drive, transient). Needs a tiny authenticated relay — the RVG bridge pattern extended, or a small Flask app on the VM. Confirm dialogs are TV-friendly (left/right + OK, no `confirm()`).

**Difficulty:** 🟡 medium · **Priority:** P1

### 1.4 Morning Briefing View ☀️
*One-line pitch: Before noon the dashboard leads with your day, not your servers.*

**User perspective:** Turn the TV on in the morning and the top row is *Today*: calendar events (Seth & Chelsea shared calendar), weather, days-until-hearing countdown, and Kavi's overnight digest. After noon it fades back to the fleet view.

**How it works:** Dashboard JS checks local time and reorders sections. Data comes from the collector (calendar via Google Calendar API already connected, countdown is static math, digest from a Kavi cron writing `briefing.json`). Zero app changes.

**Difficulty:** 🟢 easy · **Priority:** P1

### 1.5 Global Search 🔍
*One-line pitch: One search box for Emby, IPTV, and Apple Music.*

**User perspective:** Hit Search, type with the on-screen keyboard (or paste from phone via clipboard share), and get unified results: Emby movies, IPTV channels, Apple Music tracks — each launching the right player.

**How it works:** Dashboard overlay with a TV keyboard component. Queries fan out: Emby `/Search/Hint`, TV Navigator's channel list (already on GitHub Pages), Apple Music via the Mac/PC. Results link to actions: Emby web player URL in the WebView, IPTV deep link into the IPTV Player app (`pkg://com.kellner.iptvplayer.main` with extras). Needs the IPTV app to accept launch parameters — verify `pkg://` extras support first.

**Difficulty:** 🟡 medium · **Priority:** P2

---

## 2. Cross-Device Features

### 2.1 Send to TV 📲➡️📺
*One-line pitch: Share any video link from your iPhone and it plays on the Fire Stick.*

**User perspective:** Watching a YouTube/Vimeo/direct MP4 link on the phone? Hit Share → Send to TV. The Fire Stick opens it full-screen. Perfect for "you gotta see this" moments with Chelsea.

**How it works:** A lightweight inbox: `https://kellner-dot.github.io/seth-dashboard/send/` page (or iOS Shortcut) writes the URL to a GitHub `inbox.json` via the Contents API; the TV dashboard polls the inbox every 30s and, on a new item, opens it in the WebView (or hands it to the IPTV player for streams). RVG bridge can also force-launch. iOS Shortcut makes it one tap from Share Sheet.

**Difficulty:** 🟡 medium · **Priority:** P0 — this is the "wow, that's magic" feature.

### 2.2 Phone-as-Remote 📱
*One-line pitch: Your iPhone becomes a full Fire Stick remote in the browser.*

**User perspective:** Open a page on the iPhone → D-pad, OK, Back, Home, volume, plus a keyboard for typing in search boxes. No app install — just a web page.

**How it works:** A mobile web page (`remote.html` on GitHub Pages) sends key commands to the RVG bridge `:8898/rvd/input`. Catch: the bridge listens on the VM, reachable over Tailnet. The iPhone is on Tailnet via the Tailscale app, so `http://<vm-tailnet-ip>:8898` works if the bridge binds to the tailnet interface. Add token auth (already in the bridge). Latency over tailnet is fine for remote keys.

**Difficulty:** 🟡 medium · **Priority:** P1

### 2.3 Clipboard Share 📋
*One-line pitch: Copy on phone, paste on TV.*

**User perspective:** Copy a long Xtream URL or search term on the iPhone, hit "Send clipboard" — the text gets typed into whatever's focused on the Fire Stick.

**How it works:** The RVG bridge already supports `{"text": "..."}` input via `inputd-cli send_text`. The phone remote page (2.2) gets a text field + Send button. Also useful for entering WiFi passwords and logins on TV apps.

**Difficulty:** 🟢 easy (bridge already does it; just UI) · **Priority:** P1

### 2.4 Find My Phone 📳
*One-line pitch: Lost the Razr in the couch? Ping it from the TV.*

**User perspective:** In the Razr's dashboard card → *Find phone* → the Razr plays a loud alert sound, even on silent.

**How it works:** RVG Android has `/rvd/notify`; if it can trigger audio, use it — otherwise fall back to making the Razr ring via the existing RVG input/notification path. (Verify RVG Android's notify plays sound; if not, this becomes a P2.)

**Difficulty:** 🟡 medium · **Priority:** P2

### 2.5 Watch Continuity ▶️
*One-line pitch: "Resume on TV" for anything you were watching.*

**User perspective:** The dashboard's Media section shows what you were last watching on Emby (it tracks per-user progress) with a *Resume on TV* button.

**How it works:** Collector already polls Emby; add `resumeItems[]` (in-progress videos with position ticks) to `status.json`. The button opens the Emby web player at the resume point inside the Mission Control WebView (Emby's web UI accepts `?startPositionTicks=`). Limitation: no native Emby app on Vega — web playback it is. Test HLS playback in the Vega WebView first.

**Difficulty:** 🟡 medium · **Priority:** P1

---

## 3. Automation

### 3.1 Good Night Routine 🌙
*One-line pitch: One button (or one schedule) winds the whole living room down.*

**User perspective:** At 11 PM — or when you hit *Good night* on the dashboard — the TV dims into Ambient Mode, a sleep timer starts, and in the morning the briefing view is waiting.

**How it works:** Cron on the VM + RVG bridge: send HOME key, launch Mission Control (ambient picks up after idle timeout). Sleep timer is dashboard JS (countdown overlay → `history.back()` / blank screen). All existing pieces, just choreography.

**Difficulty:** 🟢 easy · **Priority:** P1

### 3.2 Download-Complete Celebrations 🎉
*One-line pitch: BiglyBT finishes a download → the TV tells you.*

**User perspective:** A banner slides in: "✅ *Schizopolis (1996)* finished downloading." No more checking the PC.

**How it works:** Collector polls BiglyBT state; when a transfer moves to completed (diff against last run's state), push an alert into `status.json` alerts array. Dashboard shows it via the Notification Center (1.2). Pure collector + dashboard work.

**Difficulty:** 🟢 easy · **Priority:** P1

### 3.3 Storage Guardian 💾
*One-line pitch: The TV warns you before disks fill up.*

**User perspective:** TeraBox hits 90% → amber banner on the TV. Emby's D: drive hits 95% → red banner with "oldest unwatched" cleanup suggestions.

**How it works:** Collector already reads TeraBox quota and (partially) disk stats. Add thresholds + alert severities. The "cleanup suggestions" list comes from Emby's least-recently-played items — collector-side query, dashboard display only.

**Difficulty:** 🟢 easy · **Priority:** P1

### 3.4 Auto-Launch on Boot 🚀
*One-line pitch: Fire Stick boots straight into Mission Control.*

**User perspective:** Power on → Mission Control is just there. No hunting for the app tile.

**How it works:** Research first: Vega's `lifespan` manifest field and boot-completed intents for third-party apps (check the Vega App Genius Guide § on lifecycle; `KeplerBackHandler` patterns suggest limited boot hooks for sideloaded apps). If blocked, fallback: a tiny "launcher" behavior where the last-foreground app is re-launched — may not be possible. This one needs a spike before committing.

**Difficulty:** 🔴 hard (research spike) · **Priority:** P2

---

## 4. Media Features

### 4.1 Unified Now Playing 🎵
*One-line pitch: One bar showing what's playing anywhere — Emby, Apple Music, IPTV.*

**User perspective:** A slim now-playing strip on the dashboard: "🎬 *On the Silver Globe* — Emby · 42%" or "🎵 *Light Leaks* — Apple Music". Always current.

**How it works:** Collector polls Emby `/Sessions` (already does for some cards) and Apple Music (via the Mac's Now Playing — needs a small poller on the Mac or via BlueBubbles-adjacent tooling; simplest: Apple Music web API if Seth's library is reachable). Merge into `nowPlaying` in `status.json`; dashboard renders the strip. IPTV now-playing is harder (TV Navigator would need to report back) — start with Emby + Apple Music.

**Difficulty:** 🟡 medium · **Priority:** P0 — high wow factor for a media household.

### 4.2 TeraBox Direct Play ☁️▶️
*One-line pitch: Play any cloud movie on the TV without downloading.*

**User perspective:** Browse your TeraBox movies on the TV and hit play — it streams straight from the cloud.

**How it works:** The missing link is a TeraBox direct-stream URL generator (the `tb-direct` rclone remote proves the API path exists). A small VM-side endpoint exchanges a TeraBox file path for a time-limited stream URL; the Vega WebView plays it (Chromium 118 handles MP4/HLS natively). Auth: TeraBox tokens via the existing flow. This is the "cloud-only movie library" vision made real on TV.

**Difficulty:** 🔴 hard (TeraBox stream URL auth is the crux) · **Priority:** P1 — strategic, matches the cloud-only direction.

### 4.3 "What Should I Watch?" 🎲
*One-line pitch: Kavi picks tonight's movie and puts it on the TV.*

**User perspective:** Hit the 🎲 button (or ask Kavi in chat: "pick a movie") and the TV shows a full-screen movie card — poster, why Kavi picked it, *Play* and *Reroll* buttons.

**How it works:** Kavi queries Emby for unwatched movies, weights by genre variety / Seth's favorites (Schizopolis energy), and writes `pick.json`. Dashboard renders the cinematic card; Play opens Emby web player. The "why" line is the fun part — Kavi writes one sentence per pick. Manual trigger now; nightly auto-pick later.

**Difficulty:** 🟡 medium · **Priority:** P1 — pure delight feature.

### 4.4 IPTV Favorites Sync ⭐
*One-line pitch: Your favorite channels follow you and stay tidy.*

**User perspective:** Star channels in the IPTV player; they sync to a favorites row on the dashboard. Reorder once, everywhere updated.

**How it works:** TV Navigator stores favorites in localStorage. Add a "sync" that POSTs the favorites list to a GitHub `iptv-favorites.json` (via Contents API from the player page); dashboard reads it for the favorites row. Conflict resolution: last-write-wins, it's a single-user system.

**Difficulty:** 🟢 easy · **Priority:** P2

---

## 5. Kavi Integration

### 5.1 Kavi Briefing Card 📰
*One-line pitch: Every morning, Kavi writes your day onto the TV.*

**User perspective:** The top dashboard card is a short, warm briefing in Kavi's voice: weather, calendar, days until the hearing, one thing to remember, and (when relevant) overnight fleet events. New every morning.

**How it works:** A Kavi cron (morning, ~8 AM) composes `briefing.json` — plain JSON with headline, bullets, and a "one thing" — and pushes it to GitHub Pages. Dashboard renders it as the hero card. This is Kavi's existing digest machinery pointed at a new surface.

**Difficulty:** 🟢 easy · **Priority:** P0 — makes the TV feel alive and personal.

### 5.2 Ask Kavi on TV 💬
*One-line pitch: Type a question on the TV, Kavi's answer appears there.*

**User perspective:** "What's the weather Saturday?" typed with the remote (or pasted from phone via Clipboard Share) → answer renders as a nice card on the TV a few seconds later.

**How it works:** Dashboard POSTs the question to a VM endpoint that drops it into kavi-mail (`C:\Users\sethr\kavi-mail\inbox\` naming convention); Kavi's mail watcher picks it up, answers into `kavi-answers/<id>.json` on GitHub Pages; dashboard polls for the answer. Async by design — no websockets needed. Rate-limit: one question at a time per TV.

**Difficulty:** 🟡 medium · **Priority:** P2 — cool, but chat already exists on the phone.

### 5.3 TV Status in Chat 📺
*One-line pitch: "What's on the TV?" — and Kavi knows.*

**User perspective:** In chat: *"pause the TV"*, *"what's playing"*, *"turn the TV to Mission Control"*. Kavi just does it.

**How it works:** Mostly already possible: RVG bridge has keys (play/pause = KEY_PLAYPAUSE), launch, and status. Wire chat intents → bridge calls. Screenshot is 503 on production builds, so "what's on" = last launched app + now-playing data, not a live frame. Document the gap honestly.

**Difficulty:** 🟢 easy (bridge exists; just intent wiring) · **Priority:** P1

---

## 6. Fun / Wow Factor

### 6.1 Photo Frame Mode 🖼️
*One-line pitch: The TV becomes a gallery of Seth's photography.*

**User perspective:** A dedicated ambient gallery cycling through his best shots (sethkellnerphoto portfolio), with title/location captions. Dinner-party ready.

**How it works:** Curated `photos.json` (URL + caption) on GitHub Pages; dashboard ambient layer (1.1) gets a gallery mode. Images can live in the repo or hotlink the Weebly site — check hotlinking first, else mirror to the repo.

**Difficulty:** 🟢 easy · **Priority:** P1

### 6.2 Music Visualizer 🎛️
*One-line pitch: Full-screen reactive visuals for music nights.*

**User perspective:** Playing Apple Music? Hit *Visualize* and the TV becomes a pulsing canvas — frequency bars, particles, album art — driven by the actual audio.

**How it works:** Canvas + WebAudio analyser. Catch: the audio must play *in the same WebView* for the analyser to see it. So this pairs with an Apple Music web player embedded in the dashboard (music.apple.com web player in an iframe — verify it plays in Vega WebView). If Apple Music won't embed, fallback: visualizer runs on a mic-less "fake" mode driven by beat estimation — less cool, skip.

**Difficulty:** 🟡 medium (blocked on Apple Music web embed test) · **Priority:** P2

### 6.3 Stats Wall 📊
*One-line pitch: Your year in media, as a TV infographic.*

**User perspective:** "2026 in review": hours watched, top 5 movies, most-played tracks, GitHub commits, downloads completed — rendered as big bold TV graphics. Shareable screenshot for socials.

**How it works:** Collector aggregates Emby play history (`/Users/{id}/Items?Recursive=true&Filters=IsPlayed` with play counts), Apple Music history (if available), GitHub API commit counts. A `stats-2026.json` feeds a special dashboard view. Mostly collector + CSS work.

**Difficulty:** 🟡 medium · **Priority:** P2

### 6.4 Hearing Countdown ⏳
*One-line pitch: A quiet, respectful countdown to November 12.*

**User perspective:** A small, dignified card: "Disability hearing in 39 days — Nov 12, 8:15 AM ET." Tapping it shows the prep checklist status (not case details — those stay private).

**How it works:** Static date math in JS + a `hearing.json` with checklist progress (populated from the disability goal files, sanitized — no medical details on the TV screen, just task counts like "3 of 8 records requests complete"). Keep it tasteful: no case facts on a shared screen.

**Difficulty:** 🟢 easy · **Priority:** P1 — genuinely useful, matches an active goal.

---

## Phased Rollout Suggestion

### Phase 1 — Quick wins (dashboard + collector only, no app rebuilds)
1.2 Notification Center · 3.2 Download celebrations · 3.3 Storage Guardian · 5.1 Kavi Briefing Card · 6.4 Hearing Countdown · 1.4 Morning Briefing · 6.1 Photo Frame Mode
*Why first: all shippable this week, all high visible value.*

### Phase 2 — Integrations (small backends, RVG bridge)
2.1 Send to TV · 2.2 Phone-as-remote · 2.3 Clipboard Share · 1.3 Device Action Cards · 4.1 Unified Now Playing · 5.3 TV Status in Chat · 3.1 Good Night Routine
*Why second: needs the bridge hardened (persistent tunnel, token handling) and tailnet exposure.*

### Phase 3 — Big bets (research spikes first)
4.2 TeraBox Direct Play · 4.3 What Should I Watch · 1.1 Ambient Mode polish · 1.5 Global Search · 5.2 Ask Kavi on TV · 6.2 Music Visualizer · 6.3 Stats Wall · 3.4 Auto-Launch on Boot
*Why last: each needs a feasibility spike (TeraBox stream auth, Apple Music embed, Vega boot hooks).*

---

## Open Questions / Spikes Needed
- [ ] Does `pkg://` support launch extras (for Global Search deep links)? — test via RVG bridge launch.
- [ ] Can Apple Music web player embed and play in Vega WebView? — 10-minute test.
- [ ] Vega boot-completed hooks for sideloaded apps? — check Genius Guide lifecycle section + test.
- [ ] RVG Android notify: does it play sound for Find My Phone? — test on Razr.
- [ ] TeraBox direct stream URL generation: which endpoint, token lifetime? — spike against `tb-direct`.
- [ ] Tailnet-expose the RVG bridge (`:8898`) for the phone remote — bind to tailnet IP, verify iPhone reachability.

---

*End of roadmap. 24 features. Nothing is scheduled until Seth picks his favorites.*
