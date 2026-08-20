# Plan

The roadmap. For the target design see [ARCHITECTURE.md](ARCHITECTURE.md); for
the current state see [STATUS.md](STATUS.md).

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Rewrite from scratch? | **No** | The map images and 599 hand-placed markers are the expensive, irreplaceable asset, and the entrance-linking UX already works. The broken parts are small and contained. |
| PopTracker pack instead? | **No** | Desktop-only (WASM "needs a lot of work"), so it cannot meet the GitHub Pages requirement; and ER tracking is documented by mature packs as "at the absolute edge of the bounds of PopTracker". |
| Canonical FFMQ data | **Bind markers to it** | Unlocks logic, AP mapping and drift detection in one move. |
| Logic depth | **Full ER-aware reachability** | It's what makes an ER tracker useful, and the access rules already exist upstream. |
| Build tool | **Migrate to Vite** | `react-scripts` is unmaintained since 2022; Vite deploys cleanly to Pages. |
| Upstream data sync | **Build-time, via GitHub Action** | Runtime is blocked by CORS and would spoil the seed. |
| Sync source | **AP FFMQ world 1.7+, `data/rooms.py`** | 1.7 dropped the external API; rooms, entrances, vanilla pairings and shuffle constraints now ship in one module. |
| Target AP version | **1.7+, with fallback** | Feature-detect `map_shuffle_seed` in slot data; ask the user for settings when it's absent. |
| Scope of original work | **Entrance tracking + ER logic only** | Items, settings, room graph, access rules and pairing constraints all come from upstream. |
| Map editor | **Removed** | The site is static and marker data is ours to change, not the user's. Deleted in full: `MapViewer`, `MapViewerContainer`, `LocationButton`, `LocationModal`, `EditorModeBar`, `itemPaths.js`, plus the editor mode and header button. |
| Battlegrounds | **Checks, not entrances** | Canonically a battlefield is a `game_object` you clear for a reward. Drop the self-link modelling. |
| Hero Chests | **Not tracked** | Not Archipelago locations, so out of scope. |
| Local AP servers | **Supported, no setup** | Tested: `ws://localhost` is exempt from mixed-content blocking. Only non-loopback self-hosting needs `wss://` via `MultiServer.py --cert`. |
| Runtime dependencies | **None** | Plain React + JSON + localStorage. Data sync is a dev script that emits JSON; it never runs in the browser. |

---

## Phase 0 — Foundation

Small, mechanical, unblocks everything else.

- [x] Declare `tailwindcss` / `autoprefixer` / `postcss` in `package.json`
- [x] Clear the four ESLint warnings so `CI=true` builds pass
- [x] Migrate `react-scripts` → Vite. JSX files renamed to `.jsx`, `index.html` moved to the
      root, `vite.config.mjs` added. Build dropped from ~30s to ~1s and 81.4 → 76.9 kB gzipped
- [x] **`assetUrl()` helper** — data files hold absolute paths (`/images/maps/...`) which 404
      under a Pages sub-path. Everything rendering an image from data now routes through it
- [x] GitHub Actions: `deploy.yml` (Pages on push to `master`, tests gate the publish) and
      `ci.yml` (tests + build on PRs and other branches)
- [x] Vitest suite replacing the CRA boilerplate: **63 passing, 3 todo, 5 files, ~2s**
- [x] Delete dead code: `NavigationButtons`, `imagePaths.js`, `gameDataService.js`,
      `spritesData.js`, `App.css`, `logo.svg`, `reportWebVitals.js`, the `navigationMessage`
      state and the `connectingMode` prop
- [x] Remove the map editor (~1,215 lines)
- [x] Rewrite `README.md`
- [x] Verified in a browser: dev **and** production-preview both render maps and sprites
      correctly under the `/mysticquestentrancetracker.react/` base path, zero broken images,
      no console errors

**Done.** A push to `master` now publishes to GitHub Pages, with tests gating the deploy.

> **One manual step before the first deploy:** in the repo's
> *Settings → Pages*, set **Source** to **GitHub Actions**. The workflow cannot enable
> Pages by itself.

## Phase 1 — Canonical data and binding

The foundation for logic, AP, and correctness. Biggest single payoff.

