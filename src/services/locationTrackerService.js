import { gameService } from './gameService';

// Location State Management Service
class LocationTrackerService {
  updateLocationState(gameId, locationId, floorId, updateFn) {
    const game = gameService.getGame(gameId);
    if (!game) return;

    if (!game.locationStates[locationId]) {
      game.locationStates[locationId] = {
        locationId,
        floorId,
        type: 'unknown',
        isOpened: false,
        isVisited: false,
        isLinked: false,
        isDisabled: false,
        linkedToLocationId: null
      };
    }

    updateFn(game.locationStates[locationId]);
    gameService.saveGame(game);
  }

  linkDoors(gameId, doorId1, doorId2) {
    const game = gameService.getGame(gameId);
    if (!game) return;

    // Create bidirectional links
    game.doorConnections[`door_${doorId1}`] = `door_${doorId2}`;
    game.doorConnections[`door_${doorId2}`] = `door_${doorId1}`;

    // Update door states
    this.updateLocationState(gameId, doorId1, 0, state => {
      state.isLinked = true;
      state.linkedToLocationId = doorId2;
    });
    
    this.updateLocationState(gameId, doorId2, 0, state => {
      state.isLinked = true;
      state.linkedToLocationId = doorId1;
    });

    gameService.saveGame(game);
  }

  unlinkDoors(gameId, doorId1, doorId2) {
    const game = gameService.getGame(gameId);
    if (!game) return;

    // Remove bidirectional links
    delete game.doorConnections[`door_${doorId1}`];
    delete game.doorConnections[`door_${doorId2}`];

    // Update door states to unlinked
    this.updateLocationState(gameId, doorId1, 0, state => {
      state.isLinked = false;
      state.linkedToLocationId = null;
    });
    
    this.updateLocationState(gameId, doorId2, 0, state => {
      state.isLinked = false;
      state.linkedToLocationId = null;
    });

    gameService.saveGame(game);
  }

  getLinkedDoor(gameId, doorId) {
    const game = gameService.getGame(gameId);
    if (!game) return null;

    const linkedKey = game.doorConnections[`door_${doorId}`];
    if (linkedKey && linkedKey.startsWith('door_')) {
      return parseInt(linkedKey.substring(5));
    }
    return null;
  }

  toggleChestBox(gameId, locationId, floorId, type) {
    this.updateLocationState(gameId, locationId, floorId, state => {
      state.type = type;
      state.isOpened = !state.isOpened;
    });
  }

  visitBattleground(gameId, locationId, floorId) {
    this.updateLocationState(gameId, locationId, floorId, state => {
      state.type = 'battleground';
      state.isVisited = true;
    });
  }

  markLocationAsDisabled(gameId, locationId, floorId) {
    this.updateLocationState(gameId, locationId, floorId, state => {
      state.isDisabled = !state.isDisabled;
    });
  }

  getLocationState(gameId, locationId) {
    const game = gameService.getGame(gameId);
    return game?.locationStates[locationId] || null;
  }
}

export const locationTrackerService = new LocationTrackerService();