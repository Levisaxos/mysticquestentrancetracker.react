import React, { useState, useEffect } from 'react';
import { locationTrackerService } from '../services/locationTrackerService';
import { LOCATIONS_DATA } from '../constants/locationsData';

export function NavigationBar({
  currentRegionId,
  currentLocationId,
  currentFloorId,
  onRegionChange,
  onLocationChange,
  onFloorChange,
  navigationService,
  onPrevious,
  onNext,
  onWorldMap, // New prop for world map navigation
  canNavigatePrevious,
  canNavigateNext,
  gameId, // Add gameId prop for the tracker
  refreshTrigger, // Add refreshTrigger to update stats when actions are performed
  editMode, // Add edit mode prop
  onToggleEditMode // Add edit mode toggle handler
}) {
  const [currentMapStats, setCurrentMapStats] = useState({
    doors: { linked: 0, total: 0 },
    chests: { opened: 0, total: 0 },
    boxes: { opened: 0, total: 0 }
  });

  const regions = navigationService.getRegions();
  const locations = currentRegionId ? navigationService.getLocationsForRegion(currentRegionId) : [];
  const floors = (currentRegionId && currentLocationId) ?
    navigationService.getFloorsForLocation(currentRegionId, currentLocationId) : [];

  // Calculate stats for current floor
  useEffect(() => {
    if (!gameId || !currentFloorId) {
      setCurrentMapStats({
        doors: { linked: 0, total: 0 },
        chests: { opened: 0, total: 0 },
        boxes: { opened: 0, total: 0 }
      });
      return;
    }

    const locations = LOCATIONS_DATA[currentFloorId] || [];

    const doors = locations.filter(loc => loc.type === 'door' || loc.type === 'battleground');
    const chests = locations.filter(loc => loc.type === 'chest');
    const boxes = locations.filter(loc => loc.type === 'box');

    // Count linked doors
    const linkedDoors = doors.filter(door => {
      const linkedDoorId = locationTrackerService.getLinkedDoor(gameId, door.id);
      return linkedDoorId;
    }).length;

    // Count opened chests
    const openedChests = chests.filter(chest => {
      const state = locationTrackerService.getLocationState(gameId, chest.id);
      return state?.isOpened;
    }).length;

    // Count opened boxes
    const openedBoxes = boxes.filter(box => {
      const state = locationTrackerService.getLocationState(gameId, box.id);
      return state?.isOpened;
    }).length;

    setCurrentMapStats({
      doors: { linked: linkedDoors, total: doors.length },
      chests: { opened: openedChests, total: chests.length },
      boxes: { opened: openedBoxes, total: boxes.length }
    });
  }, [gameId, currentFloorId, refreshTrigger]); // Add refreshTrigger as dependency

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
        <div className="flex flex-col gap-2 min-w-0 lg:min-w-48">
          <label htmlFor="region-select" className="text-slate-300 text-sm font-medium uppercase tracking-wide">
            Region:
          </label>
          <select
            id="region-select"
            className="select-dark"
            value={currentRegionId || ''}
            onChange={(e) => onRegionChange(parseInt(e.target.value))}
          >
            <option value="">Select Region</option>
            {regions.map(region => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 min-w-0 lg:min-w-48">
          <label htmlFor="location-select" className="text-slate-300 text-sm font-medium uppercase tracking-wide">
            Location:
          </label>
          <select
            id="location-select"
            className="select-dark"
            value={currentLocationId || ''}
            onChange={(e) => onLocationChange(parseInt(e.target.value))}
            disabled={!currentRegionId}
          >
            <option value="">Select Location</option>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 min-w-0 lg:min-w-48">
          <label htmlFor="floor-select" className="text-slate-300 text-sm font-medium uppercase tracking-wide">
            Floor:
          </label>
          <select
            id="floor-select"
            className="select-dark"
            value={currentFloorId || ''}
            onChange={(e) => onFloorChange(parseInt(e.target.value))}
            disabled={!currentLocationId}
          >
            <option value="">Select Floor</option>
            {floors.map(floor => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 items-center justify-end min-w-[280px] ml-8">
          <div className="text-slate-300 text-sm font-medium uppercase tracking-wide opacity-0">
            Navigation:
          </div>
          <div className="flex gap-2">
            <button
              className="btn-nav px-3 py-2 text-sm"
              onClick={onPrevious}
              disabled={!canNavigatePrevious}
              title="Previous floor/location/region"
            >
              <span className="text-lg">&#8249; Previous</span>
            </button>

            <button
              className="btn-nav px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white"
              onClick={onWorldMap}
              title="Go to World Map"
            >
              <span className="text-lg">🌍 World</span>
            </button>

            <button
              className="btn-nav px-3 py-2 text-sm"
              onClick={onNext}
              disabled={!canNavigateNext}
              title="Next floor/location/region"
            >
              <span className="text-lg">Next &#8250;</span>
            </button>
          </div>
        </div>

        {/* Current Map Stats - Only show when gameId exists and floor is selected */}
        {gameId && currentFloorId && (
          <div className="flex flex-col gap-2">
            <div className="text-slate-300 text-sm font-medium uppercase tracking-wide">
              Current Map:
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="bg-slate-700 rounded py-2 px-2">
                <div className="text-blue-400 font-bold text-lg">{currentMapStats.doors.linked}/{currentMapStats.doors.total}</div>
                <div className="text-slate-400">Doors Linked</div>
              </div>
              <div className="bg-slate-700 rounded py-2 px-2">
                <div className="text-amber-400 font-bold text-lg">{currentMapStats.chests.opened}/{currentMapStats.chests.total}</div>
                <div className="text-slate-400">Chests Opened</div>
              </div>
              <div className="bg-slate-700 rounded py-2 px-2">
                <div className="text-orange-400 font-bold text-lg">{currentMapStats.boxes.opened}/{currentMapStats.boxes.total}</div>
                <div className="text-slate-400">Boxes Opened</div>
              </div>
            </div>
          </div>
        )}

        {/* Spacer to push edit button to far right */}
        <div className="flex-1"></div>

        {/* Edit Mode Button - Far right edge, same size as Previous/Next */}
        {gameId && (
          <div className="flex flex-col gap-2 items-center justify-end">
            <div className="text-slate-300 text-sm font-medium uppercase tracking-wide opacity-0">
              Edit:
            </div>
            <button
              onClick={onToggleEditMode}
              className={`px-3 py-2 text-sm font-medium rounded transition-colors ${editMode
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              title={editMode ? 'Exit edit mode' : 'Enter edit mode to disconnect doors'}
            >
              <span className="text-lg">{editMode ? 'Exit Edit' : 'Edit'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}