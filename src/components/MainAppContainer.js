import React, { useState, useEffect } from 'react';
import MainHeader from './MainHeader';
import GameList from './GameList';
import { MapViewerContainer } from './MapViewerContainer';
import GameTracker from './GameTracker';
import { gameService } from '../services/gameService';

const MainAppContainer = () => {
  const [currentMode, setCurrentMode] = useState('games');
  const [currentGame, setCurrentGame] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Load current game on startup
    const game = gameService.getCurrentGame();
    if (game) {
      setCurrentGame(game);
      setCurrentMode('tracker'); // If we have a current game, show tracker
    }
  }, [refreshTrigger]);

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

  const renderCurrentMode = () => {
    switch (currentMode) {
      case 'games':
        return (
          <GameList
            onGameSelected={handleGameSelected}
            refreshTrigger={refreshTrigger}
          />
        );
      
      case 'editor':
        return <MapViewerContainer />;
      
      case 'tracker':
        if (currentGame) {
          return (
            <GameTracker
              game={currentGame}
              onCloseGame={handleGameClosed}
            />
          );
        }
        // If no game selected, redirect to games list
        setCurrentMode('games');
        return null;
      
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
        currentMode={currentMode}
        onModeChange={handleModeChange}
        currentGame={currentGame}
        onImportExport={handleImportExport}
      />
      
      {renderCurrentMode()}
    </div>
  );
};

export default MainAppContainer;