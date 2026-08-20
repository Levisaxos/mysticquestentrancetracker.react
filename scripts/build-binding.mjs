#!/usr/bin/env node
//
// Builds src/data/binding.json: the foreign key from each of our markers to the
// canonical FFMQ entity it represents.
//
// Three different kinds of evidence, because the upstream data offers different
// things for different marker types:
//
//   entrances     tile coordinates -> align geometrically (see analyze-binding)
//   world map     named after their destination -> match by name
//   chests/boxes  no coordinates upstream -> narrow to the candidate checks in
//                 the floor's rooms and leave the final pick to a human
//
// Everything carries a confidence level. Nothing guesses silently.
//
//     npm run build-binding

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_DATA } from '../src/constants/mapData.js';
import { LOCATIONS_DATA } from '../src/constants/locationsData.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../src/data/ffmq');
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

const entrances = read('entrances.json');
const entranceLinks = read('entranceLinks.json');
const checks = read('checks.json');
const rooms = read('rooms.json');

const TILE = 16;
const TOLERANCE = 1.5;
const MIN_CONFIDENT_MATCHES = 3;

const usedIds = new Set(entranceLinks.map((l) => l.entranceId));
const used = entrances.filter((e) => usedIds.has(e.id));
const positioned = used.filter((e) => Array.isArray(e.coordinates));
const overworldEntrances = used.filter((e) => !Array.isArray(e.coordinates));

// --- area groupings -----------------------------------------------------------

const areas = new Map();
for (const entrance of positioned) {
  if (!areas.has(entrance.area)) areas.set(entrance.area, []);
  areas.get(entrance.area).push(entrance);
}

// An entrance belongs to an area; the link that uses it names the room it sits
// in. Composing those gives area -> rooms, which is how we narrow chest/box
// candidates without any coordinates.
const roomByEntrance = new Map(entranceLinks.map((l) => [l.entranceId, l.fromRoomId]));
const roomsByArea = new Map();
for (const entrance of positioned) {
  const roomId = roomByEntrance.get(entrance.id);
  if (roomId === undefined) continue;
  if (!roomsByArea.has(entrance.area)) roomsByArea.set(entrance.area, new Set());
  roomsByArea.get(entrance.area).add(roomId);
}

const checksByRoom = new Map();
for (const check of checks) {
  if (!checksByRoom.has(check.roomId)) checksByRoom.set(check.roomId, []);
  checksByRoom.get(check.roomId).push(check);
}

function areaLabel(list) {
  if (!list?.length) return 'Overworld';
  const prefixes = [...new Set(list.map((e) => e.name.split(' - ')[0]))];
  if (prefixes.length === 1) return prefixes[0];
  const words = prefixes.map((p) => p.split(' '));
  const common = [];
  for (let i = 0; i < Math.min(...words.map((w) => w.length)); i++) {
    if (words.every((w) => w[i] === words[0][i])) common.push(words[0][i]);
    else break;
  }
  return common.length ? common.join(' ') : prefixes[0];
}

// --- our floors ---------------------------------------------------------------

const floors = [];
for (const region of MAP_DATA.regions) {
  for (const location of region.locations) {
    for (const floor of location.floors) {
      const markers = LOCATIONS_DATA[String(floor.id)] ?? [];
      floors.push({
        id: floor.id,
        locationName: location.name,
        label: `${region.name} / ${location.name} / ${floor.name}`,
        doors: markers.filter((m) => m.type === 'door'),
        battlegrounds: markers.filter((m) => m.type === 'battleground'),
        containers: markers.filter((m) => m.type === 'chest' || m.type === 'box'),
        markers,
      });
    }
  }
}

// --- geometric alignment ------------------------------------------------------

