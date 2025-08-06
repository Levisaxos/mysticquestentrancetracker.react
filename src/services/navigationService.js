import { MAP_DATA } from '../constants/mapData.js';

export class NavigationService {
  constructor() {
    this.flattenedData = this._flattenMapData();
  }

  // Flatten the hierarchical data for easier navigation
  _flattenMapData() {
    const flattened = [];
    
    MAP_DATA.regions
      .sort((a, b) => a.order - b.order)
      .forEach(region => {
        region.locations
          .sort((a, b) => a.order - b.order)
          .forEach(location => {
            location.floors
              .sort((a, b) => a.order - b.order)
              .forEach(floor => {
                flattened.push({
                  regionId: region.id,
                  regionName: region.name,
                  locationId: location.id,
                  locationName: location.name,
                  floorId: floor.id,
                  floorName: floor.name,
                  imagePath: floor.imagePath,
                  globalIndex: flattened.length
                });
              });
          });
      });
    
    return flattened;
  }

  // Get all regions sorted by order
  getRegions() {
    return MAP_DATA.regions.sort((a, b) => a.order - b.order);
  }

  // Get locations for a specific region
  getLocationsForRegion(regionId) {
    const region = MAP_DATA.regions.find(r => r.id === regionId);
    return region ? region.locations.sort((a, b) => a.order - b.order) : [];
  }

  // Get floors for a specific location
  getFloorsForLocation(regionId, locationId) {
    const region = MAP_DATA.regions.find(r => r.id === regionId);
    if (!region) return [];
    
    const location = region.locations.find(l => l.id === locationId);
    return location ? location.floors.sort((a, b) => a.order - b.order) : [];
  }

  // Get current floor data
  getCurrentFloorData(regionId, locationId, floorId) {
    return this.flattenedData.find(item => 
      item.regionId === regionId && 
      item.locationId === locationId && 
      item.floorId === floorId
    );
  }

  // Get all floor data - needed for finding linked doors
  getAllFloorData() {
    return this.flattenedData;
  }

  // Get floors that contain specific types of locations
  getFloorsWithLocationType(locationType, gameId, locationTrackerService, TEST_LOCATIONS) {
    const results = [];
    
    this.flattenedData.forEach(floorData => {
      const locations = TEST_LOCATIONS[floorData.floorId] || [];
      const matchingLocations = locations.filter(location => {
        if (location.type !== locationType) return false;
        
        // Additional filtering based on type
        if (locationType === 'door') {
          const linkedDoorId = locationTrackerService.getLinkedDoor(gameId, location.id);
          return !linkedDoorId; // Only unlinked doors
        } else if (locationType === 'chest' || locationType === 'box') {
          const state = locationTrackerService.getLocationState(gameId, location.id);
          return !state?.isOpened; // Only unopened chests/boxes
        }
        
        return true;
      });
      
      if (matchingLocations.length > 0) {
        results.push({
          ...floorData,
          matchingCount: matchingLocations.length
        });
      }
    });
    
    return results;
  }

  // Get floors with linked doors
  getFloorsWithLinkedDoors(gameId, locationTrackerService, TEST_LOCATIONS) {
    const results = [];
    
    this.flattenedData.forEach(floorData => {
      const locations = TEST_LOCATIONS[floorData.floorId] || [];
      const linkedDoors = locations.filter(location => {
        if (location.type !== 'door' && location.type !== 'battleground') return false;
        const linkedDoorId = locationTrackerService.getLinkedDoor(gameId, location.id);
        return linkedDoorId; // Only linked doors
      });
      
      if (linkedDoors.length > 0) {
        results.push({
          ...floorData,
          matchingCount: linkedDoors.length
        });
      }
    });
    
    return results;
  }

  // Navigate to previous floor/location/region
  navigatePrevious(currentRegionId, currentLocationId, currentFloorId) {
    const currentData = this.getCurrentFloorData(currentRegionId, currentLocationId, currentFloorId);
    if (!currentData) return null;

    const currentIndex = currentData.globalIndex;
    if (currentIndex > 0) {
      const previousData = this.flattenedData[currentIndex - 1];
      return {
        regionId: previousData.regionId,
        locationId: previousData.locationId,
        floorId: previousData.floorId
      };
    }
    
    return null; // Already at the first item
  }

  // Navigate to next floor/location/region
  navigateNext(currentRegionId, currentLocationId, currentFloorId) {
    const currentData = this.getCurrentFloorData(currentRegionId, currentLocationId, currentFloorId);
    if (!currentData) return null;

    const currentIndex = currentData.globalIndex;
    if (currentIndex < this.flattenedData.length - 1) {
      const nextData = this.flattenedData[currentIndex + 1];
      return {
        regionId: nextData.regionId,
        locationId: nextData.locationId,
        floorId: nextData.floorId
      };
    }
    
    return null; // Already at the last item
  }

  // Get the first valid location for a region
  getFirstLocationForRegion(regionId) {
    const locations = this.getLocationsForRegion(regionId);
    return locations.length > 0 ? locations[0].id : null;
  }

  // Get the first valid floor for a location
  getFirstFloorForLocation(regionId, locationId) {
    const floors = this.getFloorsForLocation(regionId, locationId);
    return floors.length > 0 ? floors[0].id : null;
  }

  // Check if navigation buttons should be enabled
  canNavigatePrevious(regionId, locationId, floorId) {
    const currentData = this.getCurrentFloorData(regionId, locationId, floorId);
    return currentData && currentData.globalIndex > 0;
  }

  canNavigateNext(regionId, locationId, floorId) {
    const currentData = this.getCurrentFloorData(regionId, locationId, floorId);
    return currentData && currentData.globalIndex < this.flattenedData.length - 1;
  }

  // Get initial state (first item)
  getInitialState() {
    if (this.flattenedData.length > 0) {
      const first = this.flattenedData[0];
      return {
        regionId: first.regionId,
        locationId: first.locationId,
        floorId: first.floorId
      };
    }
    return null;
  }
}