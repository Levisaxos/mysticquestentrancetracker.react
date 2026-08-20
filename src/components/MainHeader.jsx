import React from 'react';
import { gameService } from '../services/gameService';
import { migrate, isReadableSave, CURRENT_VERSION } from '../services/saveMigration';

const MainHeader = ({ currentMode, onModeChange, currentGame, onImportExport }) => {
  const handleExport = () => {
    // Export all data from localStorage
    const allGames = gameService.getAllGames();
    const currentGameId = gameService.getCurrentGameId();
    
    const exportData = {
      games: allGames,
      currentGameId: currentGameId,
      exportDate: new Date().toISOString(),
      version: CURRENT_VERSION
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
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);

          if (!isReadableSave(parsed)) {
            alert('That file does not look like a tracker export.');
            return;
          }

          // Run it through the same migration as stored saves, so importing an
          // old export repairs it exactly like loading one would.
          const { games } = migrate(parsed);
          if (!games.length) {
            alert('That export contains no runs.');
            return;
          }

          const existing = gameService.getAllGames().length;
          const confirmed = window.confirm(
            `Import ${games.length} run${games.length === 1 ? '' : 's'}?

` +
            `They will be added alongside your ${existing} existing ` +
            `run${existing === 1 ? '' : 's'}. Nothing is overwritten.`
          );
          if (!confirmed) return;

          const count = gameService.importGames(games);
          alert(`Imported ${count} run${count === 1 ? '' : 's'}.`);
          if (onImportExport) onImportExport();
        } catch (error) {
          alert('Failed to read that file. Is it a valid tracker export?');
          console.error('Import error:', error);
        }
      };

      reader.readAsText(file);
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


        </div>
      </div>
    </header>
  );
};

export default MainHeader;