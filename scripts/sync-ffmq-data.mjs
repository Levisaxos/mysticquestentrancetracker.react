#!/usr/bin/env node
//
// Pulls the canonical FFMQ game data from the Archipelago FFMQ world and writes
// it to src/data/ffmq/*.json.
//
// This runs at BUILD TIME ONLY. The shipped site never calls anything — it just
// imports the generated JSON. Re-run it to pick up upstream fixes:
//
//     npm run sync-data
//
// Version 1.7 of the world dropped the external FFMQR API and now ships rooms,
// entrances, vanilla pairings and shuffle constraints in one module, which is
// why we can be entirely self-contained.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractAssignment } from './lib/pythonLiteral.js';

const REPO = process.env.FFMQ_REPO ?? 'Alchav/Archipelago';
const REF = process.env.FFMQ_REF ?? 'ffmq-1.7.b5';
const BASE = `https://raw.githubusercontent.com/${REPO}/${REF}/worlds/ffmq`;

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/data/ffmq'
);

// AP location ids are derived from object type + object_id. Chests and boxes
// share one id space; NPCs and battlefields are offset above it.
const AP_BASE = 0x420000;
const AP_OFFSETS = { Chest: 0, Box: 0, NPC: 300, Battlefield: 350 };

// Not Archipelago locations, so not checks we can track.
const NON_LOCATION_TYPES = new Set(['Trigger', 'HeroChest']);

// Access rules name items in CamelCase ("DragonClaw"); the item table uses
// spaced names ("Dragon Claw"). This mirrors yaml_item() in the AP world's
// Items.py, including its two special cases.
function yamlItem(text) {
  if (text === 'CaptainCap') return "Captain's Cap";
  if (text === 'WakeWater') return 'Wakewater';

  return [...text]
    .map((c, i) => {
      const upperOrDigit = /[A-Z0-9]/.test(c);
      const partOfFloorName = /[0-9]/.test(text[i - 1] ?? '') && c === 'F';
      return upperOrDigit && !partOfFloorName ? ` ${c}` : c;
    })
    .join('')
    .trim();
}

// A bare weapon class in an access rule means "any weapon of that class".
const WEAPON_CLASSES = { Claw: 'Claws', Bomb: 'Bombs', Sword: 'Swords', Axe: 'Axes' };

// "Barred" names an item that is deliberately commented out of the AP item
// table, so nothing can ever grant it and has_all(["Barred"]) is always false.
// It marks a permanently impassable link rather than a missing requirement.
const NEVER_TOKEN = 'Barred';

function toRequirements(access) {
  return (access ?? []).map((token) => {
    if (token === NEVER_TOKEN) return { type: 'never', raw: token };
    if (token in WEAPON_CLASSES) {
      return { type: 'anyOfGroup', group: WEAPON_CLASSES[token], raw: token };
    }
    return { type: 'item', item: yamlItem(token), raw: token };
  });
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} → ${response.status} ${response.statusText}`);
  return response.text();
}

function normaliseType(type) {
  return type.startsWith('Battlefield') ? 'Battlefield' : type;
}

function apLocationId(type, objectId) {
  const offset = AP_OFFSETS[normaliseType(type)];
  return offset === undefined ? null : AP_BASE + offset + objectId;
}

function buildChecks(rooms) {
  const checks = [];

  for (const room of rooms) {
    for (const object of room.game_objects ?? []) {
      if (NON_LOCATION_TYPES.has(object.type)) continue;

      const type = normaliseType(object.type);
      const id = apLocationId(type, object.object_id);
      if (id === null) throw new Error(`unmapped object type '${object.type}' in room ${room.id}`);

      checks.push({
        apLocationId: id,
        roomId: room.id,
        objectId: object.object_id,
        type,
        rawType: object.type,
        name: object.name,
        access: object.access ?? [],
        requirements: toRequirements(object.access),
      });
    }
  }

  return checks;
}

function buildEntranceLinks(rooms) {
  const links = [];

  for (const room of rooms) {
    for (const link of room.links ?? []) {
      if (link.entrance === undefined || link.entrance === null || link.entrance < 0) continue;
      links.push({
        entranceId: link.entrance,
        fromRoomId: room.id,
        toRoomId: link.target_room,
        teleporter: link.teleporter ?? null,
        access: link.access ?? [],
        requirements: toRequirements(link.access),
      });
    }
  }

  return links;
}

// Links with no entrance id are internal plumbing (subregion connections).
// They are never shuffled, but they do carry access rules — and those rules use
// the same CamelCase tokens, so they need the same normalisation. Doing it here
// keeps every requirement in the codebase in one shape.
function buildInternalLinks(rooms) {
  const links = [];

  for (const room of rooms) {
    for (const link of room.links ?? []) {
      if (link.entrance !== undefined && link.entrance !== null && link.entrance >= 0) continue;
      links.push({
        fromRoomId: room.id,
        toRoomId: link.target_room,
        access: link.access ?? [],
        requirements: toRequirements(link.access),
      });
    }
  }

  return links;
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }
  return [...duplicates];
}

function assertUnique(values, label) {
  const duplicates = findDuplicates(values);
  if (duplicates.length) {
    throw new Error(`${label}: ${duplicates.length} duplicate(s), e.g. ${duplicates.slice(0, 5)}`);
  }
}

async function main() {
  console.log(`Syncing FFMQ data from ${REPO}@${REF}\n`);

  const [roomsSrc, itemsSrc] = await Promise.all([
    fetchText(`${BASE}/data/rooms.py`),
    fetchText(`${BASE}/Items.py`),
  ]);

  const rooms = extractAssignment(roomsSrc, 'rooms');
  const entrances = extractAssignment(roomsSrc, 'entrances');
  const entrancePairs = extractAssignment(roomsSrc, 'entrances_pairs');
  const shufflingData = extractAssignment(roomsSrc, 'shuffling_data');

  // Items.py builds ItemData(...) objects rather than a plain literal, so read
  // the fields we need with a targeted match instead of parsing it.
  //
  // Comment lines must be stripped first: Items.py carries a long block of
  // commented-out event declarations ("# 'Dark King': ItemData(None, ...)")
  // which otherwise get picked up as if they were real items.
  const liveItemsSrc = itemsSrc.replace(/^[ \t]*#.*$/gm, '');

  const items = [...liveItemsSrc.matchAll(
    /"([^"]+)":\s*ItemData\(([^,]+),\s*ItemClassification\.(\w+)(?:,\s*(\[[^\]]*\]))?/g
  )].map(([, name, rawId, classification, groups]) => ({
    name,
    apItemId: /^\d+$/.test(rawId.trim()) ? AP_BASE + parseInt(rawId.trim(), 10) : null,
    classification,
    groups: groups ? [...groups.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [],
  }));

  // Upstream bug: "Progressive Claw" is tagged into the "Axes" group rather than
  // "Claws" (worlds/ffmq/Items.py). Our logic resolves a bare `Claw` requirement
  // through itemGroups.Claws, so leaving this uncorrected would make every
  // claw-gated check unreachable for anyone playing with progressive gear.
  // Narrow and documented: fix the one tag, do not invent a general rule.
  const GROUP_CORRECTIONS = {
    'Progressive Claw': { from: 'Axes', to: 'Claws' },
  };

  const itemGroups = {};
  for (const item of items) {
    const correction = GROUP_CORRECTIONS[item.name];
    const groups = correction
      ? item.groups.map((g) => (g === correction.from ? correction.to : g))
      : item.groups;

    if (correction) item.groups = groups;
    for (const group of groups) {
      (itemGroups[group] ??= []).push(item.name);
    }
  }

  const checks = buildChecks(rooms);
  const entranceLinks = buildEntranceLinks(rooms);
  const internalLinks = buildInternalLinks(rooms);

  // Triggers are not Archipelago locations, but they matter to logic: reaching
  // one (with its own access met) grants an event, and events gate further
  // links. The event a trigger grants lives in on_trigger, not in its name —
  // the "Waterway Entrance Bombed" trigger grants "BoneWaterwayBombed".
  const triggers = [];
  for (const room of rooms) {
    for (const object of room.game_objects ?? []) {
      if (object.type !== 'Trigger') continue;
      triggers.push({
        roomId: room.id,
        objectId: object.object_id,
        name: object.name,
        grants: (object.on_trigger ?? []).map(yamlItem),
        access: object.access ?? [],
        requirements: toRequirements(object.access),
      });
    }
  }

  // "Dark King" is attached in code rather than in the room data (Regions.py
  // places it directly into the Dark King room), so it has no trigger object.
  const events = [...new Set([...triggers.flatMap((t) => t.grants), 'Dark King'])].sort();

  assertUnique(checks.map((c) => c.apLocationId), 'AP location ids');
  assertUnique(rooms.map((r) => r.id), 'room ids');

  // Upstream reuses a couple of ids in the entrance *definition* table (script
  // and dummy entries). That is only a problem if a reused id is actually
  // referenced by a link, so check that rather than demanding global uniqueness.
  const usedEntranceIds = new Set(entranceLinks.map((l) => l.entranceId));
  const definedEntranceIds = new Set(entrances.map((e) => e.id));
  const duplicateEntranceIds = findDuplicates(entrances.map((e) => e.id));

  const undefinedButUsed = [...usedEntranceIds].filter((id) => !definedEntranceIds.has(id));
  if (undefinedButUsed.length) {
    throw new Error(`entrances referenced by links but never defined: ${undefinedButUsed}`);
  }

  const ambiguous = duplicateEntranceIds.filter((id) => usedEntranceIds.has(id));
  if (ambiguous.length) {
    throw new Error(
      `entrance ids are duplicated upstream AND referenced by links, so they cannot be ` +
      `resolved unambiguously: ${ambiguous}`
    );
  }

  if (duplicateEntranceIds.length) {
    console.warn(
      `  note: ${duplicateEntranceIds.length} entrance id(s) are duplicated upstream ` +
      `(${duplicateEntranceIds.join(', ')}), but none are referenced by a link — ignoring\n`
    );
  }

  // Every access rule must resolve to a real item, event or group, or our
  // name normalisation is wrong and the logic engine would silently misjudge.
  const knownNames = new Set([...items.map((i) => i.name), ...events]);
  const unresolved = new Set();
  for (const { requirements } of [...checks, ...entranceLinks, ...internalLinks, ...triggers]) {
    for (const requirement of requirements) {
      if (requirement.type === 'never') {
        continue;
      } else if (requirement.type === 'anyOfGroup') {
        if (!itemGroups[requirement.group]) unresolved.add(`group:${requirement.group}`);
      } else if (!knownNames.has(requirement.item)) {
        unresolved.add(`${requirement.raw} -> ${requirement.item}`);
      }
    }
  }
  if (unresolved.size) {
    throw new Error(
      `${unresolved.size} access rule token(s) did not resolve to a known item: ` +
      [...unresolved].slice(0, 20).join(', ')
    );
  }

  const counts = {
    rooms: rooms.length,
    entrances: entrances.length,
    entranceLinks: entranceLinks.length,
    internalLinks: internalLinks.length,
    entrancePairs: entrancePairs.length,
    entrancesUsedByLinks: usedEntranceIds.size,
    entrancesDefinedButUnused: definedEntranceIds.size - usedEntranceIds.size,
    checks: checks.length,
    byType: checks.reduce((acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }), {}),
    items: items.length,
    itemGroups: Object.keys(itemGroups).length,
    triggers: triggers.length,
    events: events.length,
  };

  await fs.mkdir(outDir, { recursive: true });

  const files = {
    'rooms.json': rooms,
    'entrances.json': entrances,
    // The logic engine only needs to know which entrances are overworld ones.
    // Emitting just the ids keeps it from pulling the whole 88 KB entrance
    // table into the browser bundle for a single boolean.
    'overworldEntrances.json': entrances
      .filter((e) => e.type === 'Overworld' || !Array.isArray(e.coordinates))
      .map((e) => e.id),
    'entrancePairs.json': entrancePairs,
    'shufflingData.json': shufflingData,
    'checks.json': checks,
    'entranceLinks.json': entranceLinks,
    'internalLinks.json': internalLinks,
    'items.json': items,
    'itemGroups.json': itemGroups,
    'triggers.json': triggers,
    'events.json': events,
    'meta.json': {
      source: `https://github.com/${REPO}/tree/${REF}/worlds/ffmq`,
      repo: REPO,
      ref: REF,
      syncedAt: new Date().toISOString(),
      counts,
      upstreamQuirks: {
        groupCorrections: GROUP_CORRECTIONS,
        duplicateEntranceIds: duplicateEntranceIds,
        note: 'Duplicated in the entrance definition table only; never referenced by a link.',
      },
      note: 'Generated by scripts/sync-ffmq-data.mjs. Do not edit by hand.',
    },
  };

  for (const [name, data] of Object.entries(files)) {
    await fs.writeFile(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    console.log(`  wrote ${name}`);
  }

  console.log('\nCounts:');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(15)} ${typeof value === 'object' ? JSON.stringify(value) : value}`);
  }
}

main().catch((error) => {
  console.error(`\nSync failed: ${error.message}`);
  process.exit(1);
});
