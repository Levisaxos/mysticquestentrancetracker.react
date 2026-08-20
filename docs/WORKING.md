# What Works Today

Everything below was read out of the source and cross-checked against the data
files; the build and render were exercised, individual click paths were not
manually clicked through in a browser.

## 1. Shell and mode switching

`src/components/MainAppContainer.js` holds three modes — `games`, `tracker`,
`editor` — and swaps the body underneath a persistent header
(`src/components/MainHeader.js`). On startup it reads `current_game_id` from
localStorage and jumps straight into the tracker if a run is in progress.

## 2. Game management

`src/services/gameService.js` — a complete localStorage CRUD layer:

- create a run (auto-incrementing id, `startDate` / `lastPlayed` stamps)
- list, split into **Active** and **Finished** tabs, with counts
- archive / unarchive (`finishGame` / `unfinishGame`)
- delete, with a confirm dialog
- "current game" pointer so a reload resumes where you left off
- per-run stats on the card: doors linked, chests opened, boxes opened

UI: `GameList.js`, `GameCard.js`, `CreateGameModal.js`. Empty states, a floating
"+" button, and modal focus/Escape handling are all in place.

## 3. Map navigation

`src/services/navigationService.js` flattens `MAP_DATA` into a single ordered
list of 121 floors and drives:

- three cascading dropdowns (Region → Location → Floor), each auto-selecting the
  first child when the parent changes
- **Previous / Next** stepping across the whole flattened list, so Next at the
  last floor of a location rolls into the next location and then the next region
- a **🌍 World** button that jumps back to the world map (region 1 / location 101
  / floor 10101)
- correct enable/disable of Previous/Next at the ends of the list

## 4. Map rendering

`TrackerMapViewer.js` loads the floor image via a probe `Image()` (so it can show
a spinner and a graceful "image failed to load" panel), then overlays markers.
Marker positions are stored in the image's *natural* pixel coordinates and
rescaled on every render from `clientWidth/naturalWidth`, with a `ResizeObserver`
re-measuring on layout changes — so markers stay glued to the map at any window
size. All 121 referenced images exist on disk.

## 5. Door / entrance linking — the core feature

In `GameTracker.js` + `locationTrackerService.js`:

- left-click an unlinked door → it turns blue with a `?` and becomes "selected"
- left-click a second door (**on any floor** — the selection survives navigation)
  → the two are linked bidirectionally and both turn yellow
- left-click an already-linked door → the app searches every floor for the
  partner, navigates there, and highlights it in purple until your next action
- left-click the *same* door you selected → self-link, which the UI renders as a
  green battleground (`B`, or the battleground number)
- right-click a door/battleground → mark it disabled/useless (dark red)
- **Edit mode** (red button, far right of the nav bar) → left-click a linked door
  to disconnect the pair, or a disabled door to reset it

Links live in `game.doorConnections` as a symmetric `door_<id> → door_<id>` map,
plus per-marker records in `game.locationStates`. Both are written through
`gameService.saveGame`, so everything survives a reload.

## 6. Chest / box tracking

Right-click a chest or box to toggle opened/closed. Sprites swap between
`chest_closed/chest_opened` and `box_closed/box_opened`
(`public/images/sprites/`, all four present). Closed containers get a coloured
halo; opened ones go transparent.

## 7. Per-floor progress

The nav bar shows three live counters for the current floor — Doors Linked,
Chests Opened, Boxes Opened — recomputed whenever an action fires
(`NavigationBar.js`, keyed off `refreshTrigger`).

## 8. Export / import

Header buttons produce/consume a JSON file containing every game plus the current
game pointer (`{ games, currentGameId, exportDate, version: "1.0" }`), downloaded
as `mystic_quest_tracker_export_<date>.json`. Import also accepts the older
single-game format. Caveats in [NOT-WORKING.md](NOT-WORKING.md).

## 9. Styling

Tailwind 3.4 with a custom dark palette and hand-rolled component classes
(`.select-dark`, `.btn-nav`, `.btn-primary`…) in `src/index.css`, plus themed
scrollbars. The look is consistent across every screen.

## 10. Map editor — the parts that do work

`MapViewerContainer.js` / `MapViewer.js` / `LocationModal.js`:

- five modes: View, Place Doors, Add Chests/Boxes, Edit Locations, Connect Doors
- click-to-place converts screen coordinates back to natural image coordinates
- left/right click place different types (door/battleground, chest/box) with
  auto-numbering per floor
- a modal for naming a marker and picking an item sprite
- **Export Locations** dumps a merged `locationsData`-shaped JSON with freshly
  renumbered unique ids — this is evidently how the existing 599 markers were
  produced, and it still works
