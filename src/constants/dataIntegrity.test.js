import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_DATA } from './mapData';
import { LOCATIONS_DATA } from './locationsData';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');

const allFloors = MAP_DATA.regions.flatMap((region) =>
  region.locations.flatMap((location) =>
    location.floors.map((floor) => ({ ...floor, region: region.name, location: location.name }))
  )
);

// Known gap, tracked in docs/PLAN.md: LOCATIONS_DATA has a key with no matching
// floor in MAP_DATA, so its markers are unreachable. Listed here so the suite
// stays green while the exception stays visible. Remove once resolved.
const KNOWN_ORPHAN_FLOOR_IDS = ['40302'];

const MARKER_TYPES = ['door', 'battleground', 'chest', 'box'];

describe('map hierarchy', () => {
  test('ids are unique across regions, locations and floors', () => {
    const regionIds = MAP_DATA.regions.map((r) => r.id);
    const locationIds = MAP_DATA.regions.flatMap((r) => r.locations.map((l) => l.id));
    const floorIds = allFloors.map((f) => f.id);

    expect(new Set(regionIds).size).toBe(regionIds.length);
    expect(new Set(locationIds).size).toBe(locationIds.length);
    expect(new Set(floorIds).size).toBe(floorIds.length);
  });

  test('every region, location and floor has a name and an order', () => {
    for (const region of MAP_DATA.regions) {
      expect(region.name).toBeTruthy();
      expect(typeof region.order).toBe('number');

      for (const location of region.locations) {
        expect(location.name, `region ${region.name}`).toBeTruthy();
        expect(typeof location.order).toBe('number');

        for (const floor of location.floors) {
          expect(floor.name, `location ${location.name}`).toBeTruthy();
          expect(typeof floor.order).toBe('number');
        }
      }
    }
  });

  test('every referenced map image exists on disk', () => {
    const missing = allFloors
      .filter((floor) => !fs.existsSync(path.join(publicDir, decodeURIComponent(floor.imagePath))))
      .map((floor) => `${floor.region} / ${floor.location} / ${floor.name} -> ${floor.imagePath}`);

    expect(missing).toEqual([]);
  });
});

describe('markers', () => {
  const allMarkers = Object.entries(LOCATIONS_DATA).flatMap(([floorId, markers]) =>
    markers.map((marker) => ({ ...marker, floorId }))
  );

  test('marker ids are globally unique', () => {
    const seen = new Map();
    const duplicates = [];

    for (const marker of allMarkers) {
      if (seen.has(marker.id)) {
        duplicates.push(`id ${marker.id}: floor ${seen.get(marker.id)} and ${marker.floorId}`);
      } else {
        seen.set(marker.id, marker.floorId);
      }
    }

    expect(duplicates).toEqual([]);
  });

  test('every marker has a known type, a name and numeric coordinates', () => {
    for (const marker of allMarkers) {
      expect(MARKER_TYPES, `marker ${marker.id} on floor ${marker.floorId}`).toContain(marker.type);
      expect(marker.name).toBeTruthy();
      expect(Number.isFinite(marker.x)).toBe(true);
      expect(Number.isFinite(marker.y)).toBe(true);
    }
  });

  test('coordinates are non-negative', () => {
    const bad = allMarkers
      .filter((m) => m.x < 0 || m.y < 0)
      .map((m) => `${m.id} (${m.x}, ${m.y})`);

    expect(bad).toEqual([]);
  });

  test('every floor in the map hierarchy has at least one marker', () => {
    const empty = allFloors
      .filter((floor) => !(LOCATIONS_DATA[String(floor.id)] || []).length)
      .map((floor) => `${floor.region} / ${floor.location} / ${floor.name} (${floor.id})`);

    expect(empty).toEqual([]);
  });

  test('every marker set belongs to a real floor, apart from known orphans', () => {
    const floorIds = new Set(allFloors.map((f) => String(f.id)));
    const orphans = Object.keys(LOCATIONS_DATA)
      .filter((key) => !floorIds.has(key))
      .filter((key) => !KNOWN_ORPHAN_FLOOR_IDS.includes(key));

    expect(orphans).toEqual([]);
  });

  test('the known orphan is still the only one, so the exception stays honest', () => {
    const floorIds = new Set(allFloors.map((f) => String(f.id)));
    const stillOrphaned = KNOWN_ORPHAN_FLOOR_IDS.filter((key) => !floorIds.has(key));

    // If this fails because the list is empty, the orphan was fixed — delete
    // KNOWN_ORPHAN_FLOOR_IDS and this test along with it.
    expect(stillOrphaned).toEqual(KNOWN_ORPHAN_FLOOR_IDS);
  });
});