- [x] `scripts/sync-ffmq-data.mjs` — fetches AP 1.7 `worlds/ffmq/data/rooms.py` and
      `Items.py`, emits 11 JSON files into `src/data/ffmq/`. Build-time only; the site
      itself never calls anything. `npm run sync-data`
- [x] A Python-literal parser (`scripts/lib/pythonLiteral.js`, 17 tests) — needed because
      the data contains apostrophes inside double-quoted strings ("Kaeli's House"), so
      naive quote-swapping corrupts it
- [x] Excludes `HeroChest` and `Trigger` from checks — **266** AP locations, not 270
- [x] Ports `yaml_item()` so access rules (`DragonClaw`) resolve to item names
      (`Dragon Claw`); the sync **fails** if any rule does not resolve
- [x] Models `Barred` as `{type:'never'}` — it names a deliberately commented-out item,
      so those 2 links are permanently impassable rather than merely unmet
- [x] Extracts trigger events (`on_trigger`, 58 triggers / 59 events) — these gate links,
      so logic needs them
- [x] Weekly sync workflow that re-fetches, rebuilds the binding, runs the tests and
      opens a PR on change
- [x] **Dry run** (`scripts/analyze-binding.mjs`) — sizing question answered, below
- [x] **Binding built** (`scripts/build-binding.mjs` → `src/data/binding.json`)
- [x] Integrity tests over the binding: real references, no double claims, honest tiers
- [ ] **Review tool** for the markers the binding could not resolve (see below)
- [x] Remodel battlegrounds as checks **in the app** — they now toggle cleared instead of
      linking, render green when cleared, get their own per-floor counter, and no longer
      inflate "Doors Linked" (world map went from 51 doors to a correct 31). The self-link
      shortcut is gone; `toggleChestBox` became `toggleCheck`
- [ ] Add an NPC marker type and place the **16 NPC checks** (none exist today)
- [ ] Resolve orphan floor `40302`; add the missing floors (`Windia`, `Hill of Destiny`,
      and the other 9 unreferenced images)

### Dry-run result: how automatable is the binding?

The key discovery: our map images are **faithful crops of the game's own maps at
exactly 16 px per tile**. Canonical entrances carry tile coordinates, so a floor's
markers can be aligned to an area by solving for a single translation — which
identifies the area *and* binds every marker at once.

Bone Dungeon 1F confirmed it: a canonical 21-tile gap between two entrances
matched our 332 px gap (20.75 tiles) exactly.

**The maps are not the problem.** Where a floor has 3+ markers, alignment is
clean. The residue is small rooms with only **two** door markers, which can align
to almost any area — ambiguity, not image quality. Different maps would not help.

### Where the binding landed

| | markers | |
|---|---:|---|
| Bound, high confidence | 168 | name agrees *and* 3+ markers align |
| Bound, needs review | 134 | one kind of evidence only |
| Unresolved (candidates offered) | 215 | mostly chests/boxes — see below |
| No binding yet | 81 | floors that got no area |
| **Total markers** | **598** | |

Floors: **96 / 120** bound to a game area (25 high, 44 name-only, 27 geometry-only).

Bound by method: 249 entrances by geometry, 25 world-map doors by name, 28
containers that were the only candidate in their area.

### Why chests and boxes are harder than entrances

Upstream gives `game_objects` **no coordinates** — only entrances have them. So a
container cannot be placed geometrically. The best we can do automatically is
narrow it to the checks in the rooms the floor covers (via area → entrances →
rooms), which leaves 149 markers holding a short candidate list.

That is what the review tool is for: show the map, show the 2–5 candidates, let a
human pick. Not 598 decisions — closer to 200, most of them obvious.

### A note on tuning

Three assignment strategies were tried. Relaxing one-to-one so map variants
(Frozen/Unfrozen Aquaria) could share an area sounded right but made things
worse — with only the location name to go on, every Bone Dungeon floor claimed
"Bone Dungeon 1F". An offset-equality test for variants then over-corrected to
zero shares. Strict one-to-one won: **a smaller correct result beats a larger
wrong one**, and the variants fall through to the review tool.

**Done when:** every marker resolves to a canonical entity, and a test fails if
they ever drift apart.

