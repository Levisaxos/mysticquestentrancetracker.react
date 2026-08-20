import { describe, test, expect } from 'vitest';
import binding from './binding.json';
import entrances from './ffmq/entrances.json';
import entranceLinks from './ffmq/entranceLinks.json';
import checks from './ffmq/checks.json';
import { LOCATIONS_DATA } from '../constants/locationsData';
import { MAP_DATA } from '../constants/mapData';

const usedEntranceIds = new Set(entranceLinks.map((l) => l.entranceId));
const entranceById = new Map(entrances.map((e) => [e.id, e]));
const checkByApId = new Map(checks.map((c) => [c.apLocationId, c]));

const ourMarkerIds = new Set(
  Object.values(LOCATIONS_DATA).flatMap((markers) => markers.map((m) => m.id))
);
const ourFloorIds = new Set(
  MAP_DATA.regions.flatMap((r) => r.locations.flatMap((l) => l.floors.map((f) => String(f.id))))
);

const entries = Object.entries(binding.markers);

describe('binding references', () => {
  test('every bound marker id is one of ours', () => {
    const unknown = entries.filter(([id]) => !ourMarkerIds.has(Number(id))).map(([id]) => id);
    expect(unknown).toEqual([]);
  });

  test('every floor binding points at a real floor', () => {
    const unknown = Object.keys(binding.floors).filter((id) => !ourFloorIds.has(id));
    expect(unknown).toEqual([]);
  });

  test('every entrance binding points at an entrance that links to something', () => {
    const bad = entries
      .filter(([, b]) => b.kind === 'entrance')
      .filter(([, b]) => !entranceById.has(b.entranceId) || !usedEntranceIds.has(b.entranceId))
      .map(([id, b]) => `marker ${id} -> entrance ${b.entranceId}`);

    expect(bad).toEqual([]);
  });

  test('every resolved check binding points at a real AP location', () => {
    const bad = entries
      .filter(([, b]) => b.kind === 'check' && b.apLocationId !== undefined)
      .filter(([, b]) => !checkByApId.has(b.apLocationId))
      .map(([id, b]) => `marker ${id} -> ${b.apLocationId}`);

    expect(bad).toEqual([]);
  });

  test('every candidate list references real AP locations', () => {
    const bad = [];
    for (const [id, b] of entries) {
      for (const candidate of b.candidates ?? []) {
        if (!checkByApId.has(candidate)) bad.push(`marker ${id} -> ${candidate}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('binding uniqueness', () => {
  // The whole point of the binding is a 1:1 correspondence. Two markers claiming
  // one entrance would silently corrupt both logic and AP tracking.
  test('no two markers claim the same entrance', () => {
    const seen = new Map();
    const clashes = [];

    for (const [id, b] of entries) {
      if (b.kind !== 'entrance') continue;
      if (seen.has(b.entranceId)) clashes.push(`entrance ${b.entranceId}: markers ${seen.get(b.entranceId)} and ${id}`);
      else seen.set(b.entranceId, id);
    }

    expect(clashes).toEqual([]);
  });

  test('no two markers claim the same resolved check', () => {
    const seen = new Map();
    const clashes = [];

    for (const [id, b] of entries) {
      if (b.kind !== 'check' || b.apLocationId === undefined) continue;
      if (seen.has(b.apLocationId)) clashes.push(`check ${b.apLocationId}: markers ${seen.get(b.apLocationId)} and ${id}`);
      else seen.set(b.apLocationId, id);
    }

    expect(clashes).toEqual([]);
  });
});

describe('binding shape', () => {
  test('every binding declares a kind, a confidence and how it was derived', () => {
    for (const [id, b] of entries) {
      expect(['entrance', 'check'], `marker ${id}`).toContain(b.kind);
      expect(['high', 'name-only', 'geometry-only', 'leftover', 'room-only', 'unresolved'], `marker ${id}`)
        .toContain(b.confidence);
      expect(b.via, `marker ${id}`).toBeTruthy();
    }
  });

  test('resolved bindings name a target; weaker ones offer candidates', () => {
    for (const [id, b] of entries) {
      if (b.confidence === 'unresolved') {
        expect(b.candidates, `marker ${id} is unresolved so should list candidates`).toBeDefined();
      } else if (b.confidence === 'room-only') {
        // Enough to know the room, not which check within it — which is all
        // reachability needs, since checks in one room share it.
        expect(b.roomId, `marker ${id} is room-only so should name a room`).not.toBeNull();
        expect(b.candidates?.length, `marker ${id} should narrow to that room`).toBeGreaterThan(0);
      } else {
        const target = b.kind === 'entrance' ? b.entranceId : b.apLocationId;
        expect(target, `marker ${id} is ${b.confidence} so should name a target`).toBeDefined();
      }
    }
  });

  // Every battlefield in a subregion shares a room, so binding a battleground
  // to its subregion is enough to colour it correctly.
  test('battlegrounds resolve to a subregion, and the quotas add up', () => {
    const battlegrounds = entries.filter(([, b]) => b.checkType === 'Battlefield');
    expect(battlegrounds).toHaveLength(20);

    const perRoom = new Map();
    for (const [, b] of battlegrounds) {
      expect(b.roomId, 'every battleground should know its subregion').not.toBeNull();
      perRoom.set(b.roomId, (perRoom.get(b.roomId) ?? 0) + 1);
    }

    // Each subregion must get exactly as many markers as it has battlefields.
    for (const [roomId, count] of perRoom) {
      const available = checks.filter((c) => c.type === 'Battlefield' && c.roomId === roomId).length;
      expect(count, `subregion ${roomId}`).toBe(available);
    }
  });

  test('battlegrounds are bound as checks, not entrances', () => {
    const battlegroundIds = new Set(
      Object.values(LOCATIONS_DATA)
        .flatMap((markers) => markers.filter((m) => m.type === 'battleground'))
        .map((m) => m.id)
    );

    for (const id of battlegroundIds) {
      const b = binding.markers[String(id)];
      if (!b) continue;
      expect(b.kind, `battleground marker ${id}`).toBe('check');
      expect(b.checkType, `battleground marker ${id}`).toBe('Battlefield');
    }
  });
});

describe('coverage', () => {
  // A ratchet, not a target: if a change drops coverage, that should be a
  // deliberate decision rather than a silent regression.
  test('at least 300 markers are bound', () => {
    expect(entries.length).toBeGreaterThanOrEqual(300);
  });

  // Ratchet on the thing that actually matters for an entrance tracker.
  test('at least 290 door markers resolve to an entrance', () => {
    const bound = entries.filter(([, b]) => b.kind === 'entrance').length;
    expect(bound).toBeGreaterThanOrEqual(290);
  });

  test('at least 90 floors are bound to an area', () => {
    expect(Object.keys(binding.floors).length).toBeGreaterThanOrEqual(90);
  });
});
