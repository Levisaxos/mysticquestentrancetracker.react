// Save-format versioning.
//
// Everything lives in localStorage and there is no backend, so a save that we
// fail to read is a run the player has permanently lost. Every format change
// therefore needs a migration, and migrations must be additive and forgiving:
// prefer filling in a missing field over rejecting the record.

export const CURRENT_VERSION = 2;

/**
 * Randomiser settings for a run. These cannot be detected from a save, and on
 * Archipelago 1.7+ they arrive in slot data, so the defaults describe a plain
 * unshuffled game.
 */
export const DEFAULT_SETTINGS = {
  mapShuffle: 'none',
  overworldShuffle: false,
  crestShuffle: false,
  skyCoinMode: 'standard',
  shatteredSkyCoinQuantity: 'mid_24',
};

const defaultState = (locationId) => ({
  locationId,
  floorId: null,
  type: 'unknown',
  isOpened: false,
  isVisited: false,
  isLinked: false,
  isDisabled: false,
  linkedToLocationId: null,
});

/**
 * v1 -> v2
 *
 * v1 had no version field at all — it was a bare array of runs.
 *
 * Two real defects are repaired here:
 *
 *  - `isLinked` / `linkedToLocationId` were never persisted, because the old
 *    linkDoors wrote a stale snapshot over its own changes. `doorConnections`
 *    did survive, so it is the source of truth and the flags are rebuilt from it.
 *  - Door states were written with `floorId: 0`, a placeholder meaning "unknown"
 *    that is indistinguishable from a real floor id. Normalised to null.
 */
function migrateV1toV2(games) {
  return games.map((game) => {
    const doorConnections = { ...(game.doorConnections ?? {}) };
    const locationStates = { ...(game.locationStates ?? {}) };

    for (const [key, value] of Object.entries(doorConnections)) {
      if (!key.startsWith('door_') || typeof value !== 'string') continue;

      const id = parseInt(key.slice(5), 10);
      const partnerId = parseInt(value.slice(5), 10);
      if (Number.isNaN(id) || Number.isNaN(partnerId)) continue;

      const state = locationStates[id] ?? defaultState(id);

      if (id === partnerId) {
        // A self-link used to mean "this is a standalone battleground", which
        // was how you marked one cleared. Battlegrounds are checks now, so
        // translate the intent and drop the fake link.
        locationStates[id] = { ...state, isOpened: true, isLinked: false, linkedToLocationId: null };
        delete doorConnections[key];
      } else {
        locationStates[id] = { ...state, isLinked: true, linkedToLocationId: partnerId };
      }
    }

    // floorId 0 was a placeholder for "unknown", indistinguishable from a real
    // floor id. Normalise it so later code can trust the field.
    for (const [id, state] of Object.entries(locationStates)) {
      if (state.floorId === 0) locationStates[id] = { ...state, floorId: null };
    }

    return { ...game, locationStates, doorConnections };
  });
}

const MIGRATIONS = {
  1: migrateV1toV2,
};

/**
 * Bring a stored payload up to the current version.
 *
 * Accepts either the bare v1 array or a versioned envelope, and always returns
 * `{ version, games }`.
 */
export function migrate(payload) {
  let version;
  let games;

  if (Array.isArray(payload)) {
    version = 1;
    games = payload;
  } else if (payload && Array.isArray(payload.games)) {
    version = Number(payload.version) || 1;
    games = payload.games;
  } else {
    return { version: CURRENT_VERSION, games: [] };
  }

  while (version < CURRENT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break; // unknown gap: keep what we have rather than discarding it
    games = step(games);
    version += 1;
  }

  return { version: CURRENT_VERSION, games: games.map(normaliseGame) };
}

/** Fill in anything a run is missing so the rest of the app can assume it. */
function normaliseGame(game) {
  return {
    id: game.id,
    name: game.name ?? 'Unnamed run',
    startDate: game.startDate ?? new Date(0).toISOString(),
    lastPlayed: game.lastPlayed ?? game.startDate ?? new Date(0).toISOString(),
    finishedDate: game.finishedDate ?? null,
    isFinished: Boolean(game.isFinished),
    locationStates: game.locationStates ?? {},
    doorConnections: game.doorConnections ?? {},
    // Listing fields explicitly means anything not named here is dropped on
    // read. That silently ate the item tracker's state until a test caught it —
    // add new run fields here as well as wherever they are written.
    items: game.items ?? {},
    settings: { ...DEFAULT_SETTINGS, ...(game.settings ?? {}) },
  };
}

/** Is this payload something we can read at all? */
export function isReadableSave(payload) {
  if (Array.isArray(payload)) return payload.every((g) => g && typeof g.id === 'number');
  return Boolean(payload && Array.isArray(payload.games));
}
