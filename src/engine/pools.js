import entranceLinks from '../data/ffmq/entranceLinks.json';
import entrancePairs from '../data/ffmq/entrancePairs.json';
import overworldEntranceIds from '../data/ffmq/overworldEntrances.json';
import shufflingData from '../data/ffmq/shufflingData.json';
import binding from '../data/binding.json';
import { LOCATIONS_DATA } from '../constants/locationsData';
import { MAP_DATA } from '../constants/mapData';

const OVERWORLD = new Set(overworldEntranceIds);
const TOWNS_TEMPLES = new Set(shufflingData.towns_temples ?? []);
const linkByEntrance = new Map(entranceLinks.map((l) => [l.entranceId, l]));

/**
 * Which shuffle pool an entrance belongs to, or null if this run does not
 * shuffle it. Mirrors RoomsGenerator.py: the overworld is its own pool, towns
 * and temples only join at "everything", and everything else is dungeon floors.
 */
export function poolOf(entranceId, settings = {}) {
  if (!linkByEntrance.has(entranceId)) return null;

  if (OVERWORLD.has(entranceId)) {
    return settings.overworldShuffle ? 'overworld' : null;
  }

  const mode = settings.mapShuffle ?? 'none';
  if (mode === 'none') return null;

  if (TOWNS_TEMPLES.has(entranceId)) {
    return mode === 'everything' ? 'town-temple' : null;
  }
  return 'dungeon';
}

// --- our own map hierarchy, used for the "same dungeon" rule ----------------

const markerByEntrance = new Map();
for (const [markerId, bound] of Object.entries(binding.markers)) {
  if (bound.kind === 'entrance') markerByEntrance.set(bound.entranceId, Number(markerId));
}

const locationOfFloor = new Map();
for (const region of MAP_DATA.regions) {
  for (const location of region.locations) {
    for (const floor of location.floors) locationOfFloor.set(String(floor.id), location.id);
  }
}

const locationOfMarker = new Map();
const floorOfMarker = new Map();
for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
  const locationId = locationOfFloor.get(floorId);
  for (const marker of markers) {
    locationOfMarker.set(marker.id, locationId);
    floorOfMarker.set(marker.id, floorId);
  }
}

/**
 * Which of our map locations an entrance sits in — "Bone Dungeon", "Ice
 * Pyramid". Upstream's intradungeon rule is `room.location == origin.location`,
 * and our own hierarchy is exactly that grouping, so we use it directly.
 */
export function locationOf(entranceId) {
  const markerId = markerByEntrance.get(entranceId);
  return markerId == null ? null : locationOfMarker.get(markerId) ?? null;
}

/**
 * Same question, asked of a marker instead of an entrance.
 *
 * The "same dungeon" rule only needs our own map hierarchy, which every marker
 * has — unlike the canonical binding, which is still incomplete. Asking the
 * marker means the rule holds for unbound markers too.
 */
export function locationOfMarkerId(markerId) {
  return locationOfMarker.get(markerId) ?? null;
}

/** Is this run's map shuffle confined to each dungeon? */
export function isIntraDungeon(settings = {}) {
  return (settings.mapShuffle ?? 'none') === 'dungeons_internal';
}

/**
 * May these two entrances be paired in this run?
 *
 * Both have to be in the shuffle at all, and in the *same* pool — an overworld
 * icon never pairs with a dungeon door. "Dungeons Internal" narrows it further:
 * floors only shuffle within their own dungeon.
 */
export function canPair(a, b, settings = {}) {
  if (a === b) return true; // a dead end looping back on itself

  const poolA = poolOf(a, settings);
  const poolB = poolOf(b, settings);
  if (!poolA || !poolB) return false;

  // Towns/temples and dungeons share one pool at "everything"; the overworld
  // never mixes with either.
  const sideA = poolA === 'overworld' ? 'overworld' : 'interior';
  const sideB = poolB === 'overworld' ? 'overworld' : 'interior';
  if (sideA !== sideB) return false;

  if ((settings.mapShuffle ?? 'none') === 'dungeons_internal' && sideA === 'interior') {
    const locA = locationOf(a);
    const locB = locationOf(b);
    if (locA == null || locB == null) return false;
    return locA === locB;
  }

  return true;
}

