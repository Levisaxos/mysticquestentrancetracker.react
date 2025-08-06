import React, { useState, useEffect } from 'react';
import { NavigationBar } from './NavigationBar';
import { MapViewer } from './MapViewer';
import EditorModeBar from './EditorModeBar';
import { NavigationService } from '../services/navigationService';
import { LOCATIONS_DATA } from '../constants/locationsData';

const navigationService = new NavigationService();

export function MapViewerContainer() {
  const [currentRegionId, setCurrentRegionId] = useState(null);
  const [currentLocationId, setCurrentLocationId] = useState(null);
  const [currentFloorId, setCurrentFloorId] = useState(null);
  const [editorMode, setEditorMode] = useState('view');
  const [locations, setLocations] = useState({});
  const [connectingDoor, setConnectingDoor] = useState(null);
  const [battlegroundCounter, setBattlegroundCounter] = useState(1);
  const [nextLocationId, setNextLocationId] = useState(1);
  const [floorCounters, setFloorCounters] = useState({}); // Track chest/box counters per floor

  // Initialize with first available item
  useEffect(() => {
    const initialState = navigationService.getInitialState();
    if (initialState) {
      setCurrentRegionId(initialState.regionId);
      setCurrentLocationId(initialState.locationId);
      setCurrentFloorId(initialState.floorId);
    }
  }, []);

  // Get next counter for chest/box on current floor
  const getNextFloorCounter = (floorId, type) => {
    const floorKey = `${floorId}_${type}`;
    const currentCounter = floorCounters[floorKey] || 1;
    
    // Update the counter for this floor and type
    setFloorCounters(prev => ({
      ...prev,
      [floorKey]: currentCounter + 1
    }));
    
    return currentCounter;
  };

  const handleRegionChange = (regionId) => {
    const firstLocationId = navigationService.getFirstLocationForRegion(regionId);
    const firstFloorId = firstLocationId ? 
      navigationService.getFirstFloorForLocation(regionId, firstLocationId) : null;
    
    setCurrentRegionId(regionId);
    setCurrentLocationId(firstLocationId);
    setCurrentFloorId(firstFloorId);
  };

  const handleLocationChange = (locationId) => {
    const firstFloorId = navigationService.getFirstFloorForLocation(currentRegionId, locationId);
    
    setCurrentLocationId(locationId);
    setCurrentFloorId(firstFloorId);
  };

  const handleFloorChange = (floorId) => {
    setCurrentFloorId(floorId);
  };

  const handlePrevious = () => {
    const previous = navigationService.navigatePrevious(currentRegionId, currentLocationId, currentFloorId);
    if (previous) {
      setCurrentRegionId(previous.regionId);
      setCurrentLocationId(previous.locationId);
      setCurrentFloorId(previous.floorId);
    }
  };

  const handleNext = () => {
    const next = navigationService.navigateNext(currentRegionId, currentLocationId, currentFloorId);
    if (next) {
      setCurrentRegionId(next.regionId);
      setCurrentLocationId(next.locationId);
      setCurrentFloorId(next.floorId);
    }
  };

  const currentFloorData = navigationService.getCurrentFloorData(
    currentRegionId, 
    currentLocationId, 
    currentFloorId
  );

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

  // Editor functions
  const handleLocationAdd = (floorId, locationData) => {
    console.log(`Adding location to floor ${floorId}:`, locationData);
    
    // Assign simple incrementing ID
    const locationWithId = {
      ...locationData,
      id: nextLocationId
    };
    
    setLocations(prev => {
      const newState = {
        ...prev,
        [floorId]: [...(prev[floorId] || []), locationWithId]
      };
      console.log('Updated locations state:', newState);
      return newState;
    });
    
    // Increment ID counter
    setNextLocationId(prev => prev + 1);
    
    // Increment battleground counter if it's a battleground
    if (locationData.name && locationData.name.startsWith('Battleground #')) {
      setBattlegroundCounter(prev => prev + 1);
    }
  };

  const handleLocationEdit = (locationData) => {
    setLocations(prev => {
      const floorLocations = prev[currentFloorData.floorId] || [];
      const updatedLocations = floorLocations.map(loc => 
        loc.id === locationData.id ? locationData : loc
      );
      
      return {
        ...prev,
        [currentFloorData.floorId]: updatedLocations
      };
    });
  };

  const handleLocationDelete = (locationToDelete) => {
    setLocations(prev => {
      const floorLocations = prev[currentFloorData.floorId] || [];
      const updatedLocations = floorLocations.filter(loc => loc.id !== locationToDelete.id);
      
      return {
        ...prev,
        [currentFloorData.floorId]: updatedLocations
      };
    });
  };

  const handleLocationConnect = (door) => {
    if (door.type !== 'door' && door.type !== 'battleground') return;
    
    if (!connectingDoor) {
      // First door selected
      setConnectingDoor(door);
      console.log('First door selected:', door.name);
    } else {
      // Second door selected - create connection
      console.log('Connecting doors:', connectingDoor.name, 'to', door.name);
      
      // TODO: Implement door connection logic here
      // This would involve updating both doors with connection info
      
      setConnectingDoor(null);
      alert(`Connected "${connectingDoor.name}" to "${door.name}"`);
    }
  };

  const handleCancelConnect = () => {
    setConnectingDoor(null);
    console.log('Connection cancelled');
  };

  // Merge test locations with user-created locations - FIXED VERSION
  const getAllLocationsForFloor = (floorId) => {
    if (!floorId) {
      console.log('getAllLocationsForFloor: No floorId provided');
      return [];
    }
    
    // Convert floorId to string for consistent key comparison
    const floorIdStr = String(floorId);
    
    const testLocs = LOCATIONS_DATA[floorIdStr] || [];
    const userLocs = locations[floorIdStr] || [];
    
    console.log(`Floor ${floorIdStr}: ${testLocs.length} test locations, ${userLocs.length} user locations`);
    
    return [...testLocs, ...userLocs];
  };

  const getLocationStats = () => {
    // Include both test locations and user-created locations
    const allLocations = getAllLocationsForFloor(currentFloorData?.floorId) || [];
    return {
      doors: allLocations.filter(loc => loc.type === 'door').length,
      battlegrounds: allLocations.filter(loc => loc.type === 'battleground').length,
      chests: allLocations.filter(loc => loc.type === 'chest').length,
      boxes: allLocations.filter(loc => loc.type === 'box').length,
      items: allLocations.filter(loc => loc.type === 'item').length
    };
  };

  // Export function for created locations
  const exportLocations = () => {
    const exportData = {};
    let globalId = 1; // Start with 1 for unique IDs
    
    // First, export all test locations with new unique IDs
    Object.entries(LOCATIONS_DATA).forEach(([floorId, testLocations]) => {
      if (testLocations.length > 0) {
        exportData[floorId] = testLocations.map(loc => ({
          id: globalId++, // Assign new unique ID
          name: loc.name,
          type: loc.type,
          x: loc.x,
          y: loc.y,
          ...(loc.targetFloorId && { targetFloorId: loc.targetFloorId }),
          ...(loc.itemPath && { itemPath: loc.itemPath })
        }));
      }
    });
    
    // Then, export user-created locations with new unique IDs
    Object.entries(locations).forEach(([floorId, floorLocations]) => {
      if (floorLocations.length > 0) {
        // If floor already exists from test locations, append to it
        if (exportData[floorId]) {
          const userLocs = floorLocations.map(loc => ({
            id: globalId++, // Assign new unique ID
            name: loc.name,
            type: loc.type,
            x: loc.x,
            y: loc.y,
            ...(loc.targetFloorId && { targetFloorId: loc.targetFloorId }),
            ...(loc.itemPath && { itemPath: loc.itemPath })
          }));
          exportData[floorId] = [...exportData[floorId], ...userLocs];
        } else {
          // Create new floor entry
          exportData[floorId] = floorLocations.map(loc => ({
            id: globalId++, // Assign new unique ID
            name: loc.name,
            type: loc.type,
            x: loc.x,
            y: loc.y,
            ...(loc.targetFloorId && { targetFloorId: loc.targetFloorId }),
            ...(loc.itemPath && { itemPath: loc.itemPath })
          }));
        }
      }
    });
    
    console.log('Export complete. Total unique IDs assigned:', globalId - 1);
    
    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'locations_export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
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
        canNavigatePrevious={canNavigatePrevious}
        canNavigateNext={canNavigateNext}
      />
      
      <EditorModeBar
        currentMode={editorMode}
        onModeChange={setEditorMode}
        locationStats={getLocationStats()}
        onExportLocations={exportLocations}
        connectingDoor={connectingDoor}
      />
      
      <MapViewer 
        floorData={currentFloorData}
        editorMode={editorMode}
        onLocationAdd={handleLocationAdd}
        onLocationEdit={handleLocationEdit}
        onLocationDelete={handleLocationDelete}
        onLocationConnect={handleLocationConnect}
        onCancelConnect={handleCancelConnect}
        locations={getAllLocationsForFloor(currentFloorData?.floorId)}
        battlegroundCounter={battlegroundCounter}
        getNextFloorCounter={getNextFloorCounter}
      />
    </div>
  );
}