# Project Status — Mystic Quest Entrance Tracker

_Assessed 2026-08-20 against commit `2706129`. **Phase 0 is complete** — see
[PLAN.md](PLAN.md); the notes below describe the tracker's features, which Phase 0
did not change._

## One-line summary

The **tracker** is a working end-to-end product: you can create a run, walk all 121
maps, link doors, tick off chests/boxes, and export/import your progress. The
**map editor** that produced the marker data is a half-finished internal tool, and
the **item tracker** hasn't been started despite its data and art being in place.

## Completion at a glance

| Area | State | Notes |
|---|---|---|
| Game management (create / load / archive / delete) | ✅ Done | localStorage-backed |
| Map navigation (region → location → floor, prev/next, world map) | ✅ Done | 7 regions, 31 locations, 121 floors |
| Map asset coverage | ✅ Done | 121/121 referenced images exist on disk |
| Marker data (doors, battlegrounds, chests, boxes) | ✅ Done | 599 markers across 121 floors |
| Door linking + cross-floor jump-to-partner | ✅ Done | bidirectional, persisted |
| Chest / box tracking | ✅ Done | right-click toggle |
| Disable ("useless") markers | ✅ Done | right-click on door/battleground |
| Edit mode (undo a link) | ✅ Done | |
| Per-floor progress counters | ✅ Done | doors / chests / boxes |
| Export / import all data | ⚠️ Works, fragile | see [NOT-WORKING.md](NOT-WORKING.md) |
| Whole-run progress ("what's left anywhere?") | ❌ Missing | helper code exists, never wired up |
| Item tracker | ❌ Not started | 53 item images + 53 item records unused |
| Map editor | ⚠️ Partial | edits are in-memory only; connect mode is a stub |
| Tests | ✅ Fixed | 63 passing + 3 todo across 5 files, ~2s (Vitest) |
| CI-clean build | ✅ Fixed | Vite; ~1s, 76.9 kB gzipped |
| Tailwind declared | ✅ Fixed | was surviving on the lockfile alone |
| GitHub Pages deploy | ✅ Added | Actions workflow, tests gate the publish |
| Map editor | ➖ Removed | ~1,215 lines; data is ours to change, not the user's |

Rough completeness of the **thing the app is for** (tracking an entrance-rando run):
**~85%**. Rough completeness of the repo as a whole (editor + items + hygiene):
**~60%**.

## Verified this session

```
npm install        -> ok (1341 packages)
npx react-scripts build   -> ok, 81.41 kB gz JS / 4.65 kB gz CSS, 4 warnings
CI=true react-scripts build -> FAILS (warnings-as-errors)
CI=true react-scripts test  -> 1 suite, 1 test, 1 FAILED
```

## Direction

Settled after investigating PopTracker as an alternative and reconciling our data
against the canonical FFMQ room graph:

- **Not a rewrite.** The maps and markers are the irreplaceable asset.
- **Not a PopTracker pack.** Desktop-only, so it can't be hosted on GitHub Pages;
  and entrance rando is documented as the edge of what PopTracker can do.
- **Bind markers to the canonical Archipelago/FFMQR data**, synced automatically
  at build time. Unlocks logic, AP mapping and drift detection at once.
- **Full entrance-aware logic**, **Archipelago auto-tracking from the browser**,
  **Vite + GitHub Pages**.

## Where to read next

- [PLAN.md](PLAN.md) — the roadmap, phase by phase
- [BACKLOG.md](BACKLOG.md) — ideas raised mid-build, parked for their phase
- [ARCHITECTURE.md](ARCHITECTURE.md) — target design: data layers, logic, AP, storage
- [WORKING.md](WORKING.md) — feature-by-feature account of what actually works
- [NOT-WORKING.md](NOT-WORKING.md) — bugs, stubs and dead code, with file refs
- [DATA-COVERAGE.md](DATA-COVERAGE.md) — map/marker data inventory, reconciled
