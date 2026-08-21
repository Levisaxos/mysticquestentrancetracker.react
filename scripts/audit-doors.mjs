#!/usr/bin/env node
//
// Which door markers cannot be connected automatically, and why?
//
// In a run that shuffles nothing, every door has a known destination, so the
// tracker should be able to fill all of them in. It cannot, and this says where
// the chain breaks for each one — because the four reasons need four different
// fixes, and lumping them together as "not working" hides that.
//
//     node scripts/audit-doors.mjs            print a summary
//     node scripts/audit-doors.mjs --write    also write docs/UNMATCHED-DOORS.md
//
// Run it after build-binding.mjs; it reads the binding, it does not produce it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_DATA } from '../src/constants/mapData.js';
import { LOCATIONS_DATA } from '../src/constants/locationsData.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const binding = read('src/data/binding.json');
const entrances = read('src/data/ffmq/entrances.json');
const entranceLinks = read('src/data/ffmq/entranceLinks.json');
const entrancePairs = read('src/data/ffmq/entrancePairs.json');

const entranceName = new Map(entrances.map((e) => [e.id, e.name]));
const hasLink = new Set(entranceLinks.map((l) => l.entranceId));

// Same vanilla pairing the tracker uses: the explicit table, then the gaps
// filled by finding the link that goes back the other way.
const partner = new Map();
for (const [a, b] of entrancePairs) { partner.set(a, b); partner.set(b, a); }
for (const link of entranceLinks) {
  if (partner.has(link.entranceId)) continue;
  const reverse = entranceLinks.find((other) => (
    other.entranceId !== link.entranceId
    && other.fromRoomId === link.toRoomId
    && other.toRoomId === link.fromRoomId
    && !partner.has(other.entranceId)
  ));
  if (reverse) { partner.set(link.entranceId, reverse.entranceId); partner.set(reverse.entranceId, link.entranceId); }
}

const floorLabel = new Map();
const floorRegion = new Map();
for (const region of MAP_DATA.regions) {
  for (const location of region.locations) {
    for (const floor of location.floors) {
      floorLabel.set(String(floor.id), `${location.name} · ${floor.name}`);
      floorRegion.set(String(floor.id), region.name);
    }
  }
}


const floorOfMarker = new Map();
const nameOfMarker = new Map();
for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
  for (const marker of markers) { floorOfMarker.set(marker.id, floorId); nameOfMarker.set(marker.id, marker.name); }
}

// A vanilla door leaves its region only in ways you can name: onto the world
// map, between Doom Castle and Focus Tower, or through a crest teleporter. So a
// pairing that crosses regions and is not one of those is not merely
// unverified, it is wrong — Pazuzu's Tower does not open into the Lava Dome.
const WORLD_MAP = 'World Map';
const crossesRegions = (a, b) => {
  const from = floorRegion.get(floorOfMarker.get(a));
  const to = floorRegion.get(floorOfMarker.get(b));
  if (!from || !to || from === to) return null;
  if (from === WORLD_MAP || to === WORLD_MAP) return null;
  return `${from} → ${to}`;
};

const markerOfEntrance = new Map();
for (const [markerId, bound] of Object.entries(binding.markers)) {
  if (bound.kind === 'entrance') markerOfEntrance.set(bound.entranceId, Number(markerId));
}

const describe = (markerId) => `${floorLabel.get(floorOfMarker.get(markerId)) ?? '?'} — ${nameOfMarker.get(markerId)}`;
const geometryOnly = (markerId) => binding.floors[floorOfMarker.get(markerId)]?.confidence === 'geometry-only';

const buckets = {
  connected: [],
  noBinding: [],
  noPartnerMarker: [],
  untrustedFloor: [],
};

