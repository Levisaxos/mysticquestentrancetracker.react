import binding from '../data/binding.json';
import { LOCATIONS_DATA } from '../constants/locationsData';

const TILE = 16;

/**
 * Turning "where the game says the player is" into "which sheet to show".
 *
 * The Sub Map ID the game keeps at $7E0E91 is the same number as the `area`
 * field on our canonical entrances, so the room the player is standing in
 * already names an area, and binding.json already ties areas to our floors.
 *
 * The catch is that the tie is not one-to-one. Our maps are drawn finer than
 * the game's areas — nine sheets for Bone Dungeon's four areas, seven for
 * Windia's one — so an area frequently names several sheets and the room id
 * alone cannot say which. The player's own coordinates settle it: whichever
 * sheet they land inside is the sheet they are looking at.
 */

// The world map is area 0, and it is the one sheet the binder never assigns:
// its markers are matched to overworld entrances by name instead, because those
// entrances carry no tile coordinates to align against. It still needs to be
// here — the overworld is where a player spends most of their time.
const WORLD_MAP_FLOOR = '10101';
const OVERWORLD_AREA = 0;

const floorsByArea = new Map([[OVERWORLD_AREA, [{ floorId: WORLD_MAP_FLOOR, offset: null }]]]);
for (const [floorId, bound] of Object.entries(binding.floors)) {
  if (bound.areaId == null || !Array.isArray(bound.offset)) continue;
  if (!floorsByArea.has(bound.areaId)) floorsByArea.set(bound.areaId, []);
  floorsByArea.get(bound.areaId).push({ floorId, offset: bound.offset });
}

// The extent of each sheet's markers, as a stand-in for the extent of the image
// itself, which our map data does not record. Padded generously: markers sit on
// doors and chests, so they cluster well inside the edges of a room.
const PADDING = 6 * TILE;
const extents = new Map();
for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
  if (!markers.length) continue;
  const xs = markers.map((m) => m.x);
  const ys = markers.map((m) => m.y);
  extents.set(floorId, {
    left: Math.min(...xs) - PADDING,
    right: Math.max(...xs) + PADDING,
    top: Math.min(...ys) - PADDING,
    bottom: Math.max(...ys) + PADDING,
  });
}

/** Where the player is on a given sheet, in that image's own pixels. */
export function pixelOn(floorId, reading) {
  const bound = binding.floors[floorId];
  if (!bound || !Array.isArray(bound.offset) || !reading) return null;
  return {
    x: (reading.x - bound.offset[0]) * TILE,
    y: (reading.y - bound.offset[1]) * TILE,
  };
}

/** How far outside a sheet a point falls; 0 when it is inside. */
function distanceOutside(floorId, point) {
  const box = extents.get(floorId);
  if (!box) return Number.POSITIVE_INFINITY;
  const dx = Math.max(box.left - point.x, 0, point.x - box.right);
  const dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
  return Math.hypot(dx, dy);
}

/**
 * Which of our floors the game is currently showing, or null if we cannot say.
 *
 * Returns null rather than a best guess when nothing fits: yanking the view to
 * the wrong room is worse than leaving the player where they were.
 */
export function floorForReading(reading) {
  if (!reading || reading.subMapId == null) return null;

  const candidates = floorsByArea.get(reading.subMapId) ?? [];
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0].floorId;

  // A candidate with no offset cannot be placed by coordinates, so it can only
  // win uncontested — which is the world map's situation.
  const placeable = candidates.filter((c) => Array.isArray(c.offset));
  if (!placeable.length) return candidates[0].floorId;

  let best = null;
  for (const candidate of placeable) {
    const point = pixelOn(candidate.floorId, reading);
    if (!point) continue;
    const distance = distanceOutside(candidate.floorId, point);
    if (!best || distance < best.distance) best = { floorId: candidate.floorId, distance };
  }

  // Every candidate wildly off means the offsets are wrong for this area, not
  // that one of them is right.
  if (!best || best.distance > 40 * TILE) return null;
  return best.floorId;
}

/** How many of our floors this can currently reach, for the connection panel. */
export function followCoverage() {
  const floors = Object.keys(LOCATIONS_DATA).length;
  const reachable = new Set();
  for (const list of floorsByArea.values()) for (const c of list) reachable.add(c.floorId);
  return { reachable: reachable.size, floors };
}