## Phase 2 — State layer ✅

Fix the bugs properly rather than patching symptoms.

- [x] **Single commit per action.** Every mutation now funnels through `_mutate`,
      which reads the run once, hands it to a callback and writes it once. That one
      rule kills the whole bug class: `linkDoors` used to read a snapshot, call
      helpers that each re-read and re-saved independently, then write its stale
      snapshot back on top — silently discarding the `isLinked` flags it had just set
- [x] The three `test.todo`s are now **real passing regression tests**
- [x] **Versioned save schema + migration** (`saveMigration.js`, 16 tests). v1 saves
      load and are repaired: `isLinked` is rebuilt from `doorConnections` (which did
      survive the old bug), `floorId: 0` placeholders normalise to `null`, and
      self-linked battlegrounds become cleared checks
- [x] Corrupt storage no longer crashes the app — it logs and returns no runs,
      leaving the raw value recoverable by hand
- [x] **Game card counts pairs, not ends** (`countLinkedPairsIn`)
- [x] **Links record both floors**, so `floorId` is real data rather than a `0` placeholder
- [x] Import no longer teleports you into the tracker (the startup effect ran on every
      `refreshTrigger`)
- [x] No more `setState` during render — invalid mode is derived, not assigned
- [x] **Close Run button** — `onCloseGame` was accepted by `GameTracker` and never used,
      so the only thing that cleared `current_game_id` was unreachable
- [x] Import hardening: shape validation, migration applied to imported files, a
      confirmation showing what will be added, and correct id assignment
- [x] Removed the hardcoded "Last updated: Never" placeholder

Verified in the browser against a deliberately seeded v1 save: it loaded, migrated,
rebuilt the lost flags, rewrote storage as a v2 envelope, and the "Doors Linked"
stat — previously stuck at 0 forever — now tracks correctly.

**Done.**

## Phase 3 — Entrance linking UX ✅

Linking used to mean: click door A, remember where you're going, navigate there by
hand through three dropdowns, click door B. Across 121 floors that was the main
friction in the whole tool.

- [x] Clicking an unlinked door opens a **link picker modal** instead of arming a
      deferred selection
- [x] The modal names the source door and the floor it sits on, so you always know
      what you are linking *from*
- [x] A floor browser down the left: all 121 floors, each showing how many of its
      doors are still free
- [x] The selected floor's map on the right, with its doors overlaid; one click
      creates the link and closes the modal
- [x] **Search by name** — typing "bone" narrows 121 floors to 9
- [x] **Plausible targets first** — floors that still have free doors sort above
      floors with none left
- [x] **Invalid targets are disabled**, with the reason in the tooltip: the source
      door itself, doors already linked, and doors marked unusable
- [x] Escape and click-outside cancel without linking
- [x] Opens on the floor you were already looking at, so linking two doors on one
      screen stays a two-click operation
- [x] **Fixed the keyboard/accessibility bug** — markers activated on `onMouseUp`,
      so Enter and Space did nothing and assistive tech could not reach them. Now
      `onClick` with a visible focus ring; Shift+Enter is the keyboard equivalent of
      right-click
- [x] Battlegrounds are right-click only, and collapse to the same small red marker
      a dismissed door gets once cleared
- [ ] Reject pairings that are impossible per `no_exits` / `blocked_oneways`.
      **Deferred**: this needs the marker binding to be complete, and it is at 67%.
      Wire it up once the review pass lands

Verified end to end in the browser: clicked a world-map door, searched "bone",
picked Bone Dungeon 1F, clicked its Entrance — the link was made with **both**
floors correctly recorded (10101 and 20301), the modal closed, and the marker and
counter updated.

**Done.**

## Phase 4 — Item tracker ✅

- [x] Reconciled our 53 icons against the canonical list. **61 of 67 canonical items
      resolve to art**; the 6 that do not are consumables and refills, which a tracker
      has no reason to show. So the icon set is complete
- [x] Two name mismatches aliased rather than renaming files: `Gaia's Armor` ↔
      `Gaia Armor`, `Knight Sword` ↔ `Knight's Sword`
- [x] The 8 `Progressive *` placeholders borrow their first tier's art
- [x] **Item panel** in a left sidebar: Key Items, Spells, and Gear. Owned items show
      in full colour, unowned are dimmed and desaturated — readable without a legend
