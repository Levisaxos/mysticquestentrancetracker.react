# Target Architecture

The design we're building toward. See [PLAN.md](PLAN.md) for the order of work.

## Goals and constraints

| | |
|---|---|
| **What it is** | A standalone entrance tracker for Final Fantasy Mystic Quest randomizer |
| **Storage** | localStorage only. No database, no backend, no accounts |
| **Hosting** | Static site on GitHub Pages (free tier) |
| **Auto-tracking** | Archipelago, over WebSocket, from the browser |
| **Logic** | Full entrance-aware reachability |

Everything below follows from "static site + no backend". There is no server to
run logic on, so the logic runs in the browser; there is no database, so the
canonical game data ships as part of the bundle.

### The shipped artifact, precisely

**Plain React + JSON + localStorage. Nothing else.**

- No API calls at runtime — the canonical game data is JSON in the bundle
- No backend, no database, no server-side code of any kind
- No C# — FFMQRando is C#, but we never run or ship it; we only *read* its data
- Works offline once loaded

The build-time data sync described below is a **developer script that emits JSON
into the repo**. It runs in CI, never in the browser, and the deployed site has
no idea it exists. If even that feels like too much machinery, it degrades to a
manual `npm run sync-data` — the shipped output is identical either way.

## Why not PopTracker

Settled, with two independent reasons:

1. **It cannot be hosted.** PopTracker is a native desktop app; users install
   packs by dropping zips into a folder. Its README states WASM support "still
   needs a lot of work." This is incompatible with the GitHub Pages requirement.
2. **Entrance rando is its weak spot.** The ALttP Archipelago pack — among the
   most mature packs in existence — documents ER tracking as *"basically at the
   absolute edge of the bounds of PopTracker … finnicky … unintuitive."*

What we give up by not using it: built-in SNES-memory auto-tracking (reading the
emulator directly). A browser cannot do that. We can only auto-track via
Archipelago. For a non-AP solo FFMQR run, tracking stays manual.

---

## The three data layers

The central idea. Today the app has one hand-maintained data blob doing all
three jobs, which is why marker types, names and counts can drift from reality.

### Layer 1 — Canonical game data (generated, never hand-edited)

Synced from the **Archipelago FFMQ world, version 1.7+** — a single self-contained
Python module, `worlds/ffmq/data/rooms.py`, exporting everything we need:

| export | contents |
|---|---|
| `rooms` | 220 rooms with their objects and links |
| `entrances` | 493 entrance definitions |
| `entrances_pairs` | 139 vanilla entrance pairings |
| `shuffling_data` | pool membership and pairing constraints |

Contents as of 1.7.b5: **220 rooms**, **360 live entrance links**, and the checks —
**29 chests, 201 boxes, 16 NPCs, 20 battlefields** = **266 Archipelago locations**
(plus 4 `HeroChest` objects and 58 triggers, which are *not* AP locations).

Crucially it also carries **access rules, already written**, per link and per object:
`['DragonClaw', 'MegaGrenade']`, `['SandCoin']`, `['Bomb']`, …

That is the piece that makes logic tractable. We are not writing FFMQ logic from
scratch; we are evaluating rules that already exist.

