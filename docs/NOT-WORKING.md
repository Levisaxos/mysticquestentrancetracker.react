# What's Broken, Stubbed, or Missing

> **Phases 0–2 are done.** Items 1, 2, 3, 6, 7, 8, 9, 10, 17, 18 and 20 below are
> fixed, and the map editor (4, 5) was removed outright. Kept here as a record of
> what was wrong and why. See [PLAN.md](PLAN.md) for current state.

Ordered roughly by how much it hurts. File references are `path:line`.

---

## 🔴 Blocking / clearly broken

### 1. The test suite fails
`src/App.test.js` is untouched CRA boilerplate looking for a "learn react" link.
Verified: `CI=true npx react-scripts test --watchAll=false` → **1 failed, 1 total**.
There are zero real tests — no coverage on `gameService`, `locationTrackerService`,
or `navigationService`, which are where all the logic lives.

### 2. `CI=true` builds fail
A plain `npm run build` succeeds (81.41 kB gz). With `CI=true` — what every CI
runner sets — CRA promotes warnings to errors and it fails on four items:

- `src/components/GameTracker.js:72` — `findFirstAvailableBattleground` assigned, never used
- `src/components/MapViewer.js:231` — `getDefaultLocationName` assigned, never used
- `src/components/MapViewer.js:87` — `useEffect` missing dep `loadImage`
- `src/components/TrackerMapViewer.js:109` — same missing dep

### 3. Tailwind isn't declared as a dependency
`postcss.config.js` requires `tailwindcss` and `autoprefixer`, but neither appears
in `package.json`. They only survive because `package-lock.json` still carries
them (3.4.17 / 10.4.21). Delete the lockfile, or run any `npm install <pkg>` that
re-resolves the tree, and the styling silently disappears.

### 4. The map editor cannot edit the real data
`MapViewerContainer.js` keeps user-created markers in React state (`locations`)
and merges them with `LOCATIONS_DATA` only for *display*. So:

- `handleLocationEdit` / `handleLocationDelete` map over `locations[floorId]`
  only — **editing or deleting any of the 599 existing markers silently does
  nothing**
- nothing is persisted; a refresh throws away all editor work
- `nextLocationId` starts at `1` (`MapViewerContainer.js:18`), colliding with
  existing marker ids 1–599 until the renumbering export runs

### 5. Connect Doors mode in the editor is a stub
`MapViewerContainer.js:167` — `// TODO: Implement door connection logic here`.
It pops an `alert()` saying the doors were connected and then discards it.
(The tracker's own linking is fine — this is only the editor's version.)

---

## 🟠 Real bugs

### 6. Import can yank you out of the games list
`MainAppContainer.js:14-21` re-runs its startup effect on `refreshTrigger`, and
`handleImportExport` bumps that trigger. If a `current_game_id` exists, importing
a file teleports you into the tracker instead of showing the imported games.

### 7. `setState` during render
`MainAppContainer.js:66` calls `setCurrentMode('games')` inside
`renderCurrentMode()`. React will warn, and under StrictMode this is a
double-render hazard. It should be an effect or a derived value.

### 8. Import id assignment is off
`MainHeader.js:48` computes `Math.max(...games.map(g => g.id)) + importCount + 1`
against a `games` array captured *before* the loop, so ids depend on a counter
racing a stale snapshot. Also: no validation of the imported shape beyond
"has a `games` array", and no confirmation before merging into existing saves.

### 9. "Doors Linked" on the game card double-counts
`GameCard.js:17` counts every `locationState` with `isLinked === true`. Each link
writes *both* ends, so a run with 10 linked pairs reports **20**. The per-floor
counter in the nav bar is correct; only the card is wrong.

### 10. Door states are saved with `floorId: 0`
`locationTrackerService.js:35,57` pass `0` as the floor when creating a door's
state record. The floor a door belongs to is therefore lost from
`locationStates`, which blocks any future "progress per floor/region" report that
wants to read it back out of the save.

### 11. Editor's View mode alerts `undefined`
`MapViewer.js:133` — `alert(...Description: ${location.description})`. No marker
in `LOCATIONS_DATA` has a `description` field, so it always prints `undefined`.

### 12. Global right-click is disabled while the editor is mounted
`MapViewer.js` attaches a `document`-level `contextmenu` preventDefault. It's
cleaned up on unmount, but while the editor is open the browser context menu is
dead everywhere on the page, not just over the map.

