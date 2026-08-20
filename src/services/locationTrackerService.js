import { gameService } from './gameService';

/**
 * Number of distinct door pairs linked in a run.
 *
 * Each link is stored in both directions, so counting keys would report double.
 * A self-link stores a single key, which this also handles.
 */
export function countLinkedPairsIn(game) {
  if (!game?.doorConnections) return 0;

  const seen = new Set();
  for (const [from, to] of Object.entries(game.doorConnections)) {
    seen.add([from, to].sort().join('|'));
  }
  return seen.size;
}

const defaultState = (locationId, floorId) => ({
  locationId,
  floorId: floorId ?? null,
  type: 'unknown',
  isOpened: false,
  isVisited: false,
  isLinked: false,
  isDisabled: false,
  linkedToLocationId: null,
});

// Location State Management Service
//
// Every public method funnels through _mutate, which reads the run once, hands
// it to a callback, and writes it once. That single rule is what fixes the bug
// this service used to have: linkDoors read a snapshot, called helpers that each
// re-read and re-saved independently, then wrote its own stale snapshot back on
// top — silently discarding the isLinked flags it had just set.
class LocationTrackerService {
  _mutate(gameId, fn) {
    const game = gameService.getGame(gameId);
    if (!game) return false;

    fn(game);
    gameService.saveGame(game);
    return true;
  }

  // Get (creating if needed) the state record for a location, on the game object
  // being mutated — never from storage.
  _stateFor(game, locationId, floorId) {
    if (!game.locationStates[locationId]) {
      game.locationStates[locationId] = defaultState(locationId, floorId);
    } else if (floorId != null && game.locationStates[locationId].floorId == null) {
      // Backfill the floor for records written before we tracked it.
      game.locationStates[locationId].floorId = floorId;
    }
    return game.locationStates[locationId];
  }

  updateLocationState(gameId, locationId, floorId, updateFn) {
    this._mutate(gameId, (game) => {
      updateFn(this._stateFor(game, locationId, floorId));
    });
  }

  /**
   * Link two doors. floorIds is optional but worth passing: without it the
   * state records have no floor, which blocks any per-floor reporting later.
   */
  linkDoors(gameId, doorId1, doorId2, floorIds = {}) {
    this._mutate(gameId, (game) => {
      game.doorConnections[`door_${doorId1}`] = `door_${doorId2}`;
      game.doorConnections[`door_${doorId2}`] = `door_${doorId1}`;

      const first = this._stateFor(game, doorId1, floorIds[doorId1]);
      first.isLinked = true;
      first.linkedToLocationId = doorId2;

      const second = this._stateFor(game, doorId2, floorIds[doorId2]);
      second.isLinked = true;
      second.linkedToLocationId = doorId1;
    });
  }

  unlinkDoors(gameId, doorId1, doorId2) {
    this._mutate(gameId, (game) => {
      delete game.doorConnections[`door_${doorId1}`];
      delete game.doorConnections[`door_${doorId2}`];

      for (const doorId of [doorId1, doorId2]) {
        const state = game.locationStates[doorId];
        if (state) {
          state.isLinked = false;
          state.linkedToLocationId = null;
        }
      }
    });
  }

  getLinkedDoor(gameId, doorId) {
    const game = gameService.getGame(gameId);
    if (!game) return null;

    const linkedKey = game.doorConnections[`door_${doorId}`];
    if (linkedKey && linkedKey.startsWith('door_')) {
      return parseInt(linkedKey.substring(5), 10);
    }
    return null;
  }

  // Chests, boxes and battlegrounds are all just checks: things you clear once.
  toggleCheck(gameId, locationId, floorId, type) {
    this._mutate(gameId, (game) => {
      const state = this._stateFor(game, locationId, floorId);
      state.type = type;
      state.isOpened = !state.isOpened;
    });
  }

  markLocationAsDisabled(gameId, locationId, floorId) {
    this._mutate(gameId, (game) => {
      const state = this._stateFor(game, locationId, floorId);
      state.isDisabled = !state.isDisabled;
    });
  }

  getLocationState(gameId, locationId) {
    const game = gameService.getGame(gameId);
    return game?.locationStates[locationId] || null;
  }

  /** Number of distinct door pairs linked in this run. */
  countLinkedPairs(gameId) {
    return countLinkedPairsIn(gameService.getGame(gameId));
  }
}

export const locationTrackerService = new LocationTrackerService();
