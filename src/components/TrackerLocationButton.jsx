import React, { useState } from 'react';
import { SPRITE_PATHS } from '../constants/spritePaths';
import { locationTrackerService } from '../services/locationTrackerService';
import { assetUrl } from '../utils/assetUrl';
import { STATE_STYLES } from '../engine/markerStatus';
import { describeMarkerLocation } from '../constants/markerLookup';

const TrackerLocationButton = ({ 
  location, 
  gameId,
  imageDimensions,
  locationState,
  connectingDoorId, // New prop to track which door is selected for connection
  highlightedDoorId, // New prop to highlight the door we just navigated to
  editMode, // New prop for edit mode
  status, // { state, reason } from the logic engine, if this marker is bound
  linkIgnored, // linked by the player, but not mapped to canonical logic yet
  onLocationClick,
  onLocationRightClick
}) => {
  // Hooks must run on every render, so this sits above the early return below.
  // It used to sit further down, which meant the hook count changed once the
  // image had been measured — and the hover state silently never stuck.
  const [hovered, setHovered] = useState(false);

  if (!imageDimensions || !location) return null;

  // Calculate position based on actual rendered image dimensions
  const scaleX = imageDimensions.width / imageDimensions.naturalWidth;
  const scaleY = imageDimensions.height / imageDimensions.naturalHeight;
  
  const scaledX = location.x * scaleX;
  const scaledY = location.y * scaleY;

  const getLocationDisplay = () => {
    switch (location.type) {
      case 'battleground': {
        // A battleground is a check: clear it once for its reward. Once cleared
        // it collapses to the same small red marker a disabled door gets, so
        // "dealt with, stop looking at me" reads the same way everywhere.
        if (locationState?.isOpened) {
          return {
            text: '',
            color: 'bg-red-800 hover:bg-red-700',
            size: 'w-4 h-4 text-xs',
            isText: true,
          };
        }

        const match = location.name.match(/Battleground #(\d+)/);
        return {
          text: match ? match[1] : 'B',
          color: 'bg-purple-600 hover:bg-purple-500',
          size: 'w-6 h-6 text-xs',
          isText: true,
        };
      }

      case 'door':
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
        
        // Check if this door is connected to another location
        const linkedLocationId = locationTrackerService.getLinkedDoor(gameId, location.id);
        if (linkedLocationId) {
          return {
            text: '', // No text for connected doors
            color: 'bg-yellow-600 hover:bg-yellow-500',
            size: 'w-6 h-6 text-xs',
            isText: true
          };
        }

        // Check if this door is currently selected for connection
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

  // Logic colouring overrides the type colour, but only where the engine has
  // something to say. Markers the binding could not resolve keep their old
  // appearance rather than being coloured on a guess — and states the player
  // has explicitly dealt with (linked, cleared, dismissed) keep theirs too,
  // because "I handled this" outranks "you could go here".
  const logicState = status?.state;
  // Only things the player explicitly finished with outrank the logic colour.
  // A *linked* door is not one of them: once it is linked, what matters is
  // whether there is still anything worth doing behind it.
  const alreadyHandled = locationState?.isDisabled || locationState?.isOpened;

  if (logicState && logicState !== 'unknown' && !alreadyHandled) {
    const style = STATE_STYLES[logicState];
    if (style) {
      display.color = style.marker;
      display.noBorder = false;
    }
  }

  // Get interaction cursor based on location type
  const getCursor = () => {
    if (locationState?.isDisabled) {
      return 'cursor-not-allowed';
    }
    
    switch (location.type) {
      case 'door':
        return 'cursor-pointer';
      case 'battleground':
      case 'chest':
      case 'box':
        return 'cursor-context-menu';
      default:
        return 'cursor-default';
    }
  };

  // What the hover card says. Kept short and specific — the point is to answer
  // "what is this and what happens if I click it" without reading a paragraph.
  const getTooltipLines = () => {
    const lines = [];

    if (location.type === 'chest' || location.type === 'box') {
      lines.push(location.name + (locationState?.isOpened ? ' — opened' : ''));
      return lines;
    }

    if (location.type === 'battleground') {
      lines.push(location.name + (locationState?.isOpened ? ' — cleared' : ''));
      return lines;
    }

    if (location.type === 'door') {
      if (locationState?.isDisabled) {
        lines.push(`${location.name} — marked unusable`);
        return lines;
      }

      const linkedId = locationTrackerService.getLinkedDoor(gameId, location.id);
      if (linkedId) {
        lines.push(location.name);
        lines.push(linkedId === location.id
          ? 'Loops back on itself'
          : `Goes to ${describeMarkerLocation(linkedId)}`);
        if (linkIgnored === 'not-shuffled') {
          lines.push('⚠ Ignored — your Map Shuffle setting says this door is not shuffled');
        } else if (linkIgnored) {
          lines.push('⚠ Ignored — this marker is not mapped to game logic yet');
        }
        return lines;
      }

      lines.push(location.name);
      lines.push(editMode ? 'Edit mode' : 'Click to link');
      return lines;
    }

    lines.push(location.name);
    return lines;
  };

  const statusLine = () => {
    if (!status || status.state === 'unknown') return null;
    return `${STATE_STYLES[status.state]?.label ?? status.state} — ${status.reason}`;
  };

  const lines = getTooltipLines();
  const state = statusLine();

  return (
    <div
      className="absolute"
      style={{
        left: `${scaledX}px`,
        top: `${scaledY}px`,
        transform: 'translate(-50%, -50%)',
        // The transform above creates a stacking context, so a z-index on the
        // tooltip alone only competes *inside* this wrapper — sibling markers
        // later in the DOM would still paint over it. Lifting the whole wrapper
        // while hovered is what actually puts the tooltip in front.
        zIndex: hovered ? 60 : 10,
      }}
    >
      <button
        // Hover and focus live on the button rather than the wrapper: the
        // wrapper is a bare positioned div and never receives them.
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        // Primary activation is onClick, not onMouseUp, so Enter and Space work
        // and assistive tech can reach it. Right-click still needs its own
        // handler because contextmenu is the only event that carries it.
        onClick={(e) => {
          e.stopPropagation();
          if (onLocationClick) onLocationClick(location);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onLocationRightClick) onLocationRightClick(location);
        }}
        onKeyDown={(e) => {
          // Keyboard equivalent of right-click, for the toggle actions that
          // would otherwise be mouse-only.
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            if (onLocationRightClick) onLocationRightClick(location);
          }
        }}
        className={`${display.noBorder ? '' : 'border-2 border-slate-400'} ${display.isRound ? 'rounded-full' : 'rounded'} flex items-center justify-center font-bold transition-all duration-200 ${
          display.color
        } ${display.size} ${display.isText ? 'text-white' : ''} ${getCursor()} ${
          display.noBorder ? '' : 'hover:border-white'
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900`}
        style={{ pointerEvents: 'auto' }}
        aria-label={lines.join('. ')}
      >
        {display.isText ? (
          display.text
        ) : (
          <img 
            src={assetUrl(display.imagePath)} 
            alt={location.type}
            className={`${display.imageSize || 'w-full h-full'} object-contain`}
          />
        )}
      </button>

      {hovered && (
        <div
          role="tooltip"
          className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 pointer-events-none
                     bg-slate-900/95 border border-slate-600 rounded px-2 py-1 shadow-lg
                     whitespace-nowrap"
        >
          <div className="text-xs font-medium text-slate-100">{lines[0]}</div>
          {lines[1] && <div className="text-[11px] text-slate-400">{lines[1]}</div>}
          {state && <div className="text-[11px] text-slate-500 mt-0.5">{state}</div>}
        </div>
      )}
    </div>
  );
};

export default TrackerLocationButton;