import React from 'react';
import { SPRITE_PATHS } from '../constants/spritePaths';
import { locationTrackerService } from '../services/locationTrackerService';

const TrackerLocationButton = ({ 
  location, 
  gameId,
  imageDimensions,
  locationState,
  connectingMode, // This will always be false now
  connectingDoorId, // New prop to track which door is selected for connection
  highlightedDoorId, // New prop to highlight the door we just navigated to
  editMode, // New prop for edit mode
  onLocationClick,
  onLocationRightClick
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
      case 'battleground':
        // Check if this location is disabled (right-clicked)
        if (locationState?.isDisabled) {
          return {
            text: '', // No text for disabled doors/battlegrounds
            color: 'bg-red-800 hover:bg-red-700',
            size: 'w-4 h-4 text-xs',
            isText: true
          };
        }
        
        // Check if this door/battleground is highlighted (just navigated to)
        if (highlightedDoorId === location.id) {
          return {
            text: '', // No text for highlighted doors/battlegrounds
            color: 'bg-purple-600 hover:bg-purple-500',
            size: 'w-6 h-6 text-xs',
            isText: true
          };
        }
        
        // Check if this door/battleground is connected to another location
        const linkedLocationId = locationTrackerService.getLinkedDoor(gameId, location.id);
        if (linkedLocationId) {
          // Check if it's self-linked (standalone battleground case)
          if (linkedLocationId === location.id) {
            // Self-linked - show as green battleground with number
            if (location.type === 'battleground') {
              const battlegroundMatch = location.name.match(/Battleground #(\d+)/);
              const battlegroundNumber = battlegroundMatch ? battlegroundMatch[1] : '?';
              return {
                text: battlegroundNumber,
                color: 'bg-green-600 hover:bg-green-500',
                size: 'w-6 h-6 text-xs',
                isText: true
              };
            } else {
              // Self-linked door becomes a battleground
              return {
                text: 'B',
                color: 'bg-green-600 hover:bg-green-500',
                size: 'w-6 h-6 text-xs',
                isText: true
              };
            }
          } else {
            // Linked to another location - show as yellow door (regardless of original type)
            return {
              text: '', // No text for connected doors/battlegrounds
              color: 'bg-yellow-600 hover:bg-yellow-500',
              size: 'w-6 h-6 text-xs',
              isText: true
            };
          }
        }
        
        // Check if this door/battleground is currently selected for connection
        if (connectingDoorId === location.id) {
          return {
            text: '?',
            color: 'bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-400',
            size: 'w-6 h-6 text-xs',
            isText: true
          };
        }
        
        // Default state - both doors and battlegrounds show as gray ? when unlinked
        return {
          text: '?',
          color: 'bg-gray-600 hover:bg-gray-500',
          size: 'w-6 h-6 text-xs',
          isText: true
        };
        
      case 'chest':
        const chestImage = locationState?.isOpened 
          ? SPRITE_PATHS.CONTAINERS.CHEST_OPENED 
          : SPRITE_PATHS.CONTAINERS.CHEST_CLOSED;
        return {
          imagePath: chestImage,
          color: locationState?.isOpened 
            ? 'bg-transparent hover:bg-slate-700/30' 
            : 'bg-amber-500/50 hover:bg-amber-400/60',
          size: 'w-8 h-8',
          imageSize: 'w-5 h-5',
          isText: false,
          noBorder: true,
          isRound: true
        };
        
      case 'box':
        const boxImage = locationState?.isOpened 
          ? SPRITE_PATHS.CONTAINERS.BOX_OPENED 
          : SPRITE_PATHS.CONTAINERS.BOX_CLOSED;
        return {
          imagePath: boxImage,
          color: locationState?.isOpened 
            ? 'bg-transparent hover:bg-slate-700/30' 
            : 'bg-orange-500/50 hover:bg-orange-400/60',
          size: 'w-8 h-8',
          imageSize: 'w-5 h-5',
          isText: false,
          noBorder: true,
          isRound: true
        };
        
      default:
        return {
          text: '?',
          color: 'bg-slate-600 hover:bg-slate-500',
          size: 'w-6 h-6 text-xs',
          isText: true
        };
    }
  };

  const display = getLocationDisplay();

  // Get interaction cursor based on location type
  const getCursor = () => {
    if (locationState?.isDisabled) {
      return 'cursor-not-allowed';
    }
    
    switch (location.type) {
      case 'door':
      case 'battleground':
        return 'cursor-pointer';
      case 'chest':
      case 'box':
        return 'cursor-context-menu';
      default:
        return 'cursor-default';
    }
  };

  // Get tooltip text
  const getTooltipText = () => {
    let tooltip = location.name;
    
    if (locationState?.isDisabled) {
      tooltip += editMode ? ' (disabled - click to reset)' : ' (disabled)';
      return tooltip;
    }
    
    if (highlightedDoorId === location.id) {
      tooltip += ' ⭐ (linked location - just navigated here)';
      return tooltip;
    }
    
    if (location.type === 'door' || location.type === 'battleground') {
      const linkedLocationId = locationTrackerService.getLinkedDoor(gameId, location.id);
      if (linkedLocationId) {
        tooltip += editMode 
          ? ` (linked to location ${linkedLocationId} - click to disconnect)` 
          : ` (linked to location ${linkedLocationId})`;
      } else if (connectingDoorId === location.id) {
        tooltip += ' (selected - click another door/battleground to connect)';
      } else if (connectingDoorId) {
        tooltip += ' (click to connect)';
      } else {
        tooltip += ' (click to select for connection)';
      }
      
      if (!editMode) {
        tooltip += ' - Right click to disable';
      }
    }
    
    if ((location.type === 'chest' || location.type === 'box') && locationState?.isOpened) {
      tooltip += ' (opened)';
    }
    
    // Add interaction hints
    if (location.type === 'chest' || location.type === 'box') {
      tooltip += ' - Right click to open/close';
    }
    
    return tooltip;
  };

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
          
          if (e.button === 0 && onLocationClick) { // Left click
            onLocationClick(location);
          } else if (e.button === 2 && onLocationRightClick) { // Right click
            onLocationRightClick(location);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`${display.noBorder ? '' : 'border-2 border-slate-400'} ${display.isRound ? 'rounded-full' : 'rounded'} flex items-center justify-center font-bold transition-all duration-200 ${
          display.color
        } ${display.size} ${display.isText ? 'text-white' : ''} ${getCursor()} ${
          display.noBorder ? '' : 'hover:border-white'
        }`}
        style={{
          zIndex: 10,
          pointerEvents: 'auto'
        }}
        title={getTooltipText()}
      >
        {display.isText ? (
          display.text
        ) : (
          <img 
            src={display.imagePath} 
            alt={location.type}
            className={`${display.imageSize || 'w-full h-full'} object-contain`}
          />
        )}
      </button>
    </div>
  );
};

export default TrackerLocationButton;