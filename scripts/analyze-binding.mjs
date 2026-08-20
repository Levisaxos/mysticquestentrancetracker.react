#!/usr/bin/env node
//
// Phase 1 dry run: how much of the marker -> canonical binding can be derived
// automatically?
//
// Our markers carry pixel coordinates on a cropped map image. Canonical
// entrances carry tile coordinates in the game's own space for an "area".
// Comparing Bone Dungeon 1F showed the relationship is a pure translation at a
// fixed 16px tile size — our images are just crops.
//
// So instead of matching fragile names, fingerprint the geometry: for every
// (floor, area) pair, find the translation that aligns the most markers. A
// floor whose markers align cleanly to an area both identifies the area and
// binds each marker in one step.
//
//     node scripts/analyze-binding.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_DATA } from '../src/constants/mapData.js';
import { LOCATIONS_DATA } from '../src/constants/locationsData.js';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/ffmq');
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

const entrances = read('entrances.json');
const entranceLinks = read('entranceLinks.json');

const TILE = 16;
const TOLERANCE = 1.5; // tiles

const usedEntranceIds = new Set(entranceLinks.map((l) => l.entranceId));
const usedEntrances = entrances.filter((e) => usedEntranceIds.has(e.id));

// Overworld entrances are addressed by teleporter rather than tile position, so
// they carry no coordinates and cannot be aligned geometrically. They are named
// after their destination ("Overworld - Bone Dungeon"), and so are our world-map
// markers, so match those by name instead.
const positioned = usedEntrances.filter((e) => Array.isArray(e.coordinates));
const overworld = usedEntrances.filter((e) => !Array.isArray(e.coordinates));

const normalise = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

function matchOverworldByName(markers) {
  const targets = overworld.map((e) => ({
    entrance: e,
    key: normalise(e.name.replace(/^Overworld - /, '')),
  }));
  const taken = new Set();
  const pairs = [];

  for (const marker of markers) {
    const key = normalise(marker.name);
    const hit = targets.find((t) => !taken.has(t.entrance.id) && (t.key === key ||
      t.key.startsWith(key) || key.startsWith(t.key)));
    if (hit) {
      taken.add(hit.entrance.id);
      pairs.push({ markerId: marker.id, entranceId: hit.entrance.id, via: 'name' });
    }
  }
  return pairs;
}

// --- group canonical entrances by area, and give each area a readable label ---

const areas = new Map();
for (const entrance of positioned) {
  if (!areas.has(entrance.area)) areas.set(entrance.area, []);
  areas.get(entrance.area).push(entrance);
}

function areaLabel(list) {
  if (!list || !list.length) return 'Overworld';
  const prefixes = [...new Set(list.map((e) => e.name.split(' - ')[0]))];
  if (prefixes.length === 1) return prefixes[0];

  // Several rooms share an area; use their longest common word prefix.
  const wordLists = prefixes.map((p) => p.split(' '));
  const common = [];
  for (let i = 0; i < Math.min(...wordLists.map((w) => w.length)); i++) {
    const word = wordLists[0][i];
    if (wordLists.every((w) => w[i] === word)) common.push(word);
    else break;
  }
  return common.length ? common.join(' ') : prefixes[0];
}

// --- our floors ---

const floors = [];
for (const region of MAP_DATA.regions) {
  for (const location of region.locations) {
    for (const floor of location.floors) {
      const markers = LOCATIONS_DATA[String(floor.id)] ?? [];
      floors.push({
        id: floor.id,
        locationName: location.name,
        label: `${region.name} / ${location.name} / ${floor.name}`,
        doors: markers.filter((m) => m.type === 'door' || m.type === 'battleground'),
        markers,
      });
    }
  }
}

// --- alignment by translation voting ---