- [x] **Gear cycles through tiers** (click advances, right-click steps back, wraps at
      the top) with the tier number badged. Owning a tier implies the ones below it,
      which is how the game plays and how the logic reads it
- [x] Items live on the run record as canonical names, so Phase 6 can drop
      Archipelago's item names straight in
- [x] `getOwnedItemNames()` is the seam the logic engine will consume

### Two bugs found on the way

**Upstream:** `Progressive Claw` is tagged into the **Axes** group instead of Claws
in `worlds/ffmq/Items.py`. Our logic resolves a bare `Claw` requirement through
`itemGroups.Claws`, so uncorrected this would have made every claw-gated check
unreachable for anyone playing with progressive gear. Corrected in the sync, with
the correction recorded in `meta.json` rather than applied silently.

**Ours:** `normaliseGame()` in the migration lists run fields explicitly, so it was
**silently dropping `items` on every read** — the item tracker appeared to work and
then forgot everything. Caught by the tests, not by clicking around. A comment now
warns that new run fields must be added there too.

**Done.**

## Phase 5 — Logic engine

### Engine built (colours and panels still to come)

- [x] **Rule evaluation** (`engine/rules.js`) — `has_all` semantics, weapon-class
      groups, counted requirements, and `never`. Unknown requirement types fail
      closed, because over-reporting reachability is the damaging direction
- [x] **Reachability fixpoint** (`engine/reachability.js`) — follows chains of linked
      entrances, and iterates because triggers grant events which open further links
- [x] **Shuffle pools** from `shuffling_data`, with overworld as its own toggle
- [x] **Sky Coin modes** (`engine/skyCoin.js`) — upstream *replaces* the Sky Door rule
      in code rather than data, and the rule baked into the data is the most
      restrictive of the four, so all four modes needed encoding
- [x] Counted items, so shattered-coin fragment thresholds evaluate properly
- [x] **Run settings** on the save, with a settings modal
- [x] 42 engine tests

Sanity numbers from the finished engine:

| scenario | rooms | checks in logic | unexplored exits |
|---|---:|---:|---:|
| vanilla, no items | 13/220 | 13/266 | 0 |
| vanilla, coins only | 88/220 | 95/266 | 0 |
| **vanilla, every item** | **220/220** | **266/266** | 0 |
| fully shuffled, every item, nothing discovered | 5/220 | 17/266 | 25 |

The third row is the load-bearing one and is pinned as a test: vanilla FFMQ with
every item is fully completable, so anything short of total coverage would mean
the graph, the rules or the event chain is wrong.

- [x] ~~Research: shuffle-pool membership~~ — **resolved.** `shuffling_data.towns_temples`
      (62 entrance ids); `RoomsGenerator.py` filters those from the pool unless
      `MapShuffle == everything`
- [x] Support the 1.7 option shape: `MapShuffle` (`none`/`dungeons_internal`/`dungeons_mixed`/
      `everything`) **plus a separate `OverworldShuffle` toggle** — they're orthogonal now
- [x] ~~Load vanilla pairings from `entrances_pairs`~~ — unnecessary: an unshuffled entrance resolves straight to its `toRoomId`, which is the same answer
- [ ] **Link validation** from `no_exits` / `blocked_oneways` / `forced_links` — reject
      impossible pairings instead of silently poisoning the logic
- [x] **Standard tracker colours** — green in logic / yellow out-of-logic / red no
      access, with a split gradient for mixed groups. Yellow is not invented: FFMQ's own
      `Logic` option defines *expert* as adding the crest teleporters, the
      Fireburg-Aquaria lava bridge and the Sealed Temple exit trick, and gates them
      behind a fake `ut_glitch` item otherwise. So yellow = reachable only via those
- [x] Colour is never the only signal — the glyph still says what kind of thing a
      marker is, and the tooltip spells the state out in words
- [x] Markers the binding could not resolve stay grey rather than being coloured on a
      guess. Roughly a third are still unbound, and a confident green lie is worse
      than an honest unknown
- [x] Player intent outranks logic: linked, cleared and dismissed markers keep their own
      colour rather than being repainted
