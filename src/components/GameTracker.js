import React, { useState, useEffect } from 'react';
import { NavigationBar } from './NavigationBar';
import { TrackerMapViewer } from './TrackerMapViewer';
import { NavigationService } from '../services/navigationService';
import { locationTrackerService } from '../services/locationTrackerService';
import { LOCATIONS_DATA } from '../constants/locationsData';

const navigationService = new NavigationService();

const GameTracker = ({ game, onCloseGame }) => {
  const [currentRegionId, setCurrentRegionId] = useState(null);
  const [currentLocationId, setCurrentLocationId] = useState(null);
  const [currentFloorId, setCurrentFloorId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [connectingDoorId, setConnectingDoorId] = useState(null);
  const [highlightedDoorId, setHighlightedDoorId] = useState(null);
  const [editMode, setEditMode] = useState(false);

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

  // Helper function to find first available battleground on current floor
  const findFirstAvailableBattleground = () => {
    const locations = LOCATIONS_DATA[currentFloorId] || [];
    const battlegrounds = locations.filter(loc => loc.type === 'battleground');
    
    // Find first battleground that isn't already linked
    for (const battleground of battlegrounds) {
      const linkedDoorId = locationTrackerService.getLinkedDoor(game.id, battleground.id);
      if (!linkedDoorId) {
        return battleground.id;
      }
    }
    
    return null; // No available battlegrounds
  };

  const handleLocationClick = (location) => {
    // Clear highlight when performing any action
    setHighlightedDoorId(null);
    
    if (location.type === 'door' || location.type === 'battleground') {
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
        // Normal mode: link doors or navigate
        if (linkedDoorId) {
          // This door is already connected, navigate to the linked door's location
          navigateToLinkedDoor(linkedDoorId);
        } else if (connectingDoorId && connectingDoorId !== location.id) {
          // We have a door selected and clicked a different door - connect them
          locationTrackerService.linkDoors(game.id, connectingDoorId, location.id);
          setConnectingDoorId(null);
          setRefreshTrigger(prev => prev + 1);
        } else if (connectingDoorId === location.id) {
          // Self-linking logic - link location to itself (makes it a standalone battleground)
          locationTrackerService.linkDoors(game.id, location.id, location.id);
          console.log(`Self-linked ${location.type} "${location.name}" to itself (now functions as battleground)`);
          setConnectingDoorId(null);
          setRefreshTrigger(prev => prev + 1);
        } else {
          // Select this door for connection
          setConnectingDoorId(location.id);
        }
      }
    }
    // Left click on chest/box does nothing as requested
  };

  const handleLocationRightClick = (location) => {
    // Clear highlight when performing any action
    setHighlightedDoorId(null);
    
    if (location.type === 'chest' || location.type === 'box') {
      // Right click on chest/box opens it
      locationTrackerService.toggleChestBox(game.id, location.id, currentFloorId, location.type);
      setRefreshTrigger(prev => prev + 1);
    } else if (location.type === 'door' || location.type === 'battleground') {
      // Right click on door/battleground marks it as disabled/useless
      locationTrackerService.markLocationAsDisabled(game.id, location.id, currentFloorId);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
    // Clear any door selection when entering/exiting edit mode
    setConnectingDoorId(null);
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

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col flex-1 p-4 gap-4">
        <NavigationBar
          currentRegionId={currentRegionId}
          currentLocationId={currentLocationId}
          currentFloorId={currentFloorId}
          onRegionChange={handleRegionChange}
          onLocationChange={handleLocationChange}
          onFloorChange={handleFloorChange}
          navigationService={navigationService}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onWorldMap={() => {
            setCurrentRegionId(1);
            setCurrentLocationId(101);
            setCurrentFloorId(10101);
            setHighlightedDoorId(null);
            setConnectingDoorId(null);
          }}
          canNavigatePrevious={canNavigatePrevious}
          canNavigateNext={canNavigateNext}
          gameId={game.id}
          refreshTrigger={refreshTrigger}
          editMode={editMode}
          onToggleEditMode={handleToggleEditMode}
        />
        
        <TrackerMapViewer
          floorData={currentFloorData}
          gameId={game.id}
          connectingMode={false}
          connectingDoorId={connectingDoorId}
          highlightedDoorId={highlightedDoorId}
          editMode={editMode}
          onLocationClick={handleLocationClick}
          onLocationRightClick={handleLocationRightClick}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </div>
  );
};

export default GameTracker;