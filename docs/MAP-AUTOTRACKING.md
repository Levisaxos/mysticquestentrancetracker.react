# Map auto-tracking — feasibility investigation

_Investigated 2026-08-20. **Research only** — nothing built, and nothing below
has been confirmed against a running emulator. Sources are upstream source code
and documentation; the empirical checks are listed at the end._

**Question asked:** can the tracker know which map the player is standing on in
the real game, and switch the view to it automatically?

## Verdict

| route | works? |
|---|---|
| Over the Archipelago connection | ❌ **No.** AP carries no position data at all |
| Over SNI (`ws://localhost:23074`), reading SNES RAM | ✅ **Yes**, from a local http build |
| ...from the deployed GitHub Pages site | ❌ blocked by mixed content, same as `ws://` AP servers |

The useful surprise: the SNI route **doesn't need Archipelago**. It reads the
emulator, not the server, so it works on a plain FFMQR seed too — and every FFMQ
AP player is already running SNI, so it costs them no extra setup.

## Why Archipelago can't do it

The AP protocol has no concept of where a player is. It carries checked
locations, received items, slot data and DeathLink — nothing positional.

The FFMQ client could in principle publish position to DataStorage, but doesn't.
[`worlds/ffmq/Client.py` @ `ffmq-1.7.b5`](https://github.com/Alchav/Archipelago/blob/ffmq-1.7.b5/worlds/ffmq/Client.py)
reads exactly six regions:

| address | what |
|---|---|
| `0x7FC0` (20 bytes) | ROM name |
| `0xF53749` (6 bytes) | validation checkpoint, read twice |
| `0xF50EA8` (64 bytes) | game flags — this is how it detects checks |
| `0xF50F22` | completion status |
| `0xF50FD4` (20 bytes) | battlefield data |
| `0xE01FF0` (3 bytes) | received-item index |

and sends only `LocationChecks` and `StatusUpdate`. No map read, no DataStorage
`Set`, no `Bounce`. There is nothing on the wire to listen to.

Changing that would mean forking the AP client and asking every player to
install it. Not worth it when SNI is already there.

## What can do it: SNI

FFMQ keeps the current room in WRAM
([Data Crystal RAM map](https://datacrystal.tcrf.net/wiki/Final_Fantasy:_Mystic_Quest/RAM_map)):

| address | meaning |
|---|---|
| `$7E0E88` | Map ID |
| `$7E0E89` / `$7E0E8A` | player X / Y on map, in tiles |
| `$7E0E8B` | facing direction |
| `$7E0E91` | **Sub Map ID** — the actual room |

SNI exposes a usb2snes-compatible WebSocket on `ws://localhost:23074`, on by
default (`SNI_USB2SNES_DISABLE 0`). A browser can open it and issue `GetAddress`
reads; `$0E88`–`$0E91` is 10 bytes, so one request per poll covers room,
position and facing. A few polls a second is plenty.

### The finding that makes this cheap

**`entrance.area` in our canonical data *is* the game's Sub Map ID.**

Checked Data Crystal's example values against the `area` field in
[`src/data/ffmq/entrances.json`](../src/data/ffmq/entrances.json):

| Data Crystal example | our `area` | |
|---|---|---|
| Overworld `$00` | 0 Overworld | ✅ |
| Ice Pyramid – Ice Golem room `$2a` | 42 Ice Pyramid Ice Golem Room | ✅ |
| Lava Dome – Entrance `$39` | 57 Lava Dome Inner Ring Main Loop | ✅ |
| Lava Dome – Twinhead Hydra room `$40` | 64 Lava Dome Hydra Room | ✅ |
| Pazuzu's Tower – Entrance `$53` | 83 Pazuzu Tower 1F Main Lobby | ✅ |
| Bone Dungeon – Skullrus Rex room `$07` | 7 Doom Castle | ❌ |

Five of six land exactly, including three non-obvious ones. The Bone Dungeon row
is most likely a wiki error — Bone Dungeon is areas 19–22 in our data,
contiguous and correctly named — but **verify it before building on this.**

Consequence: `subMapId → areaId → floorId → show that floor` is a table lookup.
[`src/data/binding.json`](../src/data/binding.json) already maps **96 floors to
an `areaId`**, one-to-one.

Map shuffle moves the doors between rooms, not the rooms themselves, so the
table is seed-independent. Build it once.

## What's missing

**26 floors have no `areaId`.** They are almost all *sub-parts of one area* —
`Area 2`, `Third Area`, `Area 7`, `Inn Second Floor`, the various house warp
rooms — which the strictly one-to-one binding couldn't represent. There are 121
floor images against 98 areas, so one area legitimately covers several images.

Fix: read `$0E89/$0E8A` too and pick the floor image whose markers contain that
point. The coordinates disambiguate what the room id alone cannot.

**Binding confidence is mixed** — 25 `high`, 27 `geometry-only`, 44 `name-only`.
That is shaky for marker-level binding, but floor→area is 121 rows a human can
check against the area names in about an hour. Worth doing by hand rather than
trusting the generated confidence.

## Constraint: the hosted build can't do this

`ws://localhost` from an https page is blocked as mixed content — the same
constraint already documented for self-hosted AP servers in
[PLAN.md](PLAN.md). Unlike the AP case there is **no `--cert` escape hatch**:
SNI does not serve TLS.

So map-following works under `npm run dev` (http) and not on GitHub Pages. That
ceiling should be stated plainly in the UI rather than failing silently — a
disabled connect button with "needs the local build" beats a spinner that never
resolves.

## Bonus: "you are here"

`align()` in [`scripts/build-binding.mjs`](../scripts/build-binding.mjs) stores a
per-floor `offset` with `TILE = 16`, and markers are already positioned in image
pixel space:

```
px = (gameX - dx) * 16
py = (gameY - dy) * 16
```

then scaled by the same `scaleX`/`scaleY` the markers use. A live player dot is
roughly twenty lines on top of existing plumbing, for floors with a trustworthy
offset.

## Open decision: auto-detecting entrance transitions

The same byte that says "show this map" also detects **which door the player
walked through**: the sub map id changes from A to B while the player is standing
on the tile of a known entrance in A. That's enough to auto-propose the link.

This is *not* the thing [ARCHITECTURE.md](ARCHITECTURE.md) rules out. That rule —
"never derive the layout automatically" — is about `map_shuffle_seed`, i.e.
knowing the answer without playing. Observing a door the player actually walked
through is the same information they would type in by hand a second later.

Different thing, but adjacent enough that it needs deciding **before** this gets
built, because it determines whether map auto-tracking is convenience navigation
or the tracker's primary input path.

## Verify before building

1. `$7E0E91` really is the room id, and matches `entrance.area` — walk into Bone
   Dungeon and read the byte. Settles the one row that didn't match.
2. A browser can actually open `ws://localhost:23074` and complete a usb2snes
   handshake with SNI. No Origin check is documented, but that's absence of
   evidence.
3. `$0E89/$0E8A` are in the same tile space as `entrance.coordinates`, so the
   offsets apply unchanged.

All three are an afternoon's spike. Do them before designing any UI.

## Sources

- [`worlds/ffmq/Client.py` @ `ffmq-1.7.b5`](https://github.com/Alchav/Archipelago/blob/ffmq-1.7.b5/worlds/ffmq/Client.py)
- [Data Crystal — FFMQ RAM map](https://datacrystal.tcrf.net/wiki/Final_Fantasy:_Mystic_Quest/RAM_map)
- [SNI](https://github.com/alttpo/sni) — usb2snes WebSocket listener, port 23074
- [QUsb2Snes protocol](https://github.com/Skarsnik/QUsb2snes/blob/master/docs/Protocol.md)
- [Archipelago network protocol](https://github.com/ArchipelagoMW/Archipelago/blob/main/docs/network%20protocol.md)