/** Why a pairing is not allowed, for showing in the picker. */
export function pairingProblem(a, b, settings = {}) {
  if (canPair(a, b, settings)) return null;

  const poolA = poolOf(a, settings);
  const poolB = poolOf(b, settings);

  if (!poolB) return 'not shuffled in this run — its destination is fixed';
  if (!poolA) return 'the door you are linking from is not shuffled in this run';

  const overworldMismatch = (poolA === 'overworld') !== (poolB === 'overworld');
  if (overworldMismatch) return 'overworld and interior entrances are shuffled separately';

  return 'Dungeons Internal only shuffles floors within the same dungeon';
}

// --- vanilla pairings -------------------------------------------------------

const vanillaPartners = new Map();
for (const [a, b] of entrancePairs) {
  vanillaPartners.set(a, b);
  vanillaPartners.set(b, a);
}

// entrances_pairs does not list every connection, so fill the gaps by finding
// the link that goes back the other way: A leads to room R, and the entrance in
// R that leads back to A's room is A's other side.
for (const link of entranceLinks) {
  if (vanillaPartners.has(link.entranceId)) continue;

  const reverse = entranceLinks.find((other) => (
    other.entranceId !== link.entranceId
    && other.fromRoomId === link.toRoomId
    && other.toRoomId === link.fromRoomId
    && !vanillaPartners.has(other.entranceId)
  ));

  if (reverse) {
    vanillaPartners.set(link.entranceId, reverse.entranceId);
    vanillaPartners.set(reverse.entranceId, link.entranceId);
  }
}

/**
 * Where an entrance leads when it is *not* shuffled.
 *
 * An unshuffled door has a known destination, so the tracker should say so
 * rather than presenting it as something you still have to discover.
 */
export function vanillaPartnerOf(entranceId) {
  return vanillaPartners.get(entranceId) ?? null;
}

/** Marker id for an entrance, so vanilla partners can be named on our maps. */
export function markerOfEntrance(entranceId) {
  return markerByEntrance.get(entranceId) ?? null;
}

/**
 * Vanilla links for every entrance this run does not shuffle, in the same
 * shape as player-discovered links so the engine treats them identically.
 */
export function vanillaLinksFor(settings = {}) {
  const links = {};

  for (const link of entranceLinks) {
    if (poolOf(link.entranceId, settings)) continue; // shuffled: the player decides

    const partner = vanillaPartnerOf(link.entranceId);
    if (partner != null) links[link.entranceId] = partner;
  }

  return links;
}

/**
 * Is this marker's binding solid enough to name a place to the player?
 *
 * A floor matched to the game's own map by geometry alone is close to a coin
 * flip — no name agreed, only the shape of the marker cloud lined up. That is
 * how our Bone Dungeon B2 sheet ended up bound to the game's Fall Basin area,
 * and why the Falls Basin icon claimed it led into Bone Dungeon. Saying nothing
 * is better than saying that, so those floors are left out.
 */
function isTrustedMarker(markerId) {
  const floorBinding = binding.floors[floorOfMarker.get(markerId)];
  return floorBinding?.confidence !== 'geometry-only';
}

/**
 * Fixed destinations in marker ids, ready for the map to show and to walk
 * through: marker -> the marker you come out at.
 *
 * Only pairs we can place on both ends are included. A door left out simply
 * behaves as it always did — the player can still link it by hand.
 */
export function fixedMarkerLinksFor(settings = {}) {
  const links = new Map();

  for (const [from, to] of Object.entries(vanillaLinksFor(settings))) {
    const fromMarker = markerOfEntrance(Number(from));
    const toMarker = markerOfEntrance(to);
    if (fromMarker == null || toMarker == null) continue;
    if (!isTrustedMarker(fromMarker) || !isTrustedMarker(toMarker)) continue;

    links.set(fromMarker, toMarker);
  }

  return links;
}