> **Version note.** 1.7 is currently in [Alchav's fork](https://github.com/Alchav/Archipelago/releases/tag/ffmq-1.7.b5),
> not yet merged to Archipelago `main`. Upstream `main` still has the older world,
> which fetches room data from an external FFMQR web API and sends no slot data.
> We target 1.7+ and feature-detect (see [Archipelago integration](#archipelago-integration)).

This data is **synced from upstream automatically** rather than hand-copied — see
[Keeping canonical data in sync](#keeping-canonical-data-in-sync) below.


### Layer 2 — Presentation data (hand-maintained, yours)

What the canonical data has no concept of: **pictures and pixels.**

- `mapData.js` — the region → location → floor hierarchy and image paths
- `markers.js` — for each floor, marker positions in the image's natural pixel
  coordinates

This layer stays yours. It is the genuinely expensive, irreplaceable work in
this repo, and no upstream source provides it.

### Layer 3 — The binding (new)

A foreign key from each marker to the canonical entity it represents:

```js
// a shuffled entrance
{ x: 181, y: 456, ref: { t: 'entrance', id: 445 } }

// a check
{ x: 210, y: 300, ref: { t: 'object', room: 1, obj: 30 } }
```

Consequences, all of them good:

- `type` and `name` stop being hand-maintained — they're derived from Layer 1,
  so they cannot drift
- missing or duplicated markers become **detectable by diffing** against Layer 1
- AP location ids become computable (below)
- logic gets something to attach to

**Keep the current marker ids in the binding table.** They are the only way to
migrate existing saves, which key everything by those ids.

---

## Keeping canonical data in sync

### The external API is gone as of 1.7

Earlier FFMQ world versions fetched the room graph at generation time from
`https://api.ffmqrando.net/GenerateRooms?...`. **1.7 removed that**: shuffling is
now done inside Archipelago by `RoomsGenerator.py`, and all the data ships in
`data/rooms.py`.

That simplifies our sync considerably — one file, no network service, no CORS
question. (For the record, the API *does* still work and is on HTTPS, but it
sends no `Access-Control-Allow-Origin` header, so a browser could never have
called it directly anyway.)

### Decision: sync at build time

A scheduled GitHub Action re-fetches `worlds/ffmq/data/rooms.py`, regenerates
`src/data/ffmq/*.json`, runs the data-integrity tests, and opens a PR when
anything changed. Upstream fixes reach the tracker automatically, with a human
review gate, and the shipped site stays fully static and works offline.

We already have evidence this matters. Between the version vendored in
Archipelago `main` and 1.7.b5, the data moved: **490 → 493 entrance definitions**,
**47 → 58 triggers**, and chests were split into `Chest` (29) plus a new
`HeroChest` type (4). A hand-copied snapshot would silently rot.

### Never derive the layout automatically

1.7 puts `map_shuffle_seed` in slot data and ships the shuffle algorithm in
`RoomsGenerator.py`. Together these make the **entire entrance layout derivable**
— which is exactly how Universal Tracker support works.

We must not do that automatically. It is precisely the information an entrance
tracker exists to help you discover; computing it up front would defeat the app.

**Opt-in only**, clearly labelled as spoilers, and useful for:

- **verify mode** — check tracked pairings against truth after a race
- **practice** — study a known layout
- **testing our logic engine** against a known-correct graph

Porting `RoomsGenerator.py` (~1,800 lines) to JS is a large job, and it is the
only part of this design that would add meaningful runtime code for a
non-essential feature. Given the "plain React + JSON" constraint, the default
answer is **don't** — revisit only if verify mode turns out to matter.


## What we reuse vs. what we build

The guiding rule: **the entrance tracker and its logic are the only things
original to this project.** Everything else should come from upstream, so that
upstream fixes flow to us instead of rotting in a hand-maintained copy.

| Concern | Source | Notes |
|---|---|---|
| Room graph, entrances, checks | AP 1.7 `worlds/ffmq/data/rooms.py` | one module, no API |
| Access rules / logic requirements | same | already written, per link and per object |
| Vanilla entrance pairings | same (`entrances_pairs`) | 139 pairs |
| Shuffle pools + pairing constraints | same (`shuffling_data`) | `towns_temples` 62, `no_exits` 21, `priority_exits` 10, `forced_links` 13, `blocked_oneways` 6 |
| Item list, groups, weapon tiers | AP `worlds/ffmq/Items.py` | 81 items; groups incl. `Swords`/`Axes`/`Claws`/`Bombs` |
| Randomizer settings + values | AP `worlds/ffmq/Options.py` | see options note below |
| AP location ids | derived locally | formula cross-validated against an independent tracker |
| Item icons | already ours | byte-identical filename set to the D-Skye pack; nothing to import |
| **Map images** | **ours** | no upstream tracker has a comparable set — see below |
| **Marker pixel coordinates** | **ours** | the irreplaceable asset |
| **Entrance linking UX + ER logic** | **ours** | the actual product |

Licensing: the AP FFMQ world ships its own `LICENSE`; FFMQRando is MIT. Both need
attribution, neither blocks reuse.


### On maps specifically

There is no better upstream source to take. The only FFMQ PopTracker pack found
([`x10power/ffmq_pack_x10power`](https://github.com/x10power/ffmq_pack_x10power))
is a Twitch-chat-driven **item** tracker: no maps, no entrance tracking, no
Archipelago support. FFMQR's own `sprites/` and `MapTiles.cs` are ROM-patching
assets, not renderable floor maps.

So the 130 map PNGs in `public/images/maps/` stay ours and stay the thing that
makes this project viable at all.

### Item list needs reconciling too

Canonical is **81 items** (Key Items 16, Coins 4, Spells 12, Weapons 15, Armors 7,
Shields 4, Helms 3, Accessories 3, Consumables/Refills 6). Our `itemsData.js` has
**53** (Armor 12, Key Items 17, Spells 12, Weapons 12). The categories don't line
up — ours folds helms/shields/accessories into "Armor" and is short on weapons.
Same treatment as markers: bind to canonical, derive names and grouping.

---

## Logic engine

Pure functions over `(canonical graph, items, discovered entrance links,
shuffle settings)`. No React, no storage — trivially testable.

### Rule evaluation

Access rules are a list of required items, all of which must be held. Weapon
classes (`Claw`, `Bomb`, `Sword`, `Axe`) mean "any weapon of that class",
matching the AP world's `has_any(item_groups[w + 's'])`.

### Reachability

A fixpoint over rooms. Items are *known* (the user marks them, or AP reports
them), so there's no item-collection fixpoint to run — only connectivity:

```
reachable = { startRoom }
repeat until no change:
  for each room in reachable:
    for each link in room.links:
      if not rulesSatisfied(link.access, items): continue
      dest = resolveDestination(link)
      if dest: reachable.add(dest)
```

`resolveDestination(link)`:

| case | result |
|---|---|
| link has no `entrance` id (internal/subregion) | `link.target_room` |
| entrance is not in a shuffled pool for these settings | `link.target_room` |
| entrance is shuffled and the player has discovered its pairing | the paired entrance's room |
| entrance is shuffled and unpaired | unreachable — **and recorded as an unexplored exit** |

That last row is the whole product. The set of reachable-but-unpaired entrances
*is* the player's to-do list, and it falls out of the algorithm for free.

### What the UI derives from it

- **Unexplored exits** — reachable entrances with no pairing yet
- **Checks in logic** — reachable room + satisfied object rules, not yet collected
- **Out of logic** — greyed, with the missing requirement shown on hover
- **Routing** — BFS over the discovered graph: "how do I get to Fireburg?"

### Shuffle pools and pairing constraints — resolved

`shuffling_data` answers what the room graph alone could not:

```python
towns_temples:   [38, 42, 43, 44, 45, ...]   # 62 entrance ids
no_exits:        [47, 57, 63, 64, 100, ...]  # 21 — dead ends, no way back out
priority_exits:  [71, 77, 99, 114, 159, 192, 209, 278, 312, 341]
blocked_oneways: [[101, 100], [103, 100], ...]   # 6
forced_links:    [[89, 145], [90, 148], ...]     # 13
```

`RoomsGenerator.py` shows exactly how they are applied:

```python
towns_temples = set(shuffling_data["towns_temples"])
logic_links = [x for x in logic_links if x.current["entrance"] not in towns_temples]
...
link.exit          = link.current["entrance"] not in no_exits
link.priority_exit = link.current["entrance"] in priority_exits
```

So the pool rule is stated precisely, not inferred.

### The shuffle options changed in 1.7

Our earlier reading of the options is outdated. As of 1.7:

| option | values |
|---|---|
| `MapShuffle` | `none` · `dungeons_internal` · `dungeons_mixed` · `everything` |
| `OverworldShuffle` | separate **toggle** (was folded into `MapShuffle` before) |
| `CrestShuffle` | toggle |
| `ShuffleBattlefieldRewards` | toggle |

`everything` is the level that pulls `towns_temples` into the pool. Overworld
shuffle is now orthogonal to floor shuffle, so the UI needs both controls.


### Link validation — a feature this unlocks

`no_exits`, `blocked_oneways` and `forced_links` describe which pairings are
*possible*. That lets the tracker reject impossible input — "that entrance is a
dead end, it has no exit" — rather than silently accepting a wrong link and
poisoning the logic. Worth building; it's cheap once the data is loaded.

### Coupled or decoupled?

Largely answered: `entrancespairs.yaml` is a list of **pairs**, and
`blocked_oneways` enumerates the exceptions. So pairing is two-way by default
with a defined set of one-way cases. The current symmetric UI model is broadly
right, but the data model needs to represent those one-way exceptions rather
than assume symmetry everywhere.

---

## Archipelago integration

Client library: [`archipelago.js`](https://archipelago.js.org/stable/) — zero
dependency, explicitly targets all major desktop and mobile browsers.

### Connection

Connect as a **read-only tracker**. The tracker never sends location checks; the
game client owns that. User supplies host, port, slot name, optional password.

### What AP gives us

**This changed substantially in 1.7.** Earlier versions sent no slot data at all.

| | pre-1.7 | **1.7+** |
|---|---|---|
| Checked locations | ✅ | ✅ |
| Received items | ✅ | ✅ |
| Shuffle settings | ❌ user picks manually | ✅ **in slot data** |
| Map shuffle seed | ❌ | ✅ **in slot data** |
| Entrance mapping | ❌ | ❌ *(derivable from the seed — deliberately not used)* |

1.7's `fill_slot_data` returns `logic`, `sky_coin_mode`,
`shattered_sky_coin_quantity`, `map_shuffle`, `overworld_shuffle`,
`crest_shuffle`, `shuffle_battlefield_rewards`, `companions_locations`,
`kaelis_mom_fight_minotaur`, plus `map_shuffle_seed`.

So on 1.7+ the tracker can **configure itself on connect** — no settings form to
fill in, and no chance of the user picking the wrong shuffle mode and getting
nonsense logic. A real UX win worth building for.

**Feature-detect, don't version-sniff.** If `map_shuffle_seed` is present in slot
data, treat it as 1.7+ and auto-configure; otherwise fall back to asking. That
covers the transition while 1.7 is still an unmerged fork.

The entrance mapping stays manual **by choice**, not by limitation — see
[Never derive the layout automatically](#never-derive-the-layout-automatically).


### Location id mapping

Derivable locally from the canonical data — no `DataPackage` round-trip needed:

| type | formula | count |
|---|---|---|
| Chest / Box | `0x420000 + object_id` | 230 |
| NPC | `0x420000 + 300 + object_id` | 16 |
| Battlefield | `0x420000 + 350 + object_id` | 20 |

Chests and boxes share one id space, which is why they share an offset.
`HeroChest` and `Trigger` objects are **not** AP locations and must be excluded —
in 1.7 they have their own types, so this is a clean filter rather than the
name-matching hack older versions needed.

**Cross-validated:** checked against
[`D-Skye/ffmq-ap-poptracker`](https://github.com/D-Skye/ffmq-ap-poptracker), an
independently written FFMQ AP tracker. All **266** of its mapped location ids fall
exactly where the formula predicts, with none unaccounted for.


### Local Archipelago servers — supported, no setup needed

**Corrected after testing.** An earlier draft of this document claimed
`ws://localhost` was blocked from an https page, based on reading the Chromium
and Firefox bug trackers. That is wrong. Measured from a real https origin:

| target | result |
|---|---|
| `ws://localhost:38281` | ✅ connects (reaches the network layer) |
| `ws://127.0.0.1:38281` | ✅ connects |
| `ws://archipelago.gg:38281` | ❌ `SecurityError: An insecure WebSocket connection may not be initiated from a page loaded over HTTPS` |
| `wss://archipelago.gg:38281` | ✅ connects |

Loopback is treated as a potentially-trustworthy origin and is **exempt from
mixed-content blocking**, WebSockets included. The `readyState` went
`CONNECTING → error → CLOSED`, which is a connection failure because nothing was
listening — not a security refusal.

So every setup works from the hosted site:

1. **archipelago.gg rooms** — `wss://`, works
2. **Self-hosted on localhost** — `ws://localhost:PORT`, works, no certificate needed
3. **Self-hosted on a LAN address or remote host** — needs `wss://`, which
   `MultiServer.py --cert ... --cert_key ...` provides

Only case 3 needs any setup, and it is the rarest.

This also has a bearing on SNI-based map auto-tracking (see
[MAP-AUTOTRACKING.md](MAP-AUTOTRACKING.md)): SNI listens on `ws://localhost:23074`,
so it is reachable from the hosted site for the same reason.

## State and persistence

### Shape

```js
{
  v: 2,
  currentRunId: 3,
  runs: [{
    id, name, createdAt, lastPlayedAt, finishedAt,
    settings:       { mapShuffle, crestShuffle, battlefieldRewards },
    entranceLinks:  { [entranceId]: entranceId },   // symmetric
    checks:         { [apLocationId]: true },
    items:          { [itemName]: count },
    disabled:       { [entranceId]: true },
    ap:             { host, port, slot }            // never the password
  }]
}
```

### Rules

- **One write per user action.** The current code reads the save, mutates, and
  writes several times per action from stale snapshots — which is why
  `isLinked` never persists today (see [NOT-WORKING.md](NOT-WORKING.md)). A
  single store with one commit point removes the whole class of bug.
- **Versioned, with migrations.** `v1` (today's format) migrates to `v2` via the
  binding table. Existing runs must survive.
- **Export/import is the only backup.** No backend means a cleared browser
  profile is total loss, so export should be easy and ideally nagged.

---

## Build and deployment

- **Vite** replaces `react-scripts` (unmaintained since 2022), with `base` set
  to the repo path for Pages
- **GitHub Actions** builds and publishes to Pages on push to `master`
- Everything stays client-side; the deployed artifact is static files

## Testing strategy

The logic engine and services are pure and deterministic — that's where tests
earn their keep:

- **rule evaluation** — item sets vs access rules, weapon-class groups
- **reachability** — vanilla graph, fully-shuffled graph, partial discovery
- **AP id mapping** — round-trip every one of the 270 locations
- **data integrity** — every marker binds to a real canonical entity, every
  canonical entity has a marker, no duplicates
- **save migration** — a v1 fixture migrates to v2 without losing progress

That last data-integrity test is what stops the marker set from silently
drifting out of sync again.
