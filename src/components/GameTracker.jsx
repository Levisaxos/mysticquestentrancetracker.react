import React, { useState, useEffect, useMemo } from 'react';
import NavigationPanel from './NavigationPanel';
import { TrackerMapViewer } from './TrackerMapViewer';
import LinkPickerModal from './LinkPickerModal';
import ItemPanel from './ItemPanel';
import UnexploredExitsModal from './UnexploredExitsModal';
import ApConnectionModal from './ApConnectionModal';
import RunSettingsModal from './RunSettingsModal';
import { NavigationService } from '../services/navigationService';
import { locationTrackerService } from '../services/locationTrackerService';
import { itemService } from '../services/itemService';
import { gameService } from '../services/gameService';
import { computeMarkerStatus } from '../engine/markerStatus';
import { isShuffled } from '../engine/reachability';
import binding from '../data/binding.json';
import { LOCATIONS_DATA } from '../constants/locationsData';

const navigationService = new NavigationService();

const GameTracker = ({ game, onCloseGame }) => {
  const gameId = game.id;
  const [currentRegionId, setCurrentRegionId] = useState(null);
  const [currentLocationId, setCurrentLocationId] = useState(null);
  const [currentFloorId, setCurrentFloorId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [linkingFrom, setLinkingFrom] = useState(null); // { location, floorId }
  const [highlightedDoorId, setHighlightedDoorId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [exitsOpen, setExitsOpen] = useState(false);
  const [apOpen, setApOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Reachability is a whole-graph computation, so do it once per change rather
  // than per marker. refreshTrigger is bumped by every action that could move
  // the answer: linking, clearing a check, taking an item, changing settings.
  const logic = useMemo(() => {
    const game = gameService.getGame(gameId);
    if (!game) return null;

    // doorConnections is keyed by *our* marker ids; the engine works in
    // canonical entrance ids. Translating through the binding is what makes a
    // link actually affect reachability — without it the engine silently sees
    // no links at all.
    const discoveredLinks = {};
    const droppedLinks = new Map();
    const settings = game.settings ?? {};
    for (const [from, to] of Object.entries(game.doorConnections ?? {})) {
      const fromMarker = from.replace('door_', '');
      const toMarker = String(to).replace('door_', '');

      const fromEntrance = binding.markers[fromMarker]?.entranceId;
      const toEntrance = binding.markers[toMarker]?.entranceId;

      // Two separate reasons a link can be ignored, and both used to be silent.
      if (fromEntrance == null || toEntrance == null) {
        // One end has no binding, so the engine has nothing to connect.
        droppedLinks.set(Number(fromMarker), 'unmapped');
      } else if (!isShuffled(fromEntrance, settings)) {
        // The run's settings say this door is not shuffled, so the engine uses
        // its vanilla destination and quietly throws the link away. That is
        // almost always a wrong Map Shuffle setting rather than a wrong link,
        // and it makes everything downstream look broken.
        droppedLinks.set(Number(fromMarker), 'not-shuffled');
      } else {
        discoveredLinks[fromEntrance] = toEntrance;
      }
    }

    // Which checks are already collected, in canonical terms. A linked door is
    // only "done" when there is nothing left behind it, so the engine needs to
    // know what has been ticked off.
    const collectedApIds = new Set();
    for (const [markerId, state] of Object.entries(game.locationStates ?? {})) {
      if (!state?.isOpened) continue;
      const bound = binding.markers[markerId];
      if (bound?.apLocationId != null) collectedApIds.add(bound.apLocationId);
      // Battlegrounds resolve to a subregion rather than one battlefield, so
      // clearing the marker clears its candidates.
      else for (const id of bound?.candidates ?? []) collectedApIds.add(id);
    }

    return {
      ...computeMarkerStatus({
        ownedItems: itemService.getOwnedCounts(gameId),
        discoveredLinks,
        settings: game.settings ?? {},
        collectedApIds,
      }),
      droppedLinks,
    };
  }, [gameId, refreshTrigger]);

  // Initialize with World Map
  useEffect(() => {
    // Start with World Map (regionId: 1, locationId: 101, floorId: 10101)
    setCurrentRegionId(1);
    setCurrentLocationId(101);
    setCurrentFloorId(10101);
  }, [game]);

  const handleRegionChange = (regionId) => {
    const firstLocationId = navigationService.getFirstLocationForRegion(regionId);
    const firstFloorId = firstLocationId ? 
      navigationService.getFirstFloorForLocation(regionId, firstLocationId) : null;
    
    setCurrentRegionId(regionId);
    setCurrentLocationId(firstLocationId);
    setCurrentFloorId(firstFloorId);
    setHighlightedDoorId(null);
  };

  const handleLocationChange = (locationId) => {
    const firstFloorId = navigationService.getFirstFloorForLocation(currentRegionId, locationId);
    
    setCurrentLocationId(locationId);
    setCurrentFloorId(firstFloorId);
    setHighlightedDoorId(null);
  };

  const handleFloorChange = (floorId) => {
    setCurrentFloorId(floorId);
    setHighlightedDoorId(null);
  };

  const handlePrevious = () => {
    const previous = navigationService.navigatePrevious(currentRegionId, currentLocationId, currentFloorId);
    if (previous) {
      setCurrentRegionId(previous.regionId);
      setCurrentLocationId(previous.locationId);
      setCurrentFloorId(previous.floorId);
      setHighlightedDoorId(null);
    }
  };

  const handleNext = () => {
    const next = navigationService.navigateNext(currentRegionId, currentLocationId, currentFloorId);
    if (next) {
      setCurrentRegionId(next.regionId);
      setCurrentLocationId(next.locationId);
      setCurrentFloorId(next.floorId);
      setHighlightedDoorId(null);
    }
  };

  const handleLocationClick = (location) => {
    // Clear highlight when performing any action
    setHighlightedDoorId(null);
    
    // Battlegrounds are checks, so like chests and boxes there is nothing to do
    // on left click — they are cleared with right click.
    if (location.type === 'battleground') return;

    if (location.type === 'door') {
      const linkedDoorId = locationTrackerService.getLinkedDoor(game.id, location.id);
      const locationState = locationTrackerService.getLocationState(game.id, location.id);
      
      if (editMode) {
        // Edit mode: disconnect linked doors or reset disabled doors
        if (linkedDoorId) {
          // Disconnect the doors - this will reset both doors to unlinked state
          locationTrackerService.unlinkDoors(game.id, location.id, linkedDoorId);
          setRefreshTrigger(prev => prev + 1);
        } else if (locationState?.isDisabled) {
          // Reset disabled door back to normal
          locationTrackerService.markLocationAsDisabled(game.id, location.id, currentFloorId);
          setRefreshTrigger(prev => prev + 1);
        }
      } else {
        // Normal mode: follow an existing link, or open the picker to make one
        if (linkedDoorId) {
          navigateToLinkedDoor(linkedDoorId);
        } else {
          setLinkingFrom({ location, floorId: currentFloorId });
        }
      }
    }
    // Left click on chest/box does nothing as requested
  };

  const handleLocationRightClick = (location) => {
    // Clear highlight when performing any action
    setHighlightedDoorId(null);
    
    if (location.type === 'chest' || location.type === 'box' || location.type === 'battleground') {
      // Right click toggles a check open/closed (or a battleground cleared)
      locationTrackerService.toggleCheck(game.id, location.id, currentFloorId, location.type);
      setRefreshTrigger(prev => prev + 1);
    } else if (location.type === 'door') {
      // Right click on a door marks it as disabled/useless
      locationTrackerService.markLocationAsDisabled(game.id, location.id, currentFloorId);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
    // Close the picker when entering/exiting edit mode
    setLinkingFrom(null);
    setHighlightedDoorId(null);
  };

  // Navigate to linked door location
  const navigateToLinkedDoor = (linkedDoorId) => {
    // Search through all floors to find the door with linkedDoorId
    const allFloorData = navigationService.getAllFloorData();
    
    for (const floorData of allFloorData) {
      const locations = LOCATIONS_DATA[floorData.floorId] || [];
      const foundLocation = locations.find(loc => loc.id === linkedDoorId);
      
      if (foundLocation) {
        // Navigate to the floor containing the linked door
        setCurrentRegionId(floorData.regionId);
        setCurrentLocationId(floorData.locationId);
        setCurrentFloorId(floorData.floorId);
        
        // Highlight the linked door until next action (no timeout)
        setHighlightedDoorId(linkedDoorId);
        
        console.log(`Navigated to linked ${foundLocation.type} "${foundLocation.name}" on ${floorData.regionName} - ${floorData.locationName} - ${floorData.floorName}`);
        return;
      }
    }
    
    console.log(`Could not find linked location with ID ${linkedDoorId}`);
  };

  // Get navigation state
  const canNavigatePrevious = navigationService.canNavigatePrevious(
    currentRegionId, 
    currentLocationId, 
    currentFloorId
  );

  const canNavigateNext = navigationService.canNavigateNext(
    currentRegionId, 
    currentLocationId, 
    currentFloorId
  );

  const currentFloorData = navigationService.getCurrentFloorData(
    currentRegionId, 
    currentLocationId, 
    currentFloorId
  );

  const settings = gameService.getSettings(gameId);

  const goToWorldMap = () => {
    setCurrentRegionId(1);
    setCurrentLocationId(101);
    setCurrentFloorId(10101);
    setHighlightedDoorId(null);
    setLinkingFrom(null);
  };

  return (
    <div className="flex flex-1 gap-3 p-3 min-h-0">
      {/* Everything that is not the map lives in one column, so the map keeps
          the full height of the window. */}
      <div className="w-60 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <NavigationPanel
          currentRegionId={currentRegionId}
          currentLocationId={currentLocationId}
          currentFloorId={currentFloorId}
          onRegionChange={handleRegionChange}
          onLocationChange={handleLocationChange}
          onFloorChange={handleFloorChange}
          navigationService={navigationService}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onWorldMap={goToWorldMap}
          canNavigatePrevious={canNavigatePrevious}
          canNavigateNext={canNavigateNext}
          gameId={game.id}
          refreshTrigger={refreshTrigger}
          editMode={editMode}
          onToggleEditMode={handleToggleEditMode}
          onCloseGame={onCloseGame}
          doorsLeft={logic?.counts.doorsLeft ?? 0}
          checksLeft={logic?.counts.checksLeft ?? 0}
          onShowExits={() => setExitsOpen(true)}
          onShowArchipelago={() => setApOpen(true)}
          onShowSettings={() => setSettingsOpen(true)}
          droppedLinks={logic?.droppedLinks}
          shuffleConfigured={
            (settings.mapShuffle && settings.mapShuffle !== 'none') || Boolean(settings.overworldShuffle)
          }
        />

        <ItemPanel
          gameId={game.id}
          refreshTrigger={refreshTrigger}
          onChange={() => setRefreshTrigger(prev => prev + 1)}
        />
      </div>

      <TrackerMapViewer
        floorData={currentFloorData}
        gameId={game.id}
        connectingDoorId={linkingFrom?.location?.id ?? null}
        highlightedDoorId={highlightedDoorId}
        editMode={editMode}
        onLocationClick={handleLocationClick}
        onLocationRightClick={handleLocationRightClick}
        refreshTrigger={refreshTrigger}
        markerStatus={logic?.status}
      />

      <RunSettingsModal
        isOpen={settingsOpen}
        gameId={game.id}
        onClose={() => setSettingsOpen(false)}
        onChange={() => setRefreshTrigger(prev => prev + 1)}
      />

      <ApConnectionModal
        isOpen={apOpen}
        gameId={game.id}
        onClose={() => setApOpen(false)}
        onChange={() => setRefreshTrigger(prev => prev + 1)}
      />

      <UnexploredExitsModal
        isOpen={exitsOpen}
        unexploredExits={logic?.strict.unexploredExits}
        onClose={() => setExitsOpen(false)}
        onGoToFloor={(group) => {
          setCurrentRegionId(group.regionId);
          setCurrentLocationId(group.locationId);
          setCurrentFloorId(group.floorId);
          setHighlightedDoorId(null);
        }}
      />

      <LinkPickerModal
        isOpen={Boolean(linkingFrom)}
        gameId={game.id}
        sourceLocation={linkingFrom?.location ?? null}
        sourceFloorData={currentFloorData}
        navigationService={navigationService}
        onClose={() => setLinkingFrom(null)}
        onLink={(targetDoor, targetFloorId) => {
          locationTrackerService.linkDoors(game.id, linkingFrom.location.id, targetDoor.id, {
            [linkingFrom.location.id]: linkingFrom.floorId,
            [targetDoor.id]: targetFloorId,
          });
          setLinkingFrom(null);
          setRefreshTrigger(prev => prev + 1);
        }}
      />
    </div>
  );
};

export default GameTracker;