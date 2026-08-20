import React, { useState, useEffect } from 'react';
import GameCard from './GameCard';
import CreateGameModal from './CreateGameModal';
import { gameService } from '../services/gameService';

const GameList = ({ onGameSelected, refreshTrigger }) => {
  const [games, setGames] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'finished'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, [refreshTrigger]);

  const loadGames = () => {
    try {
      const allGames = gameService.getAllGames();
      setGames(allGames);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async (gameName) => {
    const newGame = gameService.createGame(gameName);
    setGames(prev => [...prev, newGame]);
  };

  const handleDeleteGame = (gameId, event) => {
    event.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
      return;
    }
    
    gameService.deleteGame(gameId);
    setGames(prev => prev.filter(g => g.id !== gameId));
  };

  const handleFinishGame = (gameId, event) => {
    event.stopPropagation();
    
    if (window.confirm('Mark this game as finished? You can still view and edit it later.')) {
      gameService.finishGame(gameId);
      setGames(prev => prev.map(g => 
        g.id === gameId ? { ...g, isFinished: true, finishedDate: new Date().toISOString() } : g
      ));
    }
  };

  const handleUnfinishGame = (gameId, event) => {
    event.stopPropagation();
    
    gameService.unfinishGame(gameId);
    setGames(prev => prev.map(g => 
      g.id === gameId ? { ...g, isFinished: false, finishedDate: null, lastPlayed: new Date().toISOString() } : g
    ));
  };

  const handleSelectGame = (game) => {
    if (!game.isFinished) {
      gameService.setCurrentGame(game.id);
      onGameSelected(game);
    }
  };

  const getFilteredGames = () => {
    return activeTab === 'active' 
      ? games.filter(g => !g.isFinished)
      : games.filter(g => g.isFinished);
  };

  const activeGames = games.filter(g => !g.isFinished);
  const finishedGames = games.filter(g => g.isFinished);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
          <p className="text-slate-400">Loading games...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-900">
      <div className="w-full p-6">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          {/* Left side - Games Tabs */}
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-slate-200">Your Games</h2>
            <div className="flex">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-4 py-2 rounded-l font-medium transition-colors ${
                  activeTab === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Active ({activeGames.length})
              </button>
              <button
                onClick={() => setActiveTab('finished')}
                className={`px-4 py-2 rounded-r font-medium transition-colors ${
                  activeTab === 'finished'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Finished ({finishedGames.length})
              </button>
            </div>
          </div>

          {/* Right side - New Game Button */}
          {activeTab === 'active' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
            >
              + New Game
            </button>
          )}
        </div>

        {/* Empty State */}
        {getFilteredGames().length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 text-slate-600">🎮</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              {activeTab === 'active' ? 'No active games' : 'No finished games'}
            </h3>
            <p className="text-slate-400 mb-6">
              {activeTab === 'active' 
                ? 'Create your first game to start tracking your adventure'
                : 'Complete some games to see them here'
              }
            </p>
            {activeTab === 'active' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                + New Game
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredGames().map(game => (
              <GameCard
                key={game.id}
                game={game}
                onSelect={handleSelectGame}
                onDelete={handleDeleteGame}
                onFinish={handleFinishGame}
                onUnfinish={handleUnfinishGame}
                isFinished={game.isFinished}
              />
            ))}
          </div>
        )}

        {/* Floating Create Button */}
        {activeTab === 'active' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl font-bold transition-colors"
            title="Create New Game"
          >
            +
          </button>
        )}

        {/* Create Game Modal */}
        <CreateGameModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateGame={handleCreateGame}
        />
      </div>
    </div>
  );
};

export default GameList;