import React, { useState, useEffect } from 'react';
import MainHeader from './MainHeader';
import GameList from './GameList';
import GameTracker from './GameTracker';
import { gameService } from '../services/gameService';

const MainAppContainer = () => {
  const [currentMode, setCurrentMode] = useState('games');
  const [currentGame, setCurrentGame] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Resume the run in progress — on mount only. This used to re-run whenever
  // refreshTrigger changed, which meant importing a file yanked you out of the
  // games list and into the tracker.
  useEffect(() => {
    const game = gameService.getCurrentGame();
    if (game) {
      setCurrentGame(game);
      setCurrentMode('tracker');
    }
  }, []);

  const handleModeChange = (mode) => {
    setCurrentMode(mode);
  };

  const handleGameSelected = (game) => {
    setCurrentGame(game);
    setCurrentMode('tracker');
  };

  const handleGameClosed = () => {
    setCurrentGame(null);
    setCurrentMode('games');
    // Clear current game from storage
    gameService.setCurrentGame(null);
  };

  const handleImportExport = () => {
    // Trigger refresh to reload games list
    setRefreshTrigger(prev => prev + 1);
  };

  // Tracker mode without a loaded run is not a valid state; fall back rather
  // than calling setState during render, which React warns about and which
  // double-renders under StrictMode.
  const mode = currentMode === 'tracker' && !currentGame ? 'games' : currentMode;

  const renderCurrentMode = () => {
    switch (mode) {
      case 'games':
        return (
          <GameList
            onGameSelected={handleGameSelected}
            refreshTrigger={refreshTrigger}
          />
        );
      
      case 'tracker':
        return (
          <GameTracker
            game={currentGame}
            onCloseGame={handleGameClosed}
          />
        );
      
      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-slate-900">
            <p className="text-slate-400">Unknown mode</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col">
      <MainHeader
        currentMode={mode}
        onModeChange={handleModeChange}
        currentGame={currentGame}
        onImportExport={handleImportExport}
      />
      
      {renderCurrentMode()}
    </div>
  );
};

export default MainAppContainer;