- [x] **Unexplored exits panel** — the tracker's to-do list, straight out of the
      reachability pass. Grouped by floor, click to jump there, with exits we cannot
      place on a map counted separately rather than hidden
- [x] Rule evaluation: `has_all`, plus weapon-class groups (`Claw`/`Bomb`/`Sword`/`Axe`)
- [x] Reachability fixpoint over rooms given items + discovered links + settings.
      **Follows chains of linked entrances**: if A→B and B's room exits to C→D, everything
      reachable through that chain is in logic, recursively, until it hits an unlinked
      entrance or an unmet item requirement
- [x] UI: in-logic / out-of-logic / unreachable states on every marker, with the missing requirement on hover

- [ ] Routing: "how do I get to X" over the discovered graph
- [ ] ~~Opt-in spoiler/verify mode~~ — **deprioritised.** It would mean porting
      `RoomsGenerator.py` (~1,800 lines) into the bundle, which is the one piece of this design
      that adds significant runtime code for a non-essential feature. Against the
      "plain React + JSON" goal. Revisit only if verify mode proves it matters

**Done when:** the tracker can answer "where can I go right now, and what's left?"

## Phase 6 — Archipelago ⚠️ built, but coverage is limited

- [x] **Spike done.** `ws://localhost` and `ws://127.0.0.1` connect from an https page;
      only non-loopback `ws://` is blocked. Self-hosted rooms need no setup
- [x] `archipelago.js` 2.1.0 (zero dependencies), connecting **read-only** with the
      `Tracker` tag — the tracker never sends checks, the game client owns that
- [x] **Connection UI**: server / slot / password form, connect and disconnect, and a
      status line that names the actual failure rather than just "error"
- [x] **Always-visible state** in the sidebar: a coloured dot and label for
      disconnected / connecting / connected / failed
- [x] Host and slot are remembered between sessions; **the password never is**
- [x] **Settings auto-configure on 1.7+** — `map_shuffle`, `overworld_shuffle`,
      `crest_shuffle`, `sky_coin_mode`, `shattered_sky_coin_quantity` and `logic` are
      read from slot data. Feature-detected on `map_shuffle_seed`, not version-sniffed,
      because 1.7 lived in a fork
- [x] Received items mirror into the run, **counted** so Sky Fragments work
- [x] Checked locations tick our markers
- [x] **Never** derives the entrance layout from `map_shuffle_seed`, though it could

### The catch: only 11% of checks can be ticked

Items and settings come through in full — items match by canonical name and need
no binding at all. **Checks are a different story: only 28 of 266 AP locations
resolve to a marker**, because the chest/box binding is still mostly unresolved
(195 markers hold a candidate list rather than an answer).

So on a live room today: items and settings populate themselves, and roughly one
check in nine ticks off on the map. The rest still need ticking by hand.

This is stated in the connection dialog rather than left to be discovered. It is
not an AP problem — finishing the binding review fixes it, and nothing about the
AP layer needs to change when it does.

### Not verified against a live room

The connection, error handling and status states were exercised in a browser,
including a real `ws://localhost` attempt. What has **not** been tested is an
actual FFMQ room: slot-data field names, item names arriving as expected, and
location ids matching. The slot-data mapping is unit-tested against the shape
upstream documents, but that is not the same as seeing it work.

## Phase 7 — Polish

- [ ] Global progress (X/360 entrances, X/266 checks) in the header
- [ ] Search across all floors by floor or marker name
- [ ] Undo for the last link/unlink
- [ ] Keyboard shortcuts: prev/next floor, world map, undo
- [x] Readable link tooltips — an instant hover card naming the destination floor and door
- [ ] Performance: stop re-parsing the whole save per marker per render
- [ ] Export nagging / autosave-to-file — localStorage is the only copy, and a cleared profile is total loss

---

## Sequencing notes

**Phase 1 gates 5 and 6.** Logic needs the binding to attach rules to; AP needs it
to map location ids to markers. Doing item tracking (Phase 4) early is optional —
it's independent and gives something visible quickly if you want a win sooner.

**Phase 2 before 5.** The logic engine will read run state constantly; fixing the
write path first avoids debugging the engine against corrupted saves.

