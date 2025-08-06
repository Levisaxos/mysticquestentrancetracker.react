// Game Management Service
class GameService {
  constructor() {
    this.GAMES_KEY = 'mystic_quest_games';
    this.CURRENT_GAME_KEY = 'current_game_id';
  }

  getAllGames() {
    const gamesJson = localStorage.getItem(this.GAMES_KEY);
    return gamesJson ? JSON.parse(gamesJson) : [];
  }

  getActiveGames() {
    return this.getAllGames().filter(game => !game.isFinished);
  }

  getFinishedGames() {
    return this.getAllGames().filter(game => game.isFinished);
  }

  createGame(name) {
    const games = this.getAllGames();
    const newId = games.length > 0 ? Math.max(...games.map(g => g.id)) + 1 : 1;
    
    const newGame = {
      id: newId,
      name: name,
      startDate: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
      finishedDate: null,
      isFinished: false,
      locationStates: {},
      doorConnections: {}
    };
    
    games.push(newGame);
    this.saveGames(games);
    return newGame;
  }

  getGame(gameId) {
    const games = this.getAllGames();
    return games.find(g => g.id === gameId);
  }

  saveGame(game) {
    const games = this.getAllGames();
    const index = games.findIndex(g => g.id === game.id);
    
    if (!game.isFinished) {
      game.lastPlayed = new Date().toISOString();
    }
    
    if (index >= 0) {
      games[index] = game;
    } else {
      games.push(game);
    }
    
    this.saveGames(games);
  }

  finishGame(gameId) {
    const game = this.getGame(gameId);
    if (game && !game.isFinished) {
      game.isFinished = true;
      game.finishedDate = new Date().toISOString();
      this.saveGame(game);
      
      // Clear current game if it was finished
      if (this.getCurrentGameId() === gameId) {
        localStorage.removeItem(this.CURRENT_GAME_KEY);
      }
      
      return game;
    }
    return null;
  }

  unfinishGame(gameId) {
    const game = this.getGame(gameId);
    if (game && game.isFinished) {
      game.isFinished = false;
      game.finishedDate = null;
      game.lastPlayed = new Date().toISOString();
      this.saveGame(game);
      return game;
    }
    return null;
  }

  deleteGame(gameId) {
    const games = this.getAllGames();
    const filteredGames = games.filter(g => g.id !== gameId);
    this.saveGames(filteredGames);
    
    if (this.getCurrentGameId() === gameId) {
      localStorage.removeItem(this.CURRENT_GAME_KEY);
    }
  }

  setCurrentGame(gameId) {
    if (gameId) {
      localStorage.setItem(this.CURRENT_GAME_KEY, gameId.toString());
    } else {
      localStorage.removeItem(this.CURRENT_GAME_KEY);
    }
  }

  getCurrentGameId() {
    const id = localStorage.getItem(this.CURRENT_GAME_KEY);
    return id ? parseInt(id) : null;
  }

  getCurrentGame() {
    const id = this.getCurrentGameId();
    return id ? this.getGame(id) : null;
  }

  exportGameData(gameId) {
    const game = this.getGame(gameId);
    return game ? JSON.stringify(game, null, 2) : '{}';
  }

  importGameData(jsonData) {
    try {
      const game = JSON.parse(jsonData);
      const games = this.getAllGames();
      game.id = games.length > 0 ? Math.max(...games.map(g => g.id)) + 1 : 1;
      this.saveGame(game);
      return game;
    } catch (error) {
      console.error('Import failed:', error);
      return null;
    }
  }

  saveGames(games) {
    localStorage.setItem(this.GAMES_KEY, JSON.stringify(games));
  }
}

export const gameService = new GameService();