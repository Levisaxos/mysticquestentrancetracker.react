#!/usr/bin/env node
//
// Rename our map markers to the canonical FFMQ names.
//
// Our names grew organically ("Forest", "Focus Tower Water Exit", "Exit") and
// drifted from the names upstream uses ("Overworld - Level Forest", "Overworld
// - Focus Tower Aquaria", "Bone Dungeon 1F - To Bone Dungeon B1"). That drift
// is what forced an alias table into the binding, and it makes tooltips vaguer
// than they need to be — "Exit" tells you nothing.
//
// Only markers with a confidently resolved binding are renamed. Anything the
// binding could not pin down keeps the name it has, because renaming on a guess
// would be worse than a vague name.
//
//     npm run rename-markers            # show what would change
//     npm run rename-markers -- --write

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCATIONS_DATA } from '../src/constants/locationsData.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'src/data', name), 'utf8'));

const binding = read('binding.json');
const entrances = read('ffmq/entrances.json');
const checks = read('ffmq/checks.json');

const entranceById = new Map(entrances.map((e) => [e.id, e]));
const checkByApId = new Map(checks.map((c) => [c.apLocationId, c]));

const write = process.argv.includes('--write');

function canonicalNameFor(markerId) {
  const bound = binding.markers[String(markerId)];
  if (!bound) return null;

  if (bound.kind === 'entrance') {
    return entranceById.get(bound.entranceId)?.name ?? null;
  }

  // Battlegrounds resolve to a subregion, not to one battlefield, so there is
  // no single canonical name to adopt.
  if (bound.apLocationId == null) return null;
  return checkByApId.get(bound.apLocationId)?.name ?? null;
}

/**
 * Canonical names lead with the area ("Bone Dungeon 1F - Bone Dungeon
 * Entrance"), which is redundant on a marker: the floor is already named right
 * above the map. Drop that first segment — unless doing so would make two
 * markers on the same floor identical, in which case keep the full name.
 */
function shorten(canonical, takenOnFloor) {
  const parts = canonical.split(' - ');
  if (parts.length < 2) return canonical;

  const short = parts.slice(1).join(' - ');
  return takenOnFloor.has(short) ? canonical : short;
}

const next = {};
const changes = [];
let unchanged = 0;
let skipped = 0;

for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
  // Reserve the shortened forms first so collisions are detectable.
  const shortForms = new Map();
  for (const marker of markers) {
    const canonical = canonicalNameFor(marker.id);
    if (!canonical) continue;
    const short = canonical.split(' - ').slice(1).join(' - ') || canonical;
    shortForms.set(short, (shortForms.get(short) ?? 0) + 1);
  }
  const collides = new Set([...shortForms].filter(([, n]) => n > 1).map(([name]) => name));

  next[floorId] = markers.map((marker) => {
    const canonical = canonicalNameFor(marker.id);

    if (!canonical) {
      skipped += 1;
      return marker;
    }

    const name = shorten(canonical, collides);

    if (name === marker.name) {
      unchanged += 1;
      return marker;
    }

    changes.push({ floorId, id: marker.id, from: marker.name, to: name });
    return { ...marker, name };
  });
}

console.log(`Renaming to canonical names`);
console.log(`  would change   : ${changes.length}`);
console.log(`  already match  : ${unchanged}`);
console.log(`  left alone     : ${skipped} (binding could not resolve them)\n`);

console.log('Sample of the change:');
for (const change of changes.slice(0, 12)) {
  console.log(`  ${String(change.id).padStart(3)}  "${change.from}"`);
  console.log(`       -> "${change.to}"`);
}
if (changes.length > 12) console.log(`  … and ${changes.length - 12} more`);

if (!write) {
  console.log('\nDry run. Re-run with --write to apply.');
  process.exit(0);
}

const header = `// Marker positions for each floor.
//
// Names are the canonical FFMQ ones wherever the binding resolved the marker
// (see scripts/rename-markers-canonical.mjs). Markers still unresolved keep
// their original names. Regenerate rather than hand-editing names.

`;

const body = `export const LOCATIONS_DATA = ${JSON.stringify(next, null, 2)};\n`;
fs.writeFileSync(path.join(root, 'src/constants/locationsData.js'), header + body, 'utf8');

console.log(`\nWritten. ${changes.length} markers renamed; \`git diff\` to review.`);
