import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LOCATIONS_DATA } from '../constants/locationsData';
import { locationTrackerService } from '../services/locationTrackerService';
import { assetUrl } from '../utils/assetUrl';

/**
 * Pick the entrance a door links to.
 *
 * The old flow was: click door A, remember where you're going, navigate there
 * through three dropdowns, click door B. Across 121 floors that was the main
 * friction in the tool. Here you click a door, find the target, click it.
 */
export default function LinkPickerModal({
  isOpen,
  gameId,
  sourceLocation,
  sourceFloorData,
  navigationService,
  onLink,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const searchRef = useRef(null);
  const imgRef = useRef(null);

  const allFloors = useMemo(() => navigationService.getAllFloorData(), [navigationService]);

  // Which doors on each floor are still free? Drives both the counts in the list
  // and the ordering, since a floor with nothing left is rarely the target.
  const floorSummaries = useMemo(() => {
    if (!isOpen) return [];

    return allFloors.map((floor) => {
      const doors = (LOCATIONS_DATA[String(floor.floorId)] ?? []).filter((m) => m.type === 'door');
      const unlinked = doors.filter((door) => {
        if (door.id === sourceLocation?.id) return false;
        return !locationTrackerService.getLinkedDoor(gameId, door.id);
      });
      return { ...floor, doorCount: doors.length, unlinkedCount: unlinked.length };
    });
  }, [isOpen, allFloors, gameId, sourceLocation]);

  // Open on the floor you were already looking at: linking two doors on the same
  // screen stays a two-click operation.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedFloorId(sourceFloorData?.floorId ?? allFloors[0]?.floorId ?? null);
    setImageDimensions(null);
  }, [isOpen, sourceFloorData, allFloors]);

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const filteredFloors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? floorSummaries.filter((floor) =>
          `${floor.regionName} ${floor.locationName} ${floor.floorName}`.toLowerCase().includes(needle))
      : floorSummaries;

    // Floors that still have free doors first — those are the plausible targets.
    return [...matches].sort((a, b) =>
      (b.unlinkedCount > 0) - (a.unlinkedCount > 0) || a.globalIndex - b.globalIndex);
  }, [floorSummaries, query]);

  const selectedFloor = useMemo(
    () => floorSummaries.find((f) => f.floorId === selectedFloorId) ?? null,
    [floorSummaries, selectedFloorId]
  );

  const targetDoors = useMemo(() => {
    if (!selectedFloor) return [];
    return (LOCATIONS_DATA[String(selectedFloor.floorId)] ?? []).filter((m) => m.type === 'door');
  }, [selectedFloor]);

  if (!isOpen || !sourceLocation) return null;

  const measure = () => {
    if (!imgRef.current?.complete) return;
    setImageDimensions({
      width: imgRef.current.clientWidth,
      height: imgRef.current.clientHeight,
      naturalWidth: imgRef.current.naturalWidth,
      naturalHeight: imgRef.current.naturalHeight,
    });
  };

  const describeDoor = (door) => {
    if (door.id === sourceLocation.id) return { disabled: true, reason: 'this is the door you are linking from' };

    const linkedTo = locationTrackerService.getLinkedDoor(gameId, door.id);
    if (linkedTo) return { disabled: true, reason: `already linked to location ${linkedTo}` };

    const state = locationTrackerService.getLocationState(gameId, door.id);
    if (state?.isDisabled) return { disabled: true, reason: 'marked as unusable' };

    return { disabled: false, reason: 'click to link' };
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="bg-slate-800 rounded-lg border border-slate-600 w-full max-w-6xl max-h-full flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Link ${sourceLocation.name}`}
      >
        <div className="px-6 py-4 border-b border-slate-600 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-100 truncate">
              Link “{sourceLocation.name}”
            </h2>
            {sourceFloorData && (
              <p className="text-sm text-slate-400 truncate">
                from {sourceFloorData.regionName} · {sourceFloorData.locationName} · {sourceFloorData.floorName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors shrink-0"
          >
            Cancel (Esc)
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Floor browser */}
          <div className="w-72 border-r border-slate-700 flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-700">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 121 floors…"
                className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-20 focus:outline-none"
              />
            </div>

            <ul className="flex-1 overflow-y-auto">
              {filteredFloors.map((floor) => (
                <li key={floor.floorId}>
                  <button
                    onClick={() => setSelectedFloorId(floor.floorId)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors border-l-2 ${
                      floor.floorId === selectedFloorId
                        ? 'bg-slate-700 border-blue-400 text-white'
                        : 'border-transparent text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="truncate">{floor.locationName} · {floor.floorName}</div>
                    <div className="text-xs text-slate-500 flex justify-between gap-2">
                      <span className="truncate">{floor.regionName}</span>
                      <span className={floor.unlinkedCount ? 'text-blue-400' : 'text-slate-600'}>
                        {floor.unlinkedCount}/{floor.doorCount} free
                      </span>
                    </div>
                  </button>
                </li>
              ))}
              {!filteredFloors.length && (
                <li className="px-3 py-6 text-sm text-slate-500 text-center">No floors match “{query}”.</li>
              )}
            </ul>
          </div>

          {/* Map with clickable targets */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedFloor ? (
              <>
                <div className="px-4 py-2 border-b border-slate-700 text-sm text-slate-300 shrink-0">
                  {selectedFloor.regionName} · {selectedFloor.locationName} · {selectedFloor.floorName}
                  <span className="text-slate-500"> — click a door to link it</span>
                </div>

                <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
                  <div className="relative">
                    <img
                      ref={imgRef}
                      src={assetUrl(selectedFloor.imagePath)}
                      alt={selectedFloor.floorName}
                      className="max-w-full object-contain rounded shadow-lg"
                      onLoad={measure}
                    />

                    {imageDimensions && targetDoors.map((door) => {
                      const { disabled, reason } = describeDoor(door);
                      const scaleX = imageDimensions.width / imageDimensions.naturalWidth;
                      const scaleY = imageDimensions.height / imageDimensions.naturalHeight;

                      return (
                        <button
                          key={door.id}
                          disabled={disabled}
                          onClick={() => onLink(door, selectedFloor.floorId)}
                          title={`${door.name} — ${reason}`}
                          style={{
                            left: `${door.x * scaleX}px`,
                            top: `${door.y * scaleY}px`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          className={`absolute w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold text-white transition-all ${
                            disabled
                              ? 'bg-slate-600/50 border-slate-500 cursor-not-allowed opacity-50'
                              : 'bg-blue-600 border-blue-300 hover:bg-blue-400 hover:scale-125 cursor-pointer focus:ring-2 focus:ring-white focus:outline-none'
                          }`}
                        >
                          ?
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                Pick a floor to see its doors.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
