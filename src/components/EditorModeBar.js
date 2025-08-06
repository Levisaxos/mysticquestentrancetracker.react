import React from 'react';

const EditorModeBar = ({ 
  currentMode, 
  onModeChange, 
  isEditMode,
  onToggleEditMode,
  locationStats,
  onExportLocations,
  connectingDoor
}) => {
  const modes = [
    { id: 'view', name: 'View Mode', color: 'bg-slate-600' },
    { id: 'place', name: 'Place Doors', color: 'bg-green-600' },
    { id: 'containers', name: 'Add Chests/Boxes', color: 'bg-amber-600' },
    { id: 'edit', name: 'Edit Locations', color: 'bg-yellow-500' },
    { id: 'connect', name: 'Connect Doors', color: 'bg-blue-600' }
  ];

  return (
    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Mode Buttons */}
        <div className="flex gap-2">
          {modes.map(mode => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                currentMode === mode.id 
                  ? `${mode.color} text-white` 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {mode.name}
            </button>
          ))}
        </div>

        {/* Stats and Info */}
        <div className="flex items-center gap-4 text-sm text-slate-300">
          {locationStats && (
            <div className="flex gap-4">
              <span>Doors: {locationStats.doors || 0}</span>
              <span>Battlegrounds: {locationStats.battlegrounds || 0}</span>
              <span>Chests: {locationStats.chests || 0}</span>
              <span>Boxes: {locationStats.boxes || 0}</span>
              <span>Items: {locationStats.items || 0}</span>
            </div>
          )}
          
          {/* Export Button */}
          <button
            onClick={onExportLocations}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium transition-colors"
          >
            Export Locations
          </button>
        </div>
      </div>

      {/* Mode-specific legends */}
      {currentMode !== 'view' && (
        <div className="mt-3 p-3 bg-slate-700 rounded text-sm">
          {currentMode === 'place' && (
            <div className="text-green-400 font-medium">
              Left: Door | Right: Battleground
            </div>
          )}
          
          {currentMode === 'containers' && (
            <div className="text-amber-400 font-medium">
              Left: Auto-Chest | Right: Auto-Box
            </div>
          )}
          
          {currentMode === 'edit' && (
            <div className="text-yellow-400 font-medium">
              Left-click locations to edit/delete
            </div>
          )}
          
          {currentMode === 'connect' && (
            <div className="text-blue-400 font-medium">
              {connectingDoor 
                ? `Linking "${connectingDoor.name}" to (select door) | Right-click to cancel`
                : 'Click doors to connect them'
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorModeBar;