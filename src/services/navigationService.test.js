import { describe, test, expect, beforeEach } from 'vitest';
import { NavigationService } from './navigationService';
import { MAP_DATA } from '../constants/mapData';

let nav;

beforeEach(() => {
  nav = new NavigationService();
});

// Derive expectations from the data itself where possible, so these tests keep
// passing when floors are added and still catch ordering/traversal bugs.
const flatten = () =>
  [...MAP_DATA.regions]
    .sort((a, b) => a.order - b.order)
    .flatMap((region) =>
      [...region.locations]
        .sort((a, b) => a.order - b.order)
        .flatMap((location) =>
          [...location.floors]
            .sort((a, b) => a.order - b.order)
            .map((floor) => ({
              regionId: region.id,
              locationId: location.id,
              floorId: floor.id,
            }))
        )
    );

describe('flattening', () => {
  test('covers every floor exactly once', () => {
    const expected = flatten();
    expect(nav.getAllFloorData()).toHaveLength(expected.length);
    expect(expected.length).toBeGreaterThan(0);
  });

  test('preserves region → location → floor order', () => {
    const actual = nav.getAllFloorData().map((f) => [f.regionId, f.locationId, f.floorId]);
    const expected = flatten().map((f) => [f.regionId, f.locationId, f.floorId]);
    expect(actual).toEqual(expected);
  });

  test('assigns a contiguous globalIndex', () => {
    nav.getAllFloorData().forEach((floor, i) => {
      expect(floor.globalIndex).toBe(i);
    });
  });

  test('every floor carries an image path', () => {
    for (const floor of nav.getAllFloorData()) {
      expect(floor.imagePath, `${floor.floorName} has no imagePath`).toBeTruthy();
    }
  });
});

describe('lookups', () => {
  test('getInitialState returns the first floor of the first location of the first region', () => {
    expect(nav.getInitialState()).toEqual(flatten()[0]);
  });

  test('getCurrentFloorData finds a floor by its full coordinates', () => {
    const { regionId, locationId, floorId } = flatten()[5];
    const found = nav.getCurrentFloorData(regionId, locationId, floorId);

    expect(found).toBeDefined();
    expect(found.floorId).toBe(floorId);
  });

  test('getCurrentFloorData returns undefined for a mismatched combination', () => {
    expect(nav.getCurrentFloorData(999, 999, 999)).toBeUndefined();
  });

  test('getFirstFloorForLocation returns the lowest-order floor, not the lowest id', () => {
    const region = [...MAP_DATA.regions].sort((a, b) => a.order - b.order)[1];
    const location = [...region.locations].sort((a, b) => a.order - b.order)[0];
    const lowestOrder = [...location.floors].sort((a, b) => a.order - b.order)[0];

    expect(nav.getFirstFloorForLocation(region.id, location.id)).toBe(lowestOrder.id);
  });

  test('getFirstLocationForRegion returns null-ish for an unknown region', () => {
    expect(nav.getFirstLocationForRegion(9999)).toBeNull();
  });

  test('getFloorsForLocation returns [] for an unknown region', () => {
    expect(nav.getFloorsForLocation(9999, 1)).toEqual([]);
  });
});

describe('previous / next traversal', () => {
  test('next steps forward one floor', () => {
    const [first, second] = flatten();
    expect(nav.navigateNext(first.regionId, first.locationId, first.floorId)).toEqual(second);
  });

  test('previous steps back one floor', () => {
    const [first, second] = flatten();
    expect(nav.navigatePrevious(second.regionId, second.locationId, second.floorId)).toEqual(first);
  });

  test('next crosses a location boundary', () => {
    const all = flatten();
    const i = all.findIndex((f, n) => n > 0 && all[n - 1].locationId !== f.locationId);
    const from = all[i - 1];

    expect(nav.navigateNext(from.regionId, from.locationId, from.floorId)).toEqual(all[i]);
    expect(all[i].locationId).not.toBe(from.locationId);
  });

  test('next crosses a region boundary', () => {
    const all = flatten();
    const i = all.findIndex((f, n) => n > 0 && all[n - 1].regionId !== f.regionId);
    const from = all[i - 1];

    expect(nav.navigateNext(from.regionId, from.locationId, from.floorId)).toEqual(all[i]);
    expect(all[i].regionId).not.toBe(from.regionId);
  });

  test('previous is null at the very first floor', () => {
    const first = flatten()[0];
    expect(nav.navigatePrevious(first.regionId, first.locationId, first.floorId)).toBeNull();
  });

  test('next is null at the very last floor', () => {
    const all = flatten();
    const last = all[all.length - 1];
    expect(nav.navigateNext(last.regionId, last.locationId, last.floorId)).toBeNull();
  });

  test('walking next from the start reaches the last floor', () => {
    const all = flatten();
    let cur = all[0];
    let steps = 0;

    while (steps < all.length) {
      const next = nav.navigateNext(cur.regionId, cur.locationId, cur.floorId);
      if (!next) break;
      cur = next;
      steps += 1;
    }

    expect(steps).toBe(all.length - 1);
    expect(cur).toEqual(all[all.length - 1]);
  });
});

describe('navigation guards', () => {
  test('canNavigatePrevious is false at the start and true after it', () => {
    const all = flatten();
    const [first, second] = all;

    expect(nav.canNavigatePrevious(first.regionId, first.locationId, first.floorId)).toBe(false);
    expect(nav.canNavigatePrevious(second.regionId, second.locationId, second.floorId)).toBe(true);
  });

  test('canNavigateNext is false at the end and true before it', () => {
    const all = flatten();
    const last = all[all.length - 1];
    const penultimate = all[all.length - 2];

    expect(nav.canNavigateNext(last.regionId, last.locationId, last.floorId)).toBe(false);
    expect(nav.canNavigateNext(penultimate.regionId, penultimate.locationId, penultimate.floorId)).toBe(true);
  });
});