### 13. Linked-door tooltips show a raw id
`TrackerLocationButton.js` renders `(linked to location 4711)`. There's no
"→ Fire Region · Lava Dome · Area 3" text, which is exactly what a tracker user
wants to read without clicking through.

### 13b. Markers respond to `onMouseUp`, not `onClick`
`TrackerLocationButton.jsx` handles activation in `onMouseUp` so it can tell left
from right button. Consequences: a `<button>` that cannot be activated from the
keyboard (Enter/Space fire `click`, never `mouseup`), and it is invisible to
assistive tech and to synthetic clicks. Found while verifying the battleground
change — the behaviour was correct, but the automated click never reached it.
Fix alongside the Phase 3 link picker, which needs a keyboard path anyway.

### 13c. Links were invisible to the logic engine
`doorConnections` is keyed by *our* marker ids, but the engine works in canonical
entrance ids. The first wiring passed marker ids straight through, so the engine
saw no links at all — every door read as "not yet linked" and reachability never
accounted for anything the player had discovered. Now translated through the
binding, and markers the binding cannot resolve are excluded rather than guessed.

### 13d. A hook below an early return
`TrackerLocationButton` returns null before the image has been measured, and the
tooltip's `useState` sat *below* that return. The hook count therefore changed
between renders and the hover state silently never stuck. Moved above the guard.

### 13e. A linked door was coloured without checking you could reach it
`describeBehindDoor` looked only at what lay beyond a linked door, so one
sitting in a room with no route to it still showed green — while the door beside
it, unlinked, correctly showed red. Two markers in the same unreachable room
disagreed. Reachability is now checked first, and a regression test asserts
those two markers agree.

### 13f. Overworld pairings resolved to the wrong room
Upstream pairs an overworld entrance with an *inside* one, so the engine
resolved a pairing to the partner's own room. But on our world map a player
naturally links two overworld icons — "I stepped on this one and arrived over
there" — which resolved to the subregion they were already standing in and
opened nothing. Pairing with an overworld icon now means "leads where that icon
leads".

### 14. Per-marker localStorage reads
`TrackerLocationButton` calls `locationTrackerService.getLinkedDoor()` during
render, and that does a full `JSON.parse` of the entire games blob — once per
marker, per render. On the world map (51 markers) that's 51 full parses each
time anything changes. Fine today, but it's the first thing that will feel slow.

---

## 🟡 Missing features

### 15. No item tracker
`src/constants/itemsData.js` defines 53 items in 4 categories (Armor 12, Key
Items 17, Spells 12, Weapons 12), `itemPaths.js` maps them, and all 53 PNGs are
in `public/images/items/`. `gameDataService.js` exposes a clean API over it.
**None of it is imported by any component.** There is no UI to mark an item as
found, and `game` records have no item field.

### 16. No run-wide progress view
`navigationService.js:73` `getFloorsWithLocationType()` and `:105`
`getFloorsWithLinkedDoors()` are fully written and **never called**. They are
clearly meant to power "show me every floor that still has an unlinked door /
unopened chest" — the single most useful feature for an entrance rando, and it's
one screen away from existing.

### 17. No way to close a run from inside the tracker
`GameTracker.js:10` accepts `onCloseGame` and never uses it, so
`MainAppContainer.handleGameClosed` — the only thing that clears
`current_game_id` — is unreachable. "Back to Games" changes the view but leaves
the run marked current, so the next reload dives back into it.

### 18. Header placeholder
`MainHeader.js:155` renders a hardcoded `Last updated: Never`.

### 19. No undo, no keyboard shortcuts, no search
No undo stack for an accidental link, no hotkeys for prev/next floor, no way to
search for a floor or marker by name across 121 maps.

---

## ⚪ Dead code / cruft

| File | Status |
|---|---|
| `src/services/gameDataService.js` | never imported |
| `src/constants/itemsData.js`, `spritesData.js` | only reached via the unused service |
| `src/constants/imagePaths.js` (219 lines) | never imported; superseded by `mapData.js`, and its Foresta entry still contains an HTML-escaped `Kaeli&#39;s House` path that would 404 |
| `src/components/NavigationButtons.js` | never imported; replaced by buttons inlined in `NavigationBar` |
| `src/App.css`, `src/logo.svg` | CRA boilerplate, never imported |
| `src/reportWebVitals.js` | not imported by `index.js` |
| `README.md` | still the stock CRA readme |
| `TrackerMapViewer.js:23` `navigationMessage` | state + timer written, never set to anything |
| `connectingMode` prop | threaded through two components, hardcoded `false` |
