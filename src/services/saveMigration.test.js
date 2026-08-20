import { describe, test, expect, beforeEach } from 'vitest';
import { migrate, isReadableSave, CURRENT_VERSION } from './saveMigration';
import { gameService } from './gameService';

// A v1 save, in the shape the old code actually wrote: a bare array, with
// doorConnections populated but isLinked never persisted (the lost-update bug),
// and door states stamped floorId: 0.
const v1Save = [
  {
    id: 1,
    name: 'Old Run',
    startDate: '2025-01-01T00:00:00.000Z',
    lastPlayed: '2025-01-02T00:00:00.000Z',
    finishedDate: null,
    isFinished: false,
    locationStates: {
      42: { locationId: 42, floorId: 20102, type: 'chest', isOpened: true, isLinked: false },
      5: { locationId: 5, floorId: 0, type: 'unknown', isOpened: false, isLinked: false },
    },
    doorConnections: { door_5: 'door_9', door_9: 'door_5' },
  },
];

describe('reading a v1 save', () => {
  test('is recognised as readable', () => {
    expect(isReadableSave(v1Save)).toBe(true);
  });

  test('comes back at the current version', () => {
    expect(migrate(v1Save).version).toBe(CURRENT_VERSION);
  });

  test('keeps the run and its identity', () => {
    const { games } = migrate(v1Save);

    expect(games).toHaveLength(1);
    expect(games[0].id).toBe(1);
    expect(games[0].name).toBe('Old Run');
    expect(games[0].startDate).toBe('2025-01-01T00:00:00.000Z');
  });

  test('keeps progress that was already recorded', () => {
    const { games } = migrate(v1Save);
    expect(games[0].locationStates[42].isOpened).toBe(true);
    expect(games[0].locationStates[42].type).toBe('chest');
  });

  // The point of the migration: doorConnections survived the old bug, so the
  // flags can be rebuilt from it.
  test('rebuilds isLinked from doorConnections', () => {
    const { games } = migrate(v1Save);

    expect(games[0].locationStates[5].isLinked).toBe(true);
    expect(games[0].locationStates[5].linkedToLocationId).toBe(9);
    expect(games[0].locationStates[9].isLinked).toBe(true);
    expect(games[0].locationStates[9].linkedToLocationId).toBe(5);
  });

  test('normalises the floorId 0 placeholder to null', () => {
    const { games } = migrate(v1Save);
    expect(games[0].locationStates[5].floorId).toBeNull();
  });

  test('leaves real floor ids alone', () => {
    const { games } = migrate(v1Save);
    expect(games[0].locationStates[42].floorId).toBe(20102);
  });
});

describe('self-linked battlegrounds', () => {
  // Self-linking used to be how you marked a battleground cleared. They are
  // checks now, so the intent has to survive even though the mechanism is gone.
  const withSelfLink = [{
    id: 1,
    name: 'Run',
    locationStates: { 7: { locationId: 7, floorId: 10101, type: 'battleground' } },
    doorConnections: { door_7: 'door_7' },
  }];

  test('become cleared checks', () => {
    const { games } = migrate(withSelfLink);
    expect(games[0].locationStates[7].isOpened).toBe(true);
  });

  test('no longer look like links', () => {
    const { games } = migrate(withSelfLink);

    expect(games[0].locationStates[7].isLinked).toBe(false);
    expect(games[0].locationStates[7].linkedToLocationId).toBeNull();
    expect(games[0].doorConnections.door_7).toBeUndefined();
  });
});

describe('robustness', () => {
  test('an already-current save passes through unchanged', () => {
    const current = { version: CURRENT_VERSION, games: v1Save };
    const { games } = migrate(current);

    expect(games).toHaveLength(1);
    expect(games[0].name).toBe('Old Run');
  });

  test('garbage yields an empty save rather than throwing', () => {
    expect(migrate(null).games).toEqual([]);
    expect(migrate('nonsense').games).toEqual([]);
    expect(migrate({}).games).toEqual([]);
  });

  test('missing fields are filled in rather than rejected', () => {
    const { games } = migrate([{ id: 3 }]);

    expect(games[0].name).toBe('Unnamed run');
    expect(games[0].isFinished).toBe(false);
    expect(games[0].locationStates).toEqual({});
    expect(games[0].doorConnections).toEqual({});
  });

  test('malformed door connections are skipped, not fatal', () => {
    const { games } = migrate([{
      id: 1, name: 'x', locationStates: {}, doorConnections: { garbage: 'door_9', door_x: 'door_y' },
    }]);

    expect(games[0].locationStates).toEqual({});
  });
});

describe('end to end through gameService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('a v1 save in localStorage loads and is repaired', () => {
    localStorage.setItem('mystic_quest_games', JSON.stringify(v1Save));

    const games = gameService.getAllGames();

    expect(games).toHaveLength(1);
    expect(games[0].locationStates[5].isLinked).toBe(true);
  });

  test('saving writes the versioned envelope', () => {
    localStorage.setItem('mystic_quest_games', JSON.stringify(v1Save));

    const game = gameService.getGame(1);
    gameService.saveGame(game);

    const stored = JSON.parse(localStorage.getItem('mystic_quest_games'));
    expect(stored.version).toBe(CURRENT_VERSION);
    expect(Array.isArray(stored.games)).toBe(true);
  });

  test('unparseable storage does not crash the app', () => {
    localStorage.setItem('mystic_quest_games', 'not json at all');
    expect(gameService.getAllGames()).toEqual([]);
  });
});