**One research task remains on the critical path:** `ws://localhost` mixed content
(Phase 6), which decides whether self-hosted AP servers are supported. Answerable
in well under an hour; pull it forward if AP matters to you early.

The shuffle-pool question that was on this list is now answered — see Phase 5.

## Resolved during investigation

| Question | Answer |
|---|---|
| Shuffle pool membership per `MapShuffle` level | `shuffling_data.towns_temples` (62 ids); `RoomsGenerator.py` filters them unless `everything` |
| AP location id formula | Cross-validated against an independent tracker — all 266 ids match |
| Are entrances coupled? | Pairs by default (`entrances_pairs`), with `blocked_oneways` as the exception list |
| Can the browser reach a local AP server? | **No** — see below |
| Do floor images map 1:1 to canonical rooms? | **No** — see below |

### `ws://localhost` from an https page is blocked

Both Chromium and Firefox track this as an open *feature request*
([crbug 40386732](https://issues.chromium.org/issues/40386732),
[bugzilla 1376309](https://bugzilla.mozilla.org/show_bug.cgi?id=1376309)), which
means current behaviour blocks it. The loopback secure-origin exception covers
fetch/XHR but **not** WebSocket mixed content.

Consequence: **the GitHub Pages build can only talk to `wss://` servers** — in
practice, archipelago.gg-hosted rooms. Someone self-hosting AP on plain `ws://`
cannot be served by the hosted site at all.

Options, to decide before Phase 5:
- **(a)** Support archipelago.gg only, and say so plainly in the README
- **(b)** Also document "run the tracker locally" (`npm run dev` over http), where
  `ws://` works fine because the page isn't https
- **(c)** Ship an optional local/desktop build later

*Confidence: high, from browser bug trackers rather than a live test. Worth five
minutes of empirical confirmation before building around it.*

### Canonical rooms are finer-grained than floor images

**220 rooms vs 121 floor images.** Giant Tree 3F alone is **7 canonical rooms**
(`Central Island`, `Central Area`, `Lower Ledge`, `West Area`, `Middle Up Island`,
`West Platform`, `North Ledge`) spread across **2** of our floor images.

This is fine, but only because the binding is at **marker** level: every marker
points at one entrance or one object, and each of those belongs to exactly one
room, so the room is always derivable per-marker. Nothing may assume
floor == room.

The visible consequence: **one floor image can contain markers from several rooms
with different reachability** — part of a floor in logic, part not. The UI must
render that per-marker, which it already does.

## Open questions

*Battlegrounds, Hero Chests, local AP servers, map provenance, the map editor and
PopTracker reuse are all decided — see the decisions table at the top.*

### Needs answering before Phase 1 finishes

1. **How to author the remaining markers.** The editor is gone, so placing the
   ~26 missing markers needs a **dev-only** tool — a local route or a script,
   excluded from the production bundle. Consistent with "the data is ours to
   change, not the user's", but it has to exist before the gaps can be filled.

### Low-risk research, inside phases that already need it

2. **Exact `blocked_oneways` semantics.** We have the data and know where it's
   applied; we haven't confirmed the precise directional meaning. Read
   `RoomsGenerator.py`.
3. **Which entrances `OverworldShuffle` covers**, now that it's a toggle separate
   from `MapShuffle`.

### Accepted limitations — not open, just true

4. **Non-AP FFMQR runs get no auto-tracking.** Browser auto-tracking requires
   Archipelago, so a plain FFMQR seed is manual-only. Say so in the README.
5. ~~**Plain `ws://` self-hosted AP is unreachable from the hosted site.**~~
   **Wrong — tested and corrected.** Loopback is exempt from mixed-content
   blocking, so `ws://localhost` works from the hosted https site with no
   certificate. Only non-loopback self-hosting needs `wss://`.
6. **The entrance layout is never derived automatically**, even though 1.7 makes
   it possible.

### The real unknown

7. **How much of the binding is ambiguous.** Mapping 599 existing markers onto
   canonical entrance/object ids is the largest uncertainty in the plan. Much will
   match on position and type; some fraction will need manual disambiguation, and
   that fraction decides whether Phase 1 is days or weeks. Size it with a dry run
   early rather than discovering it late.