for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
  for (const marker of markers) {
    if (marker.type !== 'door') continue;
    const where = `${floorLabel.get(floorId) ?? floorId} — ${marker.name}`;
    const bound = binding.markers[String(marker.id)];

    if (bound?.kind !== 'entrance') {
      const floor = binding.floors[floorId];
      buckets.noBinding.push({
        where,
        why: floor
          ? `floor is bound to "${floor.areaLabel}" but this marker matched none of its entrances`
          : 'this floor is not bound to any area in the game data',
      });
      continue;
    }

    const other = hasLink.has(bound.entranceId) ? partner.get(bound.entranceId) : null;
    if (other == null) {
      buckets.noBinding.push({ where, why: `e${bound.entranceId} "${entranceName.get(bound.entranceId)}" has no other side in the game data` });
      continue;
    }

    const otherMarker = markerOfEntrance.get(other);
    if (otherMarker == null) {
      buckets.noPartnerMarker.push({ where, why: `leads to e${other} "${entranceName.get(other)}", which no marker on our maps claims` });
      continue;
    }

    if (geometryOnly(marker.id) || geometryOnly(otherMarker)) {
      const across = crossesRegions(marker.id, otherMarker);
      buckets.untrustedFloor.push({
        where,
        why: across
          ? `would lead to ${describe(otherMarker)} — ${across}, which cannot be right, so one of those sheets is bound to the wrong area`
          : `would lead to ${describe(otherMarker)} — but one of those sheets was matched on geometry alone, so it is not trusted`,
      });
      continue;
    }

    buckets.connected.push({ where, why: `-> ${describe(otherMarker)}` });
  }
}

const total = Object.values(buckets).reduce((n, list) => n + list.length, 0);
const unmatched = total - buckets.connected.length;

console.log('=== doors that cannot be auto-connected ===\n');
console.log(`door markers                : ${total}`);
console.log(`  connected automatically   : ${buckets.connected.length}`);
console.log(`  no canonical binding      : ${buckets.noBinding.length}`);
console.log(`  far side has no marker    : ${buckets.noPartnerMarker.length}`);
console.log(`  binding not trusted       : ${buckets.untrustedFloor.length}`);
console.log(`\n${unmatched} need a decision.`);

if (!process.argv.includes('--write')) process.exit(0);

const section = (title, blurb, rows) => [
  `## ${title} (${rows.length})`,
  '',
  blurb,
  '',
  ...rows.map((r) => `- **${r.where}** — ${r.why}`),
  '',
].join('\n');

const doc = [
  '# Doors with no automatic match',
  '',
  'Generated by `node scripts/audit-doors.mjs --write`. Do not edit by hand.',
  '',
  'In a run that shuffles nothing every door has a fixed destination, so the',
  'tracker should be able to fill in all of them. These are the ones it cannot,',
  'grouped by where the chain breaks — each group needs a different fix.',
  '',
  `| | |`,
  `|---|---|`,
  `| door markers | ${total} |`,
  `| connected automatically | ${buckets.connected.length} |`,
  `| need a decision | ${unmatched} |`,
  '',
  section(
    'No canonical binding',
    'The marker is not tied to an entrance in the game data at all, usually'
    + ' because our map sheet is finer-grained than the game\'s areas and lost'
    + ' the one-to-one race for one. Fixing these means binding the floor or the'
    + ' marker by hand.',
    buckets.noBinding,
  ),
  section(
    'The far side has no marker',
    'The door itself is bound and its destination is known, but nothing on our'
    + ' maps stands at the other end. These are missing markers — the map sheet'
    + ' needs one adding at the right spot.',
    buckets.noPartnerMarker,
  ),
  section(
    'Binding not trusted',
    'Both ends are bound, but one sheet was matched to its game area on geometry'
    + ' alone with no name agreeing, which is roughly a coin flip. The tracker'
    + ' refuses to name a destination from those rather than risk pointing at the'
    + ' wrong dungeon.',
    buckets.untrustedFloor,
  ),
].join('\n');

fs.writeFileSync(path.join(root, 'docs/UNMATCHED-DOORS.md'), `${doc}\n`);
console.log('\nWrote docs/UNMATCHED-DOORS.md');
