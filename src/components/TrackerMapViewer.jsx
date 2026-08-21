import React, { useState, useEffect, useCallback, useRef } from 'react';
import TrackerLocationButton from './TrackerLocationButton';
import { LOCATIONS_DATA } from '../constants/locationsData';
import { locationTrackerService } from '../services/locationTrackerService';
import { assetUrl } from '../utils/assetUrl';

export function TrackerMapViewer({ 
  floorData, 
  gameId,
  connectingDoorId, // New prop to track which door is selected
  highlightedDoorId, // New prop to highlight the door we just navigated to
  editMode, // New prop for edit mode
  onLocationClick,
  onLocationRightClick,
  refreshTrigger,
  markerStatus,
  droppedLinks,
  fixedLinks
}) {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [loadedImagePath, setLoadedImagePath] = useState(null);
  const [successfulPath, setSuccessfulPath] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [locationStates, setLocationStates] = useState({});
  // Where the pointer is, in the map image's own pixels — the same numbers
  // locationsData.js stores. Placing a marker means reading a coordinate off
  // the map, and without this the only way to get one is to guess and re-guess.
  const [cursor, setCursor] = useState(null);
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
  }, [floorData, gameId, refreshTrigger]);

  // Measure the rendered image so marker positions can be scaled to it
  const updateImageDimensions = useCallback(() => {
    if (imgRef.current && imgRef.current.complete) {
      setImageDimensions({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
        naturalWidth: imgRef.current.naturalWidth,
        naturalHeight: imgRef.current.naturalHeight
      });
    }
  }, []);

  // Image loading logic (same as original MapViewer)
  const loadImage = useCallback((imagePath) => {
    if (!imagePath) {
      setImageError(true);
      setIsImageLoading(false);
      return;
    }

    setIsImageLoading(true);
    setImageError(false);

    const resolved = assetUrl(imagePath);
    const testImg = new Image();

    testImg.onload = () => {
      setSuccessfulPath(resolved);
      setIsImageLoading(false);
      setImageError(false);
      setLoadedImagePath(imagePath);
      updateImageDimensions();
    };
    
    testImg.onerror = () => {
      setImageError(true);
      setIsImageLoading(false);
    };
    
    testImg.src = resolved;
  }, [updateImageDimensions]);

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
  }, [floorData, loadedImagePath, loadImage]);

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
  }, [successfulPath, updateImageDimensions]);

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
      <div className="bg-slate-700/60 px-3 py-1.5 border-b border-slate-600 flex items-center gap-3 text-sm">
        <h2 className="font-medium text-slate-200 truncate">
          {floorData.regionName} · {floorData.locationName} · {floorData.floorName}
        </h2>

        {/* Status messages sit inline rather than on their own row. */}
        {connectingDoorId && !editMode && (
          <span className="text-blue-400 text-xs shrink-0">Choosing a link target…</span>
        )}
        {editMode && (
          <span className="text-red-400 text-xs shrink-0">
            🔧 Edit: click a linked door to disconnect
          </span>
        )}
        {highlightedDoorId && !editMode && !connectingDoorId && (
          <span className="text-purple-400 text-xs shrink-0">⭐ Linked door shown</span>
        )}
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
        
        <div
          className="max-w-full max-h-full relative"
          // On the wrapper rather than the image, so the readout keeps updating
          // while the pointer is over a marker — which is exactly when you want
          // it, because that is how you say "this one is in the wrong place".
          onMouseMove={(e) => {
            const image = imgRef.current;
            if (!image?.naturalWidth) return;
            const rect = image.getBoundingClientRect();
            setCursor({
              x: Math.round((e.clientX - rect.left) / rect.width * image.naturalWidth),
              y: Math.round((e.clientY - rect.top) / rect.height * image.naturalHeight),
              scale: rect.width / image.naturalWidth,
            });
          }}
          onMouseLeave={() => setCursor(null)}
        >
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
                  connectingDoorId={connectingDoorId}
                  highlightedDoorId={highlightedDoorId}
                  editMode={editMode}
                  status={markerStatus?.get(location.id)}
                  linkIgnored={droppedLinks?.get(location.id)}
                  fixedLinkTo={fixedLinks?.get(location.id)}
                  onLocationClick={onLocationClick}
                  onLocationRightClick={onLocationRightClick}
                />
              ))}
            </>
          ) : null}
        </div>

        {cursor && (
          <div className="absolute bottom-2 right-2 pointer-events-none rounded bg-slate-900/85
                          border border-slate-600 px-2 py-1 font-mono text-xs text-slate-300">
            {cursor.x}, {cursor.y}
            {/* Shrink the map to fit and one screen pixel stops being one map
                pixel, so a coordinate read off it is only good to a few. Say so
                rather than let it quietly round. */}
            {cursor.scale < 0.995 && (
              <span className="ml-1.5 text-amber-400">
                ±{Math.ceil(1 / cursor.scale)} · widen for exact
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}