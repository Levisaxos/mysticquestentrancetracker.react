import React, { useState, useRef, useEffect } from 'react';

const CreateGameModal = ({ isOpen, onClose, onCreateGame }) => {
  const [gameName, setGameName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gameName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await onCreateGame(gameName.trim());
      setGameName('');
      onClose();
    } catch (error) {
      console.error('Failed to create game:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-96 max-w-full mx-4 border border-slate-600">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">
          Create New Game
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Game Name:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter game name (e.g., My First Run)"
              className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 border border-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-20 focus:outline-none"
              disabled={isCreating}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500 transition-colors disabled:opacity-50"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!gameName.trim() || isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGameModal;