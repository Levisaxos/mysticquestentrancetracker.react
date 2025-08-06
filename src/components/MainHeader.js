import React from 'react';
import { gameService } from '../services/gameService';

const MainHeader = ({ currentMode, onModeChange, currentGame, onImportExport }) => {
  const handleExport = () => {
    // Export all data from localStorage
    const allGames = gameService.getAllGames();
    const currentGameId = gameService.getCurrentGameId();
    
    const exportData = {
      games: allGames,
      currentGameId: currentGameId,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mystic_quest_tracker_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedData = JSON.parse(event.target.result);
            
            // Check if it's the new full export format
            if (importedData.games && Array.isArray(importedData.games)) {
              // Import all games
              const games = gameService.getAllGames();
              let importCount = 0;
              
              importedData.games.forEach(gameData => {
                // Assign new ID to avoid conflicts
                const newId = games.length > 0 ? Math.max(...games.map(g => g.id)) + importCount + 1 : importCount + 1;
                gameData.id = newId;
                gameService.saveGame(gameData);
                importCount++;
              });
              
              alert(`Successfully imported ${importCount} games!`);
              if (onImportExport) onImportExport();
            } else {
              // Legacy single game import
              const importedGame = gameService.importGameData(event.target.result);
              if (importedGame) {
                alert(`Game "${importedGame.name}" imported successfully!`);
                if (onImportExport) onImportExport();
              } else {
                alert('Failed to import game. Please check the file format.');
              }
            }
          } catch (error) {
            alert('Failed to import data. Please check the file format.');
            console.error('Import error:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <header className="bg-slate-800 border-b border-slate-600 shadow-lg">
      <div className="px-6 py-3 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Back to Games Button - Only show when not in games mode */}
          {currentMode !== 'games' && (
            <button
              onClick={() => onModeChange('games')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            >
              <span>←</span>
              Back to Games
            </button>
          )}

          {/* Project Title */}
          <h1 className="text-xl font-semibold text-white">
            Mystic Quest Tracker
          </h1>

          {/* Current Game Badge */}
          {currentGame && (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded">
                {currentGame.name}
              </div>
              <div className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded">
                Active
              </div>
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Map Editor Button */}
          <button
            onClick={() => onModeChange('editor')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              currentMode === 'editor'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
            }`}
          >
            Map Editor
          </button>

          {/* Export Button - Always visible */}
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors flex items-center gap-1"
            title="Export all tracker data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17,8 12,3 7,8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Export
          </button>

          {/* Import Button */}
          <button
            onClick={handleImport}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors flex items-center gap-1"
            title="Import tracker data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7,10 12,15 17,10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Import
          </button>

          {/* Last Expected indicator - placeholder for future use */}
          <div className="text-xs text-slate-400 ml-2">
            Last updated: Never
          </div>
        </div>
      </div>
    </header>
  );
};

export default MainHeader;