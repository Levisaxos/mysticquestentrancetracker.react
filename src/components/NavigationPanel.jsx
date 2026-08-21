import React, { useState, useEffect } from 'react';
import { apService } from '../services/apService';
import { locationTrackerService } from '../services/locationTrackerService';
import { LOCATIONS_DATA } from '../constants/locationsData';

/**
 * Navigation and per-floor progress, as a sidebar column.
 *
 * This used to be a full-width strip above the map. The map is the thing people
 * actually look at, and the strip was costing it a band of vertical space on
 * every screen, so it lives in the sidebar now: the selects stack without
 * crowding and the map gets the height back.
 */
export default function NavigationPanel({
  currentRegionId,
  currentLocationId,
  currentFloorId,
  onRegionChange,
  onLocationChange,
  onFloorChange,
  navigationService,
  onPrevious,
  onNext,
  onWorldMap,
  canNavigatePrevious,
  canNavigateNext,
  gameId,
  refreshTrigger,
  editMode,
  onToggleEditMode,
  onCloseGame,
  doorsLeft = 0,
  checksLeft = 0,
  onShowExits,
  onShowArchipelago,
  onShowFollowGame,
  following,
  shuffleConfigured,
  onShowSettings,
  droppedLinks,
}) {
  const [stats, setStats] = useState({ doors: [0, 0], chests: [0, 0], boxes: [0, 0], battlegrounds: [0, 0] });
  const [ap, setAp] = useState(apService.snapshot());

  useEffect(() => apService.subscribe(setAp), []);

  const regions = navigationService.getRegions();
  const locations = currentRegionId ? navigationService.getLocationsForRegion(currentRegionId) : [];
  const floors = (currentRegionId && currentLocationId)
    ? navigationService.getFloorsForLocation(currentRegionId, currentLocationId)
    : [];

  useEffect(() => {
    if (!gameId || !currentFloorId) {
      setStats({ doors: [0, 0], chests: [0, 0], boxes: [0, 0], battlegrounds: [0, 0] });
      return;
    }

    const markers = LOCATIONS_DATA[currentFloorId] ?? [];
    const of = (type) => markers.filter((m) => m.type === type);
    const opened = (list) => list.filter((m) => locationTrackerService.getLocationState(gameId, m.id)?.isOpened).length;

    const doors = of('door');
    const linked = doors.filter((d) => locationTrackerService.getLinkedDoor(gameId, d.id)).length;

    setStats({
      doors: [linked, doors.length],
      chests: [opened(of('chest')), of('chest').length],
      boxes: [opened(of('box')), of('box').length],
      battlegrounds: [opened(of('battleground')), of('battleground').length],
    });
  }, [gameId, currentFloorId, refreshTrigger]);

  const select = (id, label, value, onChange, options, disabled) => (
    <div>
      <label htmlFor={id} className="block text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="w-full bg-slate-700 text-slate-200 rounded px-2 py-1 text-xs border border-slate-600 focus:border-blue-400 focus:outline-none disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </div>
  );

  const tile = ([done, total], label, colour) => (
    <div className="bg-slate-700/60 rounded px-1.5 py-1 text-center">
      <div className={`${colour} font-bold text-sm leading-tight`}>{done}/{total}</div>
      <div className="text-[9px] text-slate-400 leading-tight">{label}</div>
    </div>
  );

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-2.5 space-y-2">
      <div className="space-y-1.5">
        {select('region-select', 'Region', currentRegionId, onRegionChange, regions, false)}
        {select('location-select', 'Location', currentLocationId, onLocationChange, locations, !currentRegionId)}
        {select('floor-select', 'Floor', currentFloorId, onFloorChange, floors, !currentLocationId)}
      </div>

      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={onPrevious}
          disabled={!canNavigatePrevious}
          title="Previous floor"
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded py-1 text-xs transition-colors"
        >
          ‹ Prev
        </button>
        <button
          onClick={onWorldMap}
          title="Go to the world map"
          className="bg-blue-600 hover:bg-blue-500 text-white rounded py-1 text-xs transition-colors"
        >
          🌍 World
        </button>
        <button
          onClick={onNext}
          disabled={!canNavigateNext}
          title="Next floor"
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded py-1 text-xs transition-colors"
        >
          Next ›
        </button>
      </div>

      {gameId && currentFloorId && (
        <div className="grid grid-cols-4 gap-1">
          {tile(stats.doors, 'Doors', 'text-blue-400')}
          {tile(stats.chests, 'Chests', 'text-amber-400')}
          {tile(stats.boxes, 'Boxes', 'text-orange-400')}
          {tile(stats.battlegrounds, 'Battle', 'text-purple-400')}
        </div>
      )}

      {/* With no shuffle configured every door already has a known destination,
          so a doors-left count is technically true and completely unhelpful.
          Say why instead, and offer the fix. */}
      {shuffleConfigured ? (
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={onShowExits}
            title="Doors you can reach but have not linked yet"
            className="bg-emerald-700 hover:bg-emerald-600 text-white rounded px-1 py-1 transition-colors text-center"
          >
            <div className="font-bold text-sm leading-tight">{doorsLeft}</div>
            <div className="text-[9px] leading-tight opacity-90">Doors left</div>
          </button>

          <div
            title="Chests, boxes and battlegrounds you can reach but have not collected"
            className="bg-amber-700/80 text-white rounded px-1 py-1 text-center"
          >
            <div className="font-bold text-sm leading-tight">{checksLeft}</div>
            <div className="text-[9px] leading-tight opacity-90">Checks left</div>
          </div>
        </div>
      ) : (
        <button
          onClick={onShowSettings}
          title="No shuffle is configured, so nothing counts as unexplored. Set the run's shuffle settings to match your seed."
          className="w-full bg-amber-800/70 hover:bg-amber-700 text-amber-100 rounded py-1.5 text-xs font-medium transition-colors"
        >
          ⚙ No shuffle set — configure
        </button>
      )}

      {onShowArchipelago && (
        <button
          onClick={onShowArchipelago}
          title={ap.connected
            ? `Connected to ${ap.info?.host} as ${ap.info?.slot}`
            : 'Connect to an Archipelago room to fill in items and checks automatically'}
          className={`w-full rounded py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
            ap.state === 'connected' ? 'bg-green-800/70 hover:bg-green-700 text-green-100'
              : ap.state === 'connecting' ? 'bg-blue-800/70 text-blue-100'
              : ap.state === 'error' ? 'bg-red-900/60 hover:bg-red-800 text-red-200'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${
            ap.state === 'connected' ? 'bg-green-400'
              : ap.state === 'connecting' ? 'bg-blue-400 animate-pulse'
              : ap.state === 'error' ? 'bg-red-400'
              : 'bg-slate-500'
          }`} />
          {ap.state === 'connected' ? 'Archipelago connected'
            : ap.state === 'connecting' ? 'Connecting…'
            : ap.state === 'error' ? 'Archipelago failed'
            : 'Archipelago'}
        </button>
      )}

      {onShowFollowGame && (
        <button
          onClick={onShowFollowGame}
          title={following
            ? 'The map is following the room you are standing in'
            : 'Read the room you are in from SNI and show that map'}
          className={`w-full rounded py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
            following ? 'bg-green-800/70 hover:bg-green-700 text-green-100'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${following ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
          {following ? 'Following the game' : 'Follow the game'}
        </button>
      )}

      {/* A link the logic silently ignored is indistinguishable from one it
          honoured, which makes the whole map untrustworthy. Say it out loud,
          and say which of the two causes it is — they have different fixes. */}
      {droppedLinks?.size > 0 && (() => {
        const reasons = [...droppedLinks.values()];
        const notShuffled = reasons.filter((r) => r === 'not-shuffled').length;
        const unmapped = reasons.filter((r) => r === 'unmapped').length;

        return (
          <div className="w-full rounded py-1.5 px-2 text-[11px] bg-amber-950/50 border border-amber-800/60 text-amber-300 leading-snug">
            ⚠ {droppedLinks.size} link{droppedLinks.size === 1 ? '' : 's'} ignored by logic
            {notShuffled > 0 && (
              <button
                onClick={onShowSettings}
                className="block text-left text-amber-400 hover:text-amber-200 underline decoration-dotted"
                title="Your Map Shuffle setting says these doors are not shuffled, so their links are discarded."
              >
                {notShuffled} because Map Shuffle excludes them — fix settings
              </button>
            )}
            {unmapped > 0 && (
              <span className="block text-amber-500/80">
                {unmapped} because a marker is not mapped yet
              </span>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-1">
        {onCloseGame && (
          <button
            onClick={onCloseGame}
            title="Close this run and go back to the games list"
            className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded py-1 text-xs transition-colors"
          >
            Close Run
          </button>
        )}
        <button
          onClick={onToggleEditMode}
          title={editMode ? 'Leave edit mode' : 'Edit mode: click a linked door to disconnect it'}
          className={`rounded py-1 text-xs transition-colors ${
            editMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {editMode ? 'Exit Edit' : 'Edit'}
        </button>
      </div>
    </div>
  );
}