function align(ourDoors, areaEntrances) {
  if (!ourDoors.length || !areaEntrances.length) return { matched: 0, offset: null, pairs: [] };

  // Every (marker, entrance) candidate implies one translation. The translation
  // shared by the most candidates is the real crop origin.
  const votes = new Map();
  for (const marker of ourDoors) {
    for (const entrance of areaEntrances) {
      const dx = Math.round(entrance.coordinates[0] - marker.x / TILE);
      const dy = Math.round(entrance.coordinates[1] - marker.y / TILE);
      const key = `${dx},${dy}`;
      votes.set(key, (votes.get(key) ?? 0) + 1);
    }
  }

  let best = { key: null, count: 0 };
  for (const [key, count] of votes) {
    if (count > best.count) best = { key, count };
  }
  if (!best.key) return { matched: 0, offset: null, pairs: [] };

  const [dx, dy] = best.key.split(',').map(Number);

  // Greedy nearest-neighbour assignment under that translation.
  const remaining = new Set(areaEntrances.map((e) => e.id));
  const pairs = [];
  for (const marker of ourDoors) {
    let closest = null;
    let closestDistance = Infinity;
    for (const entrance of areaEntrances) {
      if (!remaining.has(entrance.id)) continue;
      const distance = Math.hypot(
        entrance.coordinates[0] - (marker.x / TILE + dx),
        entrance.coordinates[1] - (marker.y / TILE + dy)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = entrance;
      }
    }
    if (closest && closestDistance <= TOLERANCE) {
      remaining.delete(closest.id);
      pairs.push({ markerId: marker.id, entranceId: closest.id, distance: closestDistance });
    }
  }

  return { matched: pairs.length, offset: [dx, dy], pairs };
}

// --- score every floor against every area ---

// A floor with one or two markers aligns trivially to almost any area — a
// single point always yields a perfect translation. So score every pairing,
// then assign globally one-to-one, best evidence first, and only trust a
// pairing that rests on enough matched markers to be meaningful.

const MIN_CONFIDENT_MATCHES = 3;

// Geometry alone cannot separate two-marker rooms, so constrain candidates by
// name first: an area label almost always begins with the place name our floor
// sits under ("Bone Dungeon 1F" under our "Bone Dungeon" location).
const SYNONYMS = [
  [/first/g, '1'], [/second/g, '2'], [/third/g, '3'],
  [/fourth/g, '4'], [/fifth/g, '5'], [/sixth/g, '6'],
  [/seventh/g, '7'], [/basement/g, 'b'], [/floor/g, 'f'],
];

function nameKey(text) {
  let out = text.toLowerCase();
  for (const [pattern, replacement] of SYNONYMS) out = out.replace(pattern, replacement);
  return out.replace(/[^a-z0-9]/g, '');
}

function placeMatches(floor, areaEntrances) {
  const label = nameKey(areaLabel(areaEntrances));
  const place = nameKey(floor.locationName);
  return label.includes(place) || place.includes(label.slice(0, Math.max(4, place.length)));
}

const candidates = [];
for (const floor of floors) {
  if (floor.id === 10101) continue; // overworld handled by name
  for (const [areaId, areaEntrances] of areas) {
    const sameplace = placeMatches(floor, areaEntrances);
    const attempt = align(floor.doors, areaEntrances);
    if (attempt.matched > 0) {
      candidates.push({
        floor,
        areaId,
        sameplace,
        matched: attempt.matched,
        offset: attempt.offset,
        pairs: attempt.pairs,
        coverage: attempt.matched / floor.doors.length,
        exact: attempt.matched === floor.doors.length && attempt.matched === areaEntrances.length,
      });
    }
  }
}

// Name agreement outranks raw marker count: a two-marker room in the right
// place beats a four-marker coincidence in the wrong one.
candidates.sort((a, b) =>
  (b.sameplace ? 1 : 0) - (a.sameplace ? 1 : 0) ||
  b.matched - a.matched ||
  (b.exact ? 1 : 0) - (a.exact ? 1 : 0) ||
  b.coverage - a.coverage);

