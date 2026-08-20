import { describe, test, expect, beforeEach, vi } from 'vitest';
import { gameService } from './gameService';

beforeEach(() => {
  localStorage.clear();
});

describe('creating and listing games', () => {
  test('starts with no games', () => {
    expect(gameService.getAllGames()).toEqual([]);
    expect(gameService.getCurrentGame()).toBeNull();
  });

  test('creates a game with sensible defaults', () => {
    const game = gameService.createGame('First Run');

    expect(game.id).toBe(1);
    expect(game.name).toBe('First Run');
    expect(game.isFinished).toBe(false);
    expect(game.finishedDate).toBeNull();
    expect(game.locationStates).toEqual({});
    expect(game.doorConnections).toEqual({});
    expect(Date.parse(game.startDate)).not.toBeNaN();
  });

  test('persists across service reads', () => {
    gameService.createGame('First Run');
    expect(gameService.getAllGames()).toHaveLength(1);
    expect(gameService.getGame(1).name).toBe('First Run');
  });

  test('assigns ids above the current maximum, including after a delete', () => {
    gameService.createGame('a');
    gameService.createGame('b');
    gameService.deleteGame(1);

    // id 2 still exists, so the next id must not reuse it
    expect(gameService.createGame('c').id).toBe(3);
  });

  test('splits active and finished games', () => {
    gameService.createGame('active one');
    const second = gameService.createGame('done one');
    gameService.finishGame(second.id);

    expect(gameService.getActiveGames().map(g => g.name)).toEqual(['active one']);
    expect(gameService.getFinishedGames().map(g => g.name)).toEqual(['done one']);
  });
});

describe('finishing and reopening', () => {
  test('finishGame stamps a finished date', () => {
    const game = gameService.createGame('run');
    const finished = gameService.finishGame(game.id);

    expect(finished.isFinished).toBe(true);
    expect(Date.parse(finished.finishedDate)).not.toBeNaN();
    expect(gameService.getGame(game.id).isFinished).toBe(true);
  });

  test('finishGame is a no-op on an already finished game', () => {
    const game = gameService.createGame('run');
    gameService.finishGame(game.id);

    expect(gameService.finishGame(game.id)).toBeNull();
  });

  test('unfinishGame clears the finished date', () => {
    const game = gameService.createGame('run');
    gameService.finishGame(game.id);
    const reopened = gameService.unfinishGame(game.id);

    expect(reopened.isFinished).toBe(false);
    expect(reopened.finishedDate).toBeNull();
  });

  test('finishing the current game clears the current-game pointer', () => {
    const game = gameService.createGame('run');
    gameService.setCurrentGame(game.id);
    gameService.finishGame(game.id);

    expect(gameService.getCurrentGameId()).toBeNull();
  });
});

describe('the current-game pointer', () => {
  test('round-trips as a number', () => {
    const game = gameService.createGame('run');
    gameService.setCurrentGame(game.id);

    expect(gameService.getCurrentGameId()).toBe(game.id);
    expect(gameService.getCurrentGame().name).toBe('run');
  });

  test('setCurrentGame(null) clears it', () => {
    gameService.setCurrentGame(gameService.createGame('run').id);
    gameService.setCurrentGame(null);

    expect(gameService.getCurrentGameId()).toBeNull();
    expect(gameService.getCurrentGame()).toBeNull();
  });

  test('deleting the current game clears the pointer', () => {
    const game = gameService.createGame('run');
    gameService.setCurrentGame(game.id);
    gameService.deleteGame(game.id);

    expect(gameService.getCurrentGameId()).toBeNull();
    expect(gameService.getAllGames()).toEqual([]);
  });
});

describe('saveGame', () => {
  test('updates an existing game in place rather than appending', () => {
    const game = gameService.createGame('run');
    game.name = 'renamed';
    gameService.saveGame(game);

    expect(gameService.getAllGames()).toHaveLength(1);
    expect(gameService.getGame(game.id).name).toBe('renamed');
  });

  test('refreshes lastPlayed for an unfinished game', () => {
    const game = gameService.createGame('run');
    const original = game.lastPlayed;
    game.lastPlayed = '2000-01-01T00:00:00.000Z';
    gameService.saveGame(game);

    expect(gameService.getGame(game.id).lastPlayed).not.toBe('2000-01-01T00:00:00.000Z');
    expect(Date.parse(gameService.getGame(game.id).lastPlayed))
      .toBeGreaterThanOrEqual(Date.parse(original));
  });

  test('leaves lastPlayed alone for a finished game', () => {
    const game = gameService.createGame('run');
    gameService.finishGame(game.id);

    const finished = gameService.getGame(game.id);
    const stamp = finished.lastPlayed;
    gameService.saveGame(finished);

    expect(gameService.getGame(game.id).lastPlayed).toBe(stamp);
  });
});

describe('export and import of a single game', () => {
  test('exportGameData produces parseable JSON for the game', () => {
    const game = gameService.createGame('run');
    const parsed = JSON.parse(gameService.exportGameData(game.id));

    expect(parsed.name).toBe('run');
    expect(parsed.id).toBe(game.id);
  });

  test('exportGameData returns an empty object for an unknown game', () => {
    expect(gameService.exportGameData(999)).toBe('{}');
  });

  test('importGameData adds the game under a fresh id', () => {
    const original = gameService.createGame('run');
    const payload = gameService.exportGameData(original.id);

    const imported = gameService.importGameData(payload);

    expect(imported.id).not.toBe(original.id);
    expect(imported.name).toBe('run');
    expect(gameService.getAllGames()).toHaveLength(2);
  });

  test('importGameData returns null on malformed input', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(gameService.importGameData('not json')).toBeNull();

    spy.mockRestore();
  });
});
