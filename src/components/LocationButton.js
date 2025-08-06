import React from 'react';
import { SPRITE_PATHS } from '../constants/spritePaths';
import { ITEM_PATHS } from '../constants/itemPaths';

const LocationButton = ({ 
  location, 
  onClick, 
  onRightClick, 
  imageDimensions, 
  isReadOnly = false 
}) => {
  if (!imageDimensions || !location) return null;

  // Calculate position based on actual rendered image dimensions
  const scaleX = imageDimensions.width / imageDimensions.naturalWidth;
  const scaleY = imageDimensions.height / imageDimensions.naturalHeight;
  
  const scaledX = location.x * scaleX;
  const scaledY = location.y * scaleY;

  const getLocationDisplay = () => {
    switch (location.type) {
      case 'door':
      case 'entrance':
        return {
          text: 'D',
          color: 'bg-blue-600 hover:bg-blue-500',
          size: 'w-6 h-6 text-xs',
          isText: true
        };
      case 'battleground':
        // Extract number from "Battleground #X" name
        const battlegroundMatch = location.name.match(/Battleground #(\d+)/);
        const battlegroundNumber = battlegroundMatch ? battlegroundMatch[1] : '?';
        return {
          text: battlegroundNumber,
          color: 'bg-green-600 hover:bg-green-500',
          size: 'w-6 h-6 text-xs',
          isText: true
        };
      case 'chest':
        // Extract number from "Chest #X" name, fallback to chest icon
        const chestMatch = location.name.match(/Chest #(\d+)/);
        if (chestMatch) {
          return {
            text: chestMatch[1],
            color: 'bg-yellow-600 hover:bg-yellow-500',
            size: 'w-6 h-6 text-xs',
            isText: true
          };
        }
        return {
          imagePath: SPRITE_PATHS.CONTAINERS.CHEST_CLOSED,
          color: 'bg-transparent hover:bg-gray-200',
          size: 'w-6 h-6',
          isText: false
        };
      case 'box':
        // Extract number from "Box #X" name, fallback to box icon
        const boxMatch = location.name.match(/Box #(\d+)/);
        if (boxMatch) {
          return {
            text: boxMatch[1],
            color: 'bg-orange-600 hover:bg-orange-500',
            size: 'w-6 h-6 text-xs',
            isText: true
          };
        }
        return {
          imagePath: SPRITE_PATHS.CONTAINERS.BOX_CLOSED,
          color: 'bg-transparent hover:bg-gray-200',
          size: 'w-6 h-6',
          isText: false
        };
      case 'item':
        // Get the item image path based on location.itemPath
        return {
          imagePath: location.itemPath || ITEM_PATHS.KEY_ITEMS.MULTI_KEY, // Default fallback
          color: 'bg-transparent hover:bg-gray-200',
          size: 'w-6 h-6',
          isText: false
        };
      default:
        return {
          text: '?',
          color: 'bg-gray-600 hover:bg-gray-500',
          size: 'w-6 h-6 text-xs',
          isText: true
        };
    }
  };

  const display = getLocationDisplay();

  return (
    <div 
      className="absolute" 
      style={{
        left: `${scaledX}px`,
        top: `${scaledY}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <button
        onMouseUp={(e) => {
          e.stopPropagation();
          
          if (e.button === 0 && onClick) { // Left click
            onClick(location);
          } else if (e.button === 2 && onRightClick) { // Right click
            onRightClick(location);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`border-2 border-gray-400 rounded flex items-center justify-center font-bold transition-colors ${
          display.color
        } ${display.size} ${display.isText ? 'text-white' : ''} ${
          !isReadOnly ? 'cursor-pointer hover:border-white' : 'cursor-default'
        }`}
        style={{
          zIndex: 10,
          pointerEvents: 'auto'
        }}
        title={location.name}
      >
        {display.isText ? (
          display.text
        ) : (
          <img 
            src={display.imagePath} 
            alt={location.type}
            className="w-full h-full object-contain"
          />
        )}
      </button>
    </div>
  );
};

export default LocationButton;