const claimedFloors = new Set();
const claimedAreas = new Set();
const assigned = [];
for (const candidate of candidates) {
  if (claimedFloors.has(candidate.floor.id) || claimedAreas.has(candidate.areaId)) continue;
  claimedFloors.add(candidate.floor.id);
  claimedAreas.add(candidate.areaId);
  assigned.push(candidate);
}

const worldMap = floors.find((f) => f.id === 10101);
const overworldPairs = matchOverworldByName(worldMap.doors);

// Trust a pairing when the name agrees, or when enough markers align that
// coincidence is implausible.
const confident = assigned.filter((a) => a.sameplace || a.matched >= MIN_CONFIDENT_MATCHES);
const weak = assigned.filter((a) => !a.sameplace && a.matched < MIN_CONFIDENT_MATCHES);
const unassigned = floors.filter((f) => f.id !== 10101 && !claimedFloors.has(f.id));

const totalDoors = floors.reduce((sum, f) => sum + f.doors.length, 0);
const confidentMarkers = confident.reduce((sum, a) => sum + a.matched, 0) + overworldPairs.length;
const weakMarkers = weak.reduce((sum, a) => sum + a.matched, 0);
const pct = (n) => ((n / totalDoors) * 100).toFixed(1);

console.log('=== Phase 1 binding dry run ===');
console.log();
console.log(`Our door/battleground markers : ${totalDoors}`);
console.log(`Canonical entrances (used)    : ${usedEntrances.length} — ${positioned.length} positioned, ${overworld.length} overworld`);
console.log(`Canonical areas               : ${areas.size}`);
console.log(`Our floors (excl. world map)  : ${floors.length - 1}`);
console.log();
console.log('--- floor to area assignment (one-to-one, best evidence first) ---');
console.log(`  confident (>=${MIN_CONFIDENT_MATCHES} markers aligned) : ${confident.length} floors`);
console.log(`  weak (1-2 markers, unverifiable)  : ${weak.length} floors`);
console.log(`  no alignment at all               : ${unassigned.length} floors`);
console.log(`  areas left unclaimed              : ${areas.size - claimedAreas.size}`);
console.log();
console.log('--- marker binding ---');
console.log(`  world map, matched by name  : ${overworldPairs.length} / ${worldMap.doors.length}`);
console.log(`  bound with confidence       : ${confidentMarkers} / ${totalDoors} (${pct(confidentMarkers)}%)`);
console.log(`  bound but needs review      : ${weakMarkers}`);
console.log(`  needs manual binding        : ${totalDoors - confidentMarkers - weakMarkers}`);
console.log();

if (weak.length) {
  console.log('--- weak assignments (1-2 markers: verify by hand) ---');
  for (const a of weak.slice(0, 12)) {
    console.log(`  ${a.matched}/${a.floor.doors.length}  ${a.floor.label} -> area ${a.areaId} "${areaLabel(areas.get(a.areaId))}"`);
  }
  if (weak.length > 12) console.log(`  … and ${weak.length - 12} more`);
  console.log();
}

if (unassigned.length) {
  console.log('--- floors with no area assignment ---');
  for (const f of unassigned.slice(0, 12)) {
    console.log(`  ${f.doors.length} markers  ${f.label}`);
  }
  if (unassigned.length > 12) console.log(`  … and ${unassigned.length - 12} more`);
  console.log();
}

const unclaimedAreas = [...areas.keys()].filter((a) => !claimedAreas.has(a));
if (unclaimedAreas.length) {
  console.log('--- canonical areas with no floor ---');
  for (const areaId of unclaimedAreas.slice(0, 12)) {
    console.log(`  area ${String(areaId).padStart(3)} "${areaLabel(areas.get(areaId))}" (${areas.get(areaId).length} entrances)`);
  }
  if (unclaimedAreas.length > 12) console.log(`  … and ${unclaimedAreas.length - 12} more`);
}