function align(markers, areaEntrances) {
  if (!markers.length || !areaEntrances.length) return { matched: 0, offset: null, pairs: [] };

  const votes = new Map();
  for (const marker of markers) {
    for (const entrance of areaEntrances) {
      const key = `${Math.round(entrance.coordinates[0] - marker.x / TILE)},` +
                  `${Math.round(entrance.coordinates[1] - marker.y / TILE)}`;
      votes.set(key, (votes.get(key) ?? 0) + 1);
    }
  }

  let best = { key: null, count: 0 };
  for (const [key, count] of votes) if (count > best.count) best = { key, count };
  if (!best.key) return { matched: 0, offset: null, pairs: [] };

  const [dx, dy] = best.key.split(',').map(Number);
  const remaining = new Set(areaEntrances.map((e) => e.id));
  const pairs = [];
  const matched = new Set();

  for (const marker of markers) {
    let closest = null;
    let closestDistance = Infinity;
    for (const entrance of areaEntrances) {
      if (!remaining.has(entrance.id)) continue;
      const distance = Math.hypot(
        entrance.coordinates[0] - (marker.x / TILE + dx),
        entrance.coordinates[1] - (marker.y / TILE + dy)
      );
      if (distance < closestDistance) { closestDistance = distance; closest = entrance; }
    }
    if (closest && closestDistance <= TOLERANCE) {
      remaining.delete(closest.id);
      pairs.push({ markerId: marker.id, entranceId: closest.id, distance: Number(closestDistance.toFixed(2)) });
      matched.add(marker.id);
    }
  }

  // Leftovers. Once a floor is confidently aligned to an area, a marker that
  // missed the tolerance is still almost certainly one of that area's remaining
  // entrances — our marker was just placed a few tiles off the exact tile.
  // Pair what is left nearest-first, and flag it as the weaker evidence it is.
  //
  // This is what was leaving the door you walk in through unbound: four of
  // Foresta's five aligned cleanly and the fifth sat just outside tolerance.
  const leftoverMarkers = markers.filter((m) => !matched.has(m.id));
  const leftoverEntrances = areaEntrances.filter((e) => remaining.has(e.id));

  const proposals = [];
  for (const marker of leftoverMarkers) {
    for (const entrance of leftoverEntrances) {
      proposals.push({
        marker,
        entrance,
        distance: Math.hypot(
          entrance.coordinates[0] - (marker.x / TILE + dx),
          entrance.coordinates[1] - (marker.y / TILE + dy)
        ),
      });
    }
  }
  proposals.sort((a, b) => a.distance - b.distance);

  const usedMarkers = new Set();
  for (const proposal of proposals) {
    if (usedMarkers.has(proposal.marker.id) || !remaining.has(proposal.entrance.id)) continue;
    usedMarkers.add(proposal.marker.id);
    remaining.delete(proposal.entrance.id);
    pairs.push({
      markerId: proposal.marker.id,
      entranceId: proposal.entrance.id,
      distance: Number(proposal.distance.toFixed(2)),
      leftover: true,
    });
  }

  // Only the tolerance matches count as evidence that this floor *is* this
  // area — leftovers must not be able to talk a floor into the wrong area.
  return { matched: matched.size, offset: [dx, dy], pairs };
}

const SYNONYMS = [
  [/\bfirst\b/g, '1'], [/\bsecond\b/g, '2'], [/\bthird\b/g, '3'], [/\bfourth\b/g, '4'],
  [/\bfifth\b/g, '5'], [/\bsixth\b/g, '6'], [/\bseventh\b/g, '7'],
  [/\bbasement\b/g, 'b'], [/\bfloor\b/g, 'f'],
];
const nameKey = (text) => {
  let out = text.toLowerCase();
  for (const [pattern, replacement] of SYNONYMS) out = out.replace(pattern, replacement);
  return out.replace(/[^a-z0-9]/g, '');
};

function placeMatches(floor, areaEntrances) {
  const label = nameKey(areaLabel(areaEntrances));
  const place = nameKey(floor.locationName);
  return label.includes(place) || place.includes(label.slice(0, Math.max(4, place.length)));
}

// --- assign floors to areas, one-to-one, best evidence first ------------------

const candidates = [];
for (const floor of floors) {
  if (floor.id === 10101) continue;
  for (const [areaId, areaEntrances] of areas) {
    const attempt = align(floor.doors, areaEntrances);
    if (!attempt.matched) continue;
    candidates.push({
      floor, areaId, ...attempt,
      sameplace: placeMatches(floor, areaEntrances),
      coverage: attempt.matched / floor.doors.length,
    });
  }
}

candidates.sort((a, b) =>
  (b.sameplace ? 1 : 0) - (a.sameplace ? 1 : 0) ||
  b.matched - a.matched ||
  b.coverage - a.coverage);

const floorBinding = {};
const takenFloors = new Set();
const takenAreas = new Set();

// Strict one-to-one. Relaxing it to allow map variants (Frozen/Unfrozen Aquaria
// and friends) to share an area was tried and made things worse: with only the
// location name to go on, every Bone Dungeon floor happily claimed "Bone Dungeon
// 1F". Variants therefore fall through to the review tool rather than being
// guessed at — a smaller correct result beats a larger wrong one.
for (const candidate of candidates) {
  if (takenFloors.has(candidate.floor.id) || takenAreas.has(candidate.areaId)) continue;

  takenFloors.add(candidate.floor.id);
  takenAreas.add(candidate.areaId);

  floorBinding[candidate.floor.id] = {
    areaId: candidate.areaId,
    areaLabel: areaLabel(areas.get(candidate.areaId)),
    offset: candidate.offset,
    // Three tiers, because the two kinds of evidence are independent:
    //   high          the name agrees AND enough markers align
    //   name-only     the place matches but only 1-2 markers to confirm it
    //   geometry-only 3+ markers align but the name does not corroborate
    confidence: candidate.sameplace && candidate.matched >= MIN_CONFIDENT_MATCHES ? 'high'
      : candidate.sameplace ? 'name-only' : 'geometry-only',
    matchedMarkers: candidate.matched,
    totalMarkers: candidate.floor.doors.length,
    roomIds: [...(roomsByArea.get(candidate.areaId) ?? [])],
  };
}

// --- marker bindings ----------------------------------------------------------

const markerBinding = {};
const stats = { entranceHigh: 0, entranceReview: 0, battlefield: 0, container: 0, unresolved: 0 };

for (const candidate of candidates) {
  const binding = floorBinding[candidate.floor.id];
  if (!binding || binding.areaId !== candidate.areaId) continue;

  for (const pair of candidate.pairs) {
    markerBinding[pair.markerId] = {
      kind: 'entrance',
      entranceId: pair.entranceId,
      confidence: pair.leftover ? 'leftover' : binding.confidence,
      via: pair.leftover ? 'leftover-in-bound-area' : 'geometry',
      distance: pair.distance,
    };
    if (binding.confidence === 'high') stats.entranceHigh++; else stats.entranceReview++;
  }
}

// World map doors are named after where they lead, and so are the overworld
// entrances, so match those directly.
//
// Six of ours are named differently enough that no amount of string-distance
// would match them safely, so they are listed explicitly. "Front Entrance" ->
// "Foresta" is a judgement about the map, not a spelling difference, and
// guessing at that is exactly how a tracker ends up confidently wrong.
const WORLD_MAP_ALIASES = {
  'Forest': 'Level Forest',
  'Focus Tower Front Entrance': 'Focus Tower Foresta',
  'Focus Tower Water Exit': 'Focus Tower Aquaria',
  'Focus Tower Fire Exit': 'Focus Tower Fireburg',
  'Pazuzus Tower': 'Pazuzu Tower',
  'Macs Ship': 'Mac Ship',
};
const worldMap = floors.find((f) => f.id === 10101);
const overworldTargets = overworldEntrances.map((e) => ({
  entrance: e,
  key: nameKey(e.name.replace(/^Overworld - /, '')),
}));
const takenOverworld = new Set();

for (const marker of worldMap.doors) {
  const key = nameKey(WORLD_MAP_ALIASES[marker.name] ?? marker.name);
  const hit = overworldTargets.find((t) =>
    !takenOverworld.has(t.entrance.id) &&
    (t.key === key || t.key.startsWith(key) || key.startsWith(t.key)));

  if (hit) {
    takenOverworld.add(hit.entrance.id);
    markerBinding[marker.id] = {
      kind: 'entrance', entranceId: hit.entrance.id, confidence: 'high', via: 'name',
    };
    stats.entranceHigh++;
  }
}

// Battlegrounds are checks, not entrances — battlefields you clear for a
// reward. Upstream gives them no coordinates, so they cannot be placed
// geometrically. But every battlefield belongs to a Subregion room, and the
// overworld entrances belong to those same rooms — so a battleground's nearest
// already-bound world-map door tells us which subregion it sits in.
//
// That is enough for colouring, because battlefields in one subregion share a
// room and therefore share reachability. It is not enough to say *which*
// battlefield a marker is, so the exact identity stays unresolved and the
// candidate list is narrowed to that subregion.
const battlefields = checks.filter((c) => c.type === 'Battlefield');
const battlefieldsBySubregion = new Map();
for (const bf of battlefields) {
  if (!battlefieldsBySubregion.has(bf.roomId)) battlefieldsBySubregion.set(bf.roomId, []);
  battlefieldsBySubregion.get(bf.roomId).push(bf);
}

// Where each subregion sits on the world map: the average position of the door
// markers we have already bound to its entrances.
const subregionCentroids = new Map();
for (const marker of worldMap.doors) {
  const bound = markerBinding[marker.id];
  if (bound?.kind !== 'entrance') continue;

  const roomId = roomByEntrance.get(bound.entranceId);
  if (roomId === undefined || !battlefieldsBySubregion.has(roomId)) continue;

  if (!subregionCentroids.has(roomId)) subregionCentroids.set(roomId, { x: 0, y: 0, n: 0 });
  const c = subregionCentroids.get(roomId);
  c.x += marker.x; c.y += marker.y; c.n += 1;
}
for (const c of subregionCentroids.values()) { c.x /= c.n; c.y /= c.n; }

// Assign nearest-first, respecting each subregion's quota. Subregions with no
// overworld doors of their own (Volcano Battlefield) have no centroid, so they
// take whatever is left once the others are full.
const quota = new Map([...battlefieldsBySubregion].map(([roomId, list]) => [roomId, list.length]));
const proposals = [];
for (const marker of worldMap.battlegrounds) {
  for (const [roomId, centre] of subregionCentroids) {
    proposals.push({
      markerId: marker.id,
      roomId,
      distance: Math.hypot(marker.x - centre.x, marker.y - centre.y),
    });
  }
}
proposals.sort((a, b) => a.distance - b.distance);

const battlegroundRoom = new Map();
for (const proposal of proposals) {
  if (battlegroundRoom.has(proposal.markerId)) continue;
  if ((quota.get(proposal.roomId) ?? 0) <= 0) continue;
  battlegroundRoom.set(proposal.markerId, proposal.roomId);
  quota.set(proposal.roomId, quota.get(proposal.roomId) - 1);
}

// Anything still unassigned goes to a subregion that still has room.
const leftoverRooms = [...quota].filter(([, n]) => n > 0).flatMap(([roomId, n]) => Array(n).fill(roomId));
for (const marker of worldMap.battlegrounds) {
  if (battlegroundRoom.has(marker.id)) continue;
  const roomId = leftoverRooms.shift();
  if (roomId !== undefined) battlegroundRoom.set(marker.id, roomId);
}

for (const floor of floors) {
  for (const marker of floor.battlegrounds) {
    const roomId = battlegroundRoom.get(marker.id);
    const candidates = roomId !== undefined ? (battlefieldsBySubregion.get(roomId) ?? []) : battlefields;

    markerBinding[marker.id] = {
      kind: 'check',
      checkType: 'Battlefield',
      // The room is what reachability needs, and we are confident about it.
      roomId: roomId ?? null,
      // Which battlefield within that room is still open.
      confidence: roomId !== undefined ? 'room-only' : 'unresolved',
      via: roomId !== undefined ? 'nearest-subregion' : 'type-only',
      candidates: candidates.map((c) => c.apLocationId),
    };
    stats.battlefield++;
  }
}

// Chests and boxes: narrow to the checks in the rooms this floor covers.
for (const floor of floors) {
  const binding = floorBinding[floor.id];
  const roomIds = binding?.roomIds ?? [];
  const pool = roomIds.flatMap((id) => checksByRoom.get(id) ?? []);

  for (const marker of floor.containers) {
    const wanted = marker.type === 'chest' ? 'Chest' : 'Box';
    const candidateChecks = pool.filter((c) => c.type === wanted);

    if (candidateChecks.length === 1) {
      markerBinding[marker.id] = {
        kind: 'check',
        checkType: wanted,
        apLocationId: candidateChecks[0].apLocationId,
        confidence: 'high',
        via: 'sole-candidate-in-area',
      };
      stats.container++;
    } else {
      markerBinding[marker.id] = {
        kind: 'check',
        checkType: wanted,
        confidence: 'unresolved',
        via: candidateChecks.length ? 'narrowed-to-area' : 'no-area-binding',
        candidates: candidateChecks.map((c) => c.apLocationId),
      };
      stats.unresolved++;
    }
  }
}

// --- write --------------------------------------------------------------------

const allMarkers = floors.flatMap((f) => f.markers);
const output = {
  meta: {
    generatedBy: 'scripts/build-binding.mjs',
    note: 'Do not edit by hand; re-run the script. Marker ids are our own, from locationsData.js.',
    totals: {
      markers: allMarkers.length,
      bound: Object.keys(markerBinding).length,
      ...stats,
    },
  },
  floors: floorBinding,
  markers: markerBinding,
};

fs.writeFileSync(
  path.resolve(here, '../src/data/binding.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8'
);

const high = Object.values(markerBinding).filter((b) => b.confidence === 'high').length;
const review = Object.values(markerBinding).filter((b) =>
  b.confidence === 'name-only' || b.confidence === 'geometry-only').length;
const unresolved = Object.values(markerBinding).filter((b) => b.confidence === 'unresolved').length;

console.log('=== binding built ===');
console.log();
console.log(`Markers total        : ${allMarkers.length}`);
console.log(`  bound (high)       : ${high}`);
console.log(`  needs review       : ${review}`);
console.log(`  unresolved         : ${unresolved}`);
console.log(`  no binding at all  : ${allMarkers.length - Object.keys(markerBinding).length}`);
console.log();
console.log(`Floors bound to an area: ${Object.keys(floorBinding).length} / ${floors.length - 1}`);
for (const tier of ['high', 'name-only', 'geometry-only']) {
  const n = Object.values(floorBinding).filter((f) => f.confidence === tier).length;
  console.log(`  ${tier.padEnd(20)} : ${n}`);
}
console.log();
console.log('Wrote src/data/binding.json');
