# Backlog

Ideas raised mid-build that don't belong to the phase in progress. Fed into
[PLAN.md](PLAN.md) when their phase comes up.

---

## Logic colours — standard tracker palette

**Raised:** during Phase 3. **Belongs to:** Phase 5 (logic engine), because the
colours are meaningless until reachability is computed.

Adopt the conventional randomiser-tracker palette, matching what PopTracker does:

| colour | meaning |
|---|---|
| **Green** | in logic — reachable with what you have |
| **Yellow** | out-of-logic access — reachable, but not by intended means |
| **Red** | no access — unreachable |

### Mixed states

A marker that stands for **several** checks (a container group, or a floor
summarised in a list) shows a **split colour** when its contents disagree — part
in logic, part not. PopTracker splits the marker rather than picking one colour,
and losing that distinction is what makes a tracker lie to you: a group rendered
entirely green when only one of four checks is reachable is worse than no colour
at all.

### Notes for implementation

- This replaces the current type-based colouring (grey `?`, yellow linked, etc.)
  for **state**, but the shape/glyph should keep telling you what *kind* of thing
  a marker is. Colour = reachability, glyph = type.
- Needs the reachability fixpoint from Phase 5, including chains of linked
  entrances, before any of it is truthful.
- Keep the existing "disabled / dealt with" small red marker distinct from
  "no access" red — they mean different things. Possibly desaturate or use an
  outline for user-dismissed markers.
- Check contrast: yellow on the dark slate background needs care, and
  green/red alone is a problem for colour-blind users. Pair colour with the
  glyph or a border so it is never the only signal.

---

## Map auto-tracking — follow the player's current room

**Raised:** during Phase 3. **Belongs to:** Phase 6-ish, but **independent of
Archipelago** — it could ship on its own.

Full investigation: **[MAP-AUTOTRACKING.md](MAP-AUTOTRACKING.md)**. In short:

- AP cannot do this — the protocol carries no position, and the FFMQ client
  never reads or publishes a map id.
- SNI can. `$7E0E91` is the current room, and it appears to be **the same
  numbering as `entrance.area`** in our canonical data, so
  `subMapId → areaId → floorId` is a lookup. `binding.json` already has 96 of
  the 121 floors mapped.
- Only works from a local http build; `ws://localhost` is blocked from the
  hosted https site and SNI has no TLS mode.
- Reading player X/Y as well gives a "you are here" dot nearly for free, and
  disambiguates the 26 floors that share an area with another floor image.

Three empirical checks are listed at the end of that doc; none have been run.
There is also an **open design question** in it about auto-detecting entrance
transitions, which should be settled before any of this is built.

---

---

## Done

### Navigation moved into the left sidebar
**Raised:** Phase 4. **Done:** Phase 5.
The full-width navigation strip is gone. Region/location/floor selects, prev/world/next,
the four stat tiles, the exits button and close/edit all live in a 240px sidebar column
above the item tracker, and the map header collapsed from two rows to one inline row.
The map gets that vertical band back.

### AP connection interface
**Raised:** Phase 5. **Belongs to:** Phase 6, next up.
Needs: a form for host/port/slot/password, a connect/disconnect action, and a visible
connection state (disconnected / connecting / connected / failed, with the error).

### Battlegrounds: right-click only
**Raised:** Phase 3. **Done:** Phase 3.
Left-click is now a no-op (they are checks, not links), right-click toggles
cleared, and a cleared battleground collapses to the same small red marker a
dismissed door gets.
