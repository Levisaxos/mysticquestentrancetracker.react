import { describe, test, expect, beforeEach } from 'vitest';
import { gameService } from './gameService';
import { locationTrackerService } from './locationTrackerService';

let gameId;

beforeEach(() => {
  localStorage.clear();
  gameId = gameService.createGame('test run').id;
});

describe('door linking', () => {
  test('links two doors symmetrically', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);

    expect(locationTrackerService.getLinkedDoor(gameId, 5)).toBe(9);
    expect(locationTrackerService.getLinkedDoor(gameId, 9)).toBe(5);
  });

  test('a link survives a reload of the save', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);

    const reloaded = gameService.getGame(gameId);
    expect(reloaded.doorConnections.door_5).toBe('door_9');
    expect(reloaded.doorConnections.door_9).toBe('door_5');
  });

  test('unlinking clears both directions', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);
    locationTrackerService.unlinkDoors(gameId, 5, 9);

    expect(locationTrackerService.getLinkedDoor(gameId, 5)).toBeNull();
    expect(locationTrackerService.getLinkedDoor(gameId, 9)).toBeNull();
  });

  test('a door can be linked to itself', () => {
    locationTrackerService.linkDoors(gameId, 7, 7);

    expect(locationTrackerService.getLinkedDoor(gameId, 7)).toBe(7);
  });

  test('a self-link can be undone', () => {
    locationTrackerService.linkDoors(gameId, 7, 7);
    locationTrackerService.unlinkDoors(gameId, 7, 7);

    expect(locationTrackerService.getLinkedDoor(gameId, 7)).toBeNull();
  });

  test('unlinked doors report no partner', () => {
    expect(locationTrackerService.getLinkedDoor(gameId, 1234)).toBeNull();
  });

  test('an unknown game is handled without throwing', () => {
    expect(() => locationTrackerService.linkDoors(9999, 1, 2)).not.toThrow();
    expect(locationTrackerService.getLinkedDoor(9999, 1)).toBeNull();
  });
});

describe('chests and boxes', () => {
  test('toggling a chest opens it, and records its type and floor', () => {
    locationTrackerService.toggleCheck(gameId, 42, 20102, 'chest');
    const state = locationTrackerService.getLocationState(gameId, 42);

    expect(state.isOpened).toBe(true);
    expect(state.type).toBe('chest');
    expect(state.floorId).toBe(20102);
  });

  test('toggling twice closes it again', () => {
    locationTrackerService.toggleCheck(gameId, 42, 20102, 'chest');
    locationTrackerService.toggleCheck(gameId, 42, 20102, 'chest');

    expect(locationTrackerService.getLocationState(gameId, 42).isOpened).toBe(false);
  });

  test('boxes are tracked independently of chests', () => {
    locationTrackerService.toggleCheck(gameId, 42, 20102, 'chest');
    locationTrackerService.toggleCheck(gameId, 43, 20102, 'box');

    expect(locationTrackerService.getLocationState(gameId, 42).type).toBe('chest');
    expect(locationTrackerService.getLocationState(gameId, 43).type).toBe('box');
  });

  test('an untouched location has no state', () => {
    expect(locationTrackerService.getLocationState(gameId, 999)).toBeNull();
  });
});

describe('disabling markers', () => {
  test('marks a door as disabled and toggles it back', () => {
    locationTrackerService.markLocationAsDisabled(gameId, 11, 20102);
    expect(locationTrackerService.getLocationState(gameId, 11).isDisabled).toBe(true);

    locationTrackerService.markLocationAsDisabled(gameId, 11, 20102);
    expect(locationTrackerService.getLocationState(gameId, 11).isDisabled).toBe(false);
  });
});

describe('state isolation', () => {
  test('two runs do not share progress', () => {
    const otherId = gameService.createGame('second run').id;

    locationTrackerService.linkDoors(gameId, 5, 9);
    locationTrackerService.toggleCheck(gameId, 42, 20102, 'chest');

    expect(locationTrackerService.getLinkedDoor(otherId, 5)).toBeNull();
    expect(locationTrackerService.getLocationState(otherId, 42)).toBeNull();
  });
});

// Regression tests for the lost-update bug fixed in the Phase 2 state layer.
//
// linkDoors used to read the save into a snapshot, mutate doorConnections on it,
// call helpers that each re-read and re-saved independently, then write its own
// stale snapshot back on top — discarding the isLinked flags it had just set.
// doorConnections survived, which is why linking appeared to work and only the
// derived "doors linked" stat was wrong.
describe('linkDoors writes every change exactly once', () => {
  test('persists isLinked on both doors', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);

    expect(locationTrackerService.getLocationState(gameId, 5).isLinked).toBe(true);
    expect(locationTrackerService.getLocationState(gameId, 9).isLinked).toBe(true);
  });

  test('persists linkedToLocationId on both doors', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);

    expect(locationTrackerService.getLocationState(gameId, 5).linkedToLocationId).toBe(9);
    expect(locationTrackerService.getLocationState(gameId, 9).linkedToLocationId).toBe(5);
  });

  test('unlinkDoors clears isLinked on both doors', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);
    locationTrackerService.unlinkDoors(gameId, 5, 9);

    expect(locationTrackerService.getLocationState(gameId, 5).isLinked).toBe(false);
    expect(locationTrackerService.getLocationState(gameId, 9).linkedToLocationId).toBeNull();
  });

  test('records the floor each door sits on when told', () => {
    locationTrackerService.linkDoors(gameId, 5, 9, { 5: 20301, 9: 40201 });

    expect(locationTrackerService.getLocationState(gameId, 5).floorId).toBe(20301);
    expect(locationTrackerService.getLocationState(gameId, 9).floorId).toBe(40201);
  });

  test('does not clobber progress recorded earlier in the run', () => {
    locationTrackerService.toggleCheck(gameId, 42, 20102, 'chest');
    locationTrackerService.linkDoors(gameId, 5, 9);

    expect(locationTrackerService.getLocationState(gameId, 42).isOpened).toBe(true);
    expect(locationTrackerService.getLinkedDoor(gameId, 5)).toBe(9);
  });
});

describe('countLinkedPairs', () => {
  test('counts a pair once, not once per end', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);
    expect(locationTrackerService.countLinkedPairs(gameId)).toBe(1);
  });

  test('counts multiple pairs', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);
    locationTrackerService.linkDoors(gameId, 11, 12);
    expect(locationTrackerService.countLinkedPairs(gameId)).toBe(2);
  });

  test('counts a self-link as one', () => {
    locationTrackerService.linkDoors(gameId, 7, 7);
    expect(locationTrackerService.countLinkedPairs(gameId)).toBe(1);
  });

  test('drops back to zero after unlinking', () => {
    locationTrackerService.linkDoors(gameId, 5, 9);
    locationTrackerService.unlinkDoors(gameId, 5, 9);
    expect(locationTrackerService.countLinkedPairs(gameId)).toBe(0);
  });

  test('is zero for an unknown run', () => {
    expect(locationTrackerService.countLinkedPairs(9999)).toBe(0);
  });
});
