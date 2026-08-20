# Data Coverage

Numbers below were computed by evaluating `src/constants/mapData.js` and
`src/constants/locationsData.js` and stat-ing every referenced file.

## Map hierarchy

| Region | Locations | Floors |
|---|---:|---:|
| World Map | 1 | 1 |
| Earth Region | 4 | 15 |
| Center of the World | 1 | 4 |
| Water Region | 8 | 23 |
| Fire Region | 5 | 30 |
| Wind Region | 10 | 38 |
| Other Regions | 2 | 10 |
| **Total** | **31** | **121** |

## Image assets

- **121 / 121** floors reference an image that exists on disk — no broken paths.
- 130 map PNGs are present; **11 are not referenced by `MAP_DATA`**.

Unreferenced images (each is probably a missing floor entry — most are the
"before the crystal is restored" variants of maps that already exist):

```
Center of the World/Focus Tower/The Old Man shows Benjamin the Focus Tower..png
Earth Region/Foresta/Decayed Foresta..png
Earth Region/Hill of Destiny/The Hill of Destiny..png
Earth Region/Level Forest/Decayed Level Forest..png
Water Region/Aquaria/Frozen Aquaria..png
Water Region/Falls Basin/Within Falls Basins frozen waterfall..png
Wind Region/Alive Forest/Alive Forest after the lake as been restored..png
Wind Region/Alive Forest/Alive Forest after transporting the heroes..png
Wind Region/Alive Forest/Decayed Alive Forest before the Crystal of Earth i.png
Wind Region/Windia/Windia..png
World Map/Map of Mystic Quest_2.png
```

`Hill of Destiny` and `Windia` stand out: Windia is listed as a *location* in
`MAP_DATA` (Wind Region) but its own town map is not one of its floors, and Hill
of Destiny has no entry at all.

## Markers

**599 markers, all with unique ids, zero duplicates, spread over 122 keys.**

| Region | Floors | Doors | Battlegrounds | Chests | Boxes |
|---|---:|---:|---:|---:|---:|
| World Map | 1 | 31 | 20 | 0 | 0 |
| Earth Region | 15 | 28 | 0 | 7 | 18 |
| Center of the World | 4 | 21 | 0 | 3 | 2 |
| Water Region | 23 | 59 | 0 | 5 | 49 |
| Fire Region | 30 | 83 | 0 | 4 | 50 |
| Wind Region | 38 | 100 | 0 | 4 | 54 |
| Other Regions | 10 | 33 | 0 | 5 | 22 |
| _orphan floor 40302_ | 1 | 0 | 0 | 0 | 1 |
| **Total** | | **355** | **20** | **28** | **196** |

Every one of the 121 real floors has at least one marker, and every floor except
the orphan has at least one door or battleground.

## Reconciled against canonical FFMQ data

The Archipelago FFMQ world ships a complete machine-readable room graph
(`worlds/ffmq/data/rooms.py`: 220 rooms, 490 entrance definitions, 360 used
entrance links, plus per-object access rules). Comparing our hand-entered
markers against it:

| | canonical | ours | delta |
|---|---:|---:|---:|
| Battlefields | 20 | 20 | ✅ exact |
| Entrance links | 360 | 355 | **−5** |
| Chests | 33 | 28 | **−5** |
| Boxes | 201 | 196 | **−5** |
| NPC checks | 16 | 0 | **−16** (no marker type exists) |

### What this changes

1. **The 28-chests-vs-196-boxes ratio is correct**, not inverted. An earlier
   draft of this document flagged it as a suspected data-entry mix-up; the
   canonical split really is 33 chests to 201 boxes. No audit needed.

2. **The odd door count is a real gap.** Canonical is 360 entrance links — an
   even number, as expected. We are 5 short.

3. **We are missing exactly 5 of each** of chests, boxes and entrances. The
   repeated 5 suggests a small number of rooms were never marked up rather than
   scattered omissions. A reconciliation pass against `rooms.py` will identify
   them precisely.

4. **NPC checks are entirely absent.** 16 AP locations are NPC-type and our
   marker vocabulary has no equivalent, so they cannot be tracked at all today.

## Remaining data issues

1. **Orphan floor `40302`.** `LOCATIONS_DATA` has a key `40302` holding one box,
   but no floor with that id exists in `MAP_DATA`. The marker is unreachable.

2. **11 unreferenced map images**, notably `Windia` and `Hill of Destiny`, which
   look like genuinely missing floors.

3. **No `type: "item"` markers exist**, though the editor supports placing them
   and 53 item sprites ship in `public/images/items/`.
