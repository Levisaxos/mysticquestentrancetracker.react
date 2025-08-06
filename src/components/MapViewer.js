import React, { useState, useEffect, useRef } from 'react';
import LocationButton from './LocationButton';
import LocationModal from './LocationModal';

export function MapViewer({
  floorData,
  editorMode = 'view',
  onLocationAdd,
  onLocationEdit,
  onLocationDelete,
  onLocationConnect,
  onCancelConnect,
  locations = [],
  battlegroundCounter = 1,
  getNextFloorCounter
}) {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [loadedImagePath, setLoadedImagePath] = useState(null);
  const [successfulPath, setSuccessfulPath] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [editingLocation, setEditingLocation] = useState(null);
  const imgRef = useRef(null);

  // Simple image loading
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
      console.log('✅ Image loaded successfully:', imagePath);
      setSuccessfulPath(imagePath);
      setIsImageLoading(false);
      setImageError(false);
      setLoadedImagePath(imagePath);

      // Update image dimensions when image loads
      updateImageDimensions();
    };

    testImg.onerror = () => {
      console.log('❌ Failed to load image:', imagePath);
      setImageError(true);
      setIsImageLoading(false);
    };

    testImg.src = imagePath;
  };

  // Update image dimensions when image loads or container resizes
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

  // Reset states when floorData changes
  useEffect(() => {
    if (!floorData) {
      setLoadedImagePath(null);
      setIsImageLoading(false);
      setImageError(false);
      setSuccessfulPath(null);
      setImageDimensions(null);
      return;
    }

    // Only start loading if the image path is different
    if (floorData.imagePath !== loadedImagePath) {
      loadImage(floorData.imagePath);
    }
  }, [floorData, loadedImagePath]);

  // Set up resize observer for responsive scaling
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateImageDimensions();
    });

    if (imgRef.current) {
      resizeObserver.observe(imgRef.current);
    }

    // Add global context menu prevention
    const handleGlobalContextMenu = (e) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleGlobalContextMenu);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  }, [successfulPath]);

  // Get locations for current floor
  const getLocationsForFloor = () => {
    return locations;
  };

  // Handle location button clicks
  const handleLocationClick = (location) => {
    console.log('Location clicked:', location);

    if (editorMode === 'edit') {
      // Left-click in edit mode = edit location
      setEditingLocation(location);
      setModalPosition({ x: location.x, y: location.y });
      setIsModalOpen(true);
    } else if (editorMode === 'connect' && location.type === 'door') {
      // Handle door connection logic
      if (onLocationConnect) {
        onLocationConnect(location);
      }
    } else if (editorMode === 'view') {
      // Normal view mode - show location details
      alert(`Clicked: ${location.name}\nDescription: ${location.description}`);
    }
  };

  const handleLocationRightClick = (location) => {
    console.log('Location right-clicked:', location);

    if (editorMode === 'view') {
      // Right-click in view mode = show context menu
      alert(`Right-clicked: ${location.name}\nType: ${location.type}`);
    }
    // In all other modes, right-click on locations does nothing
  };

  // Handle map clicks for placing new locations
  const handleMapClick = (event) => {
    if (editorMode === 'connect' && event.button === 2) {
      // Right-click in connect mode = cancel connection
      event.preventDefault();
      if (onCancelConnect) {
        onCancelConnect();
      }
      return;
    }

    if (editorMode !== 'place' && editorMode !== 'containers') return;

    // Prevent default browser behavior for all mouse buttons
    event.preventDefault();

    const rect = imgRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Convert to natural image coordinates and round to integers
    const naturalX = Math.round((clickX / imageDimensions.width) * imageDimensions.naturalWidth);
    const naturalY = Math.round((clickY / imageDimensions.height) * imageDimensions.naturalHeight);

    let locationType = null;
    let showModal = true;
    let locationName = null;

    if (editorMode === 'place') {
      // Place Doors mode
      switch (event.button) {
        case 0: // Left click - Named Door (show modal)
          locationType = 'door';
          showModal = true;
          break;
        case 2: // Right click - Battleground (no modal)
          locationType = 'battleground';
          locationName = `Battleground #${battlegroundCounter}`;
          showModal = false;
          break;
        default:
          return;
      }
    } else if (editorMode === 'containers') {
      // Add Chests/Boxes mode
      switch (event.button) {
        case 0: // Left click - Chest (auto-named)
          locationType = 'chest';
          locationName = `Chest #${getNextFloorCounter(floorData.floorId, 'chest')}`;
          showModal = false;
          break;
        case 2: // Right click - Box (auto-named)
          locationType = 'box';
          locationName = `Box #${getNextFloorCounter(floorData.floorId, 'box')}`;
          showModal = false;
          break;
        default:
          return;
      }
    }

    if (showModal) {
      // Show modal for naming
      setModalPosition({ x: naturalX, y: naturalY });
      setEditingLocation(null); // Always null for new locations
      setIsModalOpen(true);

      // Store the location type in modal position for the modal to use
      setModalPosition({ x: naturalX, y: naturalY, type: locationType });
    } else {
      // Create location directly (Battleground case)
      const locationData = {
        name: locationName,
        type: locationType,
        x: naturalX,
        y: naturalY
      };

      if (onLocationAdd) {
        onLocationAdd(floorData.floorId, locationData);
      }
    }
  };

  const getDefaultLocationName = (type) => {
    switch (type) {
      case 'door': return 'Door';
      case 'chest': return 'Treasure Chest';
      case 'box': return 'Storage Box';
      default: return 'Location';
    }
  };

  // Handle modal save
  const handleModalSave = (locationData) => {
    if (editingLocation) {
      // Editing existing location
      if (onLocationEdit) {
        onLocationEdit(locationData);
      }
    } else {
      // Adding new location
      if (onLocationAdd) {
        onLocationAdd(floorData.floorId, locationData);
      }
    }
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
                <p className="text-slate-600 text-xs mt-2">
                  Path: {floorData.imagePath}
                </p>
              </div>
            </div>
          ) : successfulPath ? (
            <>
              <img
                ref={imgRef}
                src={successfulPath}
                alt={`${floorData.regionName} - ${floorData.locationName} - ${floorData.floorName}`}
                className={`max-w-full max-h-full object-contain rounded shadow-lg ${editorMode === 'place' || editorMode === 'containers' ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                onLoad={updateImageDimensions}
                onMouseDown={handleMapClick}
                onContextMenu={(e) => e.preventDefault()} // Prevent browser context menu
              />

              {/* Render location buttons */}
              {imageDimensions && getLocationsForFloor().map(location => (
                <LocationButton
                  key={location.id}
                  location={location}
                  onClick={handleLocationClick}
                  onRightClick={handleLocationRightClick}
                  imageDimensions={imageDimensions}
                  isReadOnly={editorMode === 'view'}
                />
              ))}
            </>
          ) : null}
        </div>

        {/* Location Modal */}
        <LocationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
          onDelete={onLocationDelete}
          position={modalPosition}
          existingLocation={editingLocation}
        />
      </div>
    </div>
  );
}