import React, { useState, useEffect, useRef } from 'react';
import { ITEM_PATHS } from '../constants/itemPaths';

const LocationModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  position, 
  existingLocation = null 
}) => {
  const [locationType, setLocationType] = useState(existingLocation?.type || position?.type || 'door');
  const [locationName, setLocationName] = useState(existingLocation?.name || '');
  const [selectedItem, setSelectedItem] = useState(existingLocation?.itemPath || '');
  const nameInputRef = useRef(null);

  // Update state when existingLocation or position changes
  useEffect(() => {
    if (existingLocation) {
      setLocationType(existingLocation.type || 'door');
      setLocationName(existingLocation.name || '');
      setSelectedItem(existingLocation.itemPath || '');
    } else {
      setLocationType(position?.type || 'door');
      setLocationName('');
      setSelectedItem('');
    }
  }, [existingLocation, position]);

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const locationData = {
      id: existingLocation?.id, // Keep existing ID for edits, let container assign for new
      name: locationName || getDefaultName(),
      type: locationType,
      x: position.x,
      y: position.y,
      ...(locationType === 'item' && { itemPath: selectedItem })
    };

    onSave(locationData);
    onClose();
  };

  const handleDelete = () => {
    if (existingLocation && onDelete) {
      onDelete(existingLocation);
      onClose();
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (locationType !== 'item' || selectedItem) {
        handleSave();
      }
    }
    if (event.key === 'Escape') {
      onClose();
    }
  };

  const getDefaultName = () => {
    switch (locationType) {
      case 'door': return 'Door';
      case 'battleground': return `Battleground #1`;
      case 'chest': return 'Treasure Chest';
      case 'box': return 'Storage Box';
      case 'item': return 'Item';
      default: return 'Location';
    }
  };

  const getAllItemPaths = () => {
    const allItems = [];
    Object.entries(ITEM_PATHS).forEach(([category, items]) => {
      Object.entries(items).forEach(([itemName, path]) => {
        allItems.push({
          category,
          name: itemName.replace(/_/g, ' '),
          path
        });
      });
    });
    return allItems;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-96 max-w-full mx-4 border border-slate-600">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">
          {existingLocation ? 'Edit Location' : 'Add Location'}
        </h2>
        
        <div className="space-y-4">
          {/* Location Type */}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Location Type:
            </label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 border border-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-20 focus:outline-none"
            >
              <option value="door">Door/Entrance</option>
              <option value="battleground">Battleground</option>
              <option value="chest">Chest</option>
              <option value="box">Box</option>
              <option value="item">Item</option>
            </select>
          </div>

          {/* Location Name */}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Name:
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={getDefaultName()}
              className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 border border-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-20 focus:outline-none"
            />
          </div>

          {/* Item Selection (only for item type) */}
          {locationType === 'item' && (
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Item:
              </label>
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 border border-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-20 focus:outline-none"
              >
                <option value="">Select an item...</option>
                {getAllItemPaths().map((item, index) => (
                  <option key={index} value={item.path}>
                    {item.category} - {item.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Position Info */}
          <div className="text-sm text-slate-400">
            Position: ({Math.round(position.x)}, {Math.round(position.y)})
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-between items-center mt-6">
          {/* Left side - Delete button (only for existing locations) */}
          <div>
            {existingLocation && (
              <button
                onClick={handleDelete}
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors text-sm"
              >
                Delete
              </button>
            )}
          </div>
          
          {/* Right side - Update/Add and Cancel buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-600 text-white rounded hover:bg-slate-500 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={locationType === 'item' && !selectedItem}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {existingLocation ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationModal;