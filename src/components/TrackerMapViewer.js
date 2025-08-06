import React, { useState, useEffect, useRef } from 'react';
import TrackerLocationButton from './TrackerLocationButton';
import { LOCATIONS_DATA } from '../constants/locationsData';
import { locationTrackerService } from '../services/locationTrackerService';

export function TrackerMapViewer({ 
  floorData, 
  gameId,
  connectingMode,
  connectingDoorId, // New prop to track which door is selected
  highlightedDoorId, // New prop to highlight the door we just navigated to
  editMode, // New prop for edit mode
  onLocationClick,
  onLocationRightClick,
  refreshTrigger
}) {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [loadedImagePath, setLoadedImagePath] = useState(null);
  const [successfulPath, setSuccessfulPath] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [locationStates, setLocationStates] = useState({});
  const [navigationMessage, setNavigationMessage] = useState('');
  const imgRef = useRef(null);

  // Load location states for current floor
  useEffect(() => {
    if (!floorData || !gameId) return;
    
    const locations = LOCATIONS_DATA[floorData.floorId] || [];
    const states = {};
    
    locations.forEach(location => {
      const state = locationTrackerService.getLocationState(gameId, location.id);
      if (state) {
        states[location.id] = state;
      }
    });
    
    setLocationStates(states);
    
    // Clear navigation message when floor changes
    setNavigationMessage('');
  }, [floorData, gameId, refreshTrigger]);

  // Show navigation message temporarily
  useEffect(() => {
    if (navigationMessage) {
      const timer = setTimeout(() => {
        setNavigationMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [navigationMessage]);

  // Image loading logic (same as original MapViewer)
  const loadImage = (imagePath) => {
    if (!imagePath) {
      setImageError(true);
      setIsImageLoading(false);
      return;
    }

    setIsImageLoading(true);
    setImageError(false);

    const testImg = new Image();
    
    testImg.onload = () => {
      setSuccessfulPath(imagePath);
      setIsImageLoading(false);
      setImageError(false);
      setLoadedImagePath(imagePath);
      updateImageDimensions();
    };
    
    testImg.onerror = () => {
      setImageError(true);
      setIsImageLoading(false);
    };
    
    testImg.src = imagePath;
  };

  const updateImageDimensions = () => {
    if (imgRef.current && imgRef.current.complete) {
      setImageDimensions({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
        naturalWidth: imgRef.current.naturalWidth,
        naturalHeight: imgRef.current.naturalHeight
      });
    }
  };

  useEffect(() => {
    if (!floorData) {
      setLoadedImagePath(null);
      setIsImageLoading(false);
      setImageError(false);
      setSuccessfulPath(null);
      setImageDimensions(null);
      return;
    }

    if (floorData.imagePath !== loadedImagePath) {
      loadImage(floorData.imagePath);
    }
  }, [floorData, loadedImagePath]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateImageDimensions();
    });

    if (imgRef.current) {
      resizeObserver.observe(imgRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [successfulPath]);

  const getLocationsForFloor = () => {
    return LOCATIONS_DATA[floorData?.floorId] || [];
  };

  if (!floorData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800 rounded-lg border border-slate-700">
        <div className="text-center p-8">
          <p className="text-slate-400 text-lg">
            Select a region, location, and floor to view the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <h2 className="text-xl font-semibold text-slate-100">
          {floorData.regionName} - {floorData.locationName} - {floorData.floorName}
        </h2>
        
        {/* FIXED: Always reserve space for status messages - no conditional rendering */}
        <div className="text-sm mt-1 min-h-[20px] flex items-center">
          {connectingDoorId && !editMode && (
            <span className="text-blue-400">
              Door selected for connection - click another door to link them
            </span>
          )}
          {editMode && (
            <span className="text-red-400">
              🔧 Edit Mode: Click linked doors to disconnect, click disabled doors to reset
            </span>
          )}
          {highlightedDoorId && !editMode && !connectingDoorId && (
            <span className="text-purple-400">
              ⭐ Showing linked door location
            </span>
          )}
          {/* This div always exists, even when empty, to maintain consistent spacing */}
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto relative">
        {isImageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 bg-opacity-75 z-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-slate-400">Loading image...</p>
            </div>
          </div>
        )}
        
        <div className="max-w-full max-h-full relative">
          {imageError ? (
            <div className="flex items-center justify-center p-8 text-center">
              <div>
                <div className="text-6xl mb-4 text-slate-600">🗺️</div>
                <p className="text-slate-400 text-lg mb-2">Image failed to load</p>
                <p className="text-slate-500 text-sm">
                  {floorData.regionName} - {floorData.locationName} - {floorData.floorName}
                </p>
              </div>
            </div>
          ) : successfulPath ? (
            <>
              <img 
                ref={imgRef}
                src={successfulPath} 
                alt={`${floorData.regionName} - ${floorData.locationName} - ${floorData.floorName}`}
                className="max-w-full max-h-full object-contain rounded shadow-lg cursor-default"
                onLoad={updateImageDimensions}
              />
              
              {/* Render tracker location buttons */}
              {imageDimensions && getLocationsForFloor().map(location => (
                <TrackerLocationButton
                  key={location.id}
                  location={location}
                  gameId={gameId}
                  imageDimensions={imageDimensions}
                  locationState={locationStates[location.id]}
                  connectingMode={connectingMode}
                  connectingDoorId={connectingDoorId}
                  highlightedDoorId={highlightedDoorId}
                  editMode={editMode}
                  onLocationClick={onLocationClick}
                  onLocationRightClick={onLocationRightClick}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}