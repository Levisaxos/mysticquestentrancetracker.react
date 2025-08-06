import React from 'react';

const GameCard = ({ game, onSelect, onDelete, onFinish, onUnfinish, isFinished }) => {
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getLocationStats = () => {
    const states = Object.values(game.locationStates || {});
    return {
      chests: states.filter(s => s.type === 'chest' && s.isOpened).length,
      boxes: states.filter(s => s.type === 'box' && s.isOpened).length,
      doors: states.filter(s => s.isLinked).length
    };
  };

  const stats = getLocationStats();

  const getGameType = () => {
    // You can add logic here to determine game type based on game state
    // For now, we'll use a simple random assignment or default
    return isFinished ? 'Finished' : 'Standard';
  };

  const getWorldType = () => {
    // You can add logic here to determine world type
    // For now, we'll use a default
    return 'Normal';
  };

  return (
    <div
      className={`bg-slate-800 border border-slate-600 rounded-lg p-4 transition-all duration-200 ${
        isFinished 
          ? 'cursor-default opacity-75' 
          : 'cursor-pointer hover:border-blue-400 hover:shadow-lg'
      }`}
      onClick={() => !isFinished && onSelect(game)}
    >
      {/* Header with Title and Action Buttons */}
      <div className="flex justify-between items-start mb-3">
        <h3 className={`text-xl font-semibold ${
          isFinished 
            ? 'text-slate-300' 
            : 'text-slate-100'
        }`}>
          {game.name}
        </h3>
        
        <div className="flex items-center gap-2">
          {/* Archive/Unarchive Button (small icon) */}
          {!isFinished ? (
            <button
              onClick={(e) => onFinish(game.id, e)}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-green-400 transition-colors rounded hover:bg-slate-700"
              title="Archive game"
            >
              📁
            </button>
          ) : (
            <button
              onClick={(e) => onUnfinish(game.id, e)}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-400 transition-colors rounded hover:bg-slate-700"
              title="Unarchive game"
            >
              📂
            </button>
          )}
          
          {/* Delete Button */}
          <button
            onClick={(e) => onDelete(game.id, e)}
            className="px-2 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
            title="Delete game"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6 mb-4">
        {/* Left Column - Game Details */}
        <div className="flex-1">
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Type:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                isFinished 
                  ? 'bg-green-600 text-white' 
                  : 'bg-slate-600 text-slate-200'
              }`}>
                {getGameType()}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-slate-400">World:</span>
              <span className="text-purple-400">{getWorldType()}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Created:</span>
              <span className="text-slate-300">{formatDate(game.startDate)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-slate-400">
                {isFinished ? 'Finished:' : 'Last Saved:'}
              </span>
              <span className={isFinished ? 'text-green-400' : 'text-green-400'}>
                {formatDate(isFinished ? game.finishedDate : game.lastPlayed)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column - Stats */}
        <div className="w-48">
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-slate-700 rounded py-2">
              <div className="text-blue-400 font-bold text-lg">{stats.doors}</div>
              <div className="text-slate-400">Doors Linked</div>
            </div>
            <div className="bg-slate-700 rounded py-2">
              <div className="text-amber-400 font-bold text-lg">{stats.chests}</div>
              <div className="text-slate-400">Chests Opened</div>
            </div>
            <div className="bg-slate-700 rounded py-2">
              <div className="text-orange-400 font-bold text-lg">{stats.boxes}</div>
              <div className="text-slate-400">Boxes Opened</div>
            </div>
          </div>
        </div>
      </div>

      {/* Load Game Button - Full Width */}
      {!isFinished && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(game);
          }}
          className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition-colors"
        >
          Load Game
        </button>
      )}
    </div>
  );
};

export default GameCard;