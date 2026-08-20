import { Client } from 'archipelago.js';
import { gameService } from './gameService';
import { itemService } from './itemService';
import { locationTrackerService } from './locationTrackerService';
import binding from '../data/binding.json';
import { TOTAL_FRAGMENTS } from '../engine/skyCoin';

const GAME_NAME = 'Final Fantasy Mystic Quest';

/** AP location id -> our marker id, for turning checks into ticked markers. */
const markerByApLocation = new Map();
for (const [markerId, bound] of Object.entries(binding.markers)) {
  if (bound.kind !== 'check') continue;
  if (bound.apLocationId != null) markerByApLocation.set(bound.apLocationId, Number(markerId));
}

/**
 * Slot data keys the FFMQ world sends from 1.7 onward. Their presence is how we
 * tell a 1.7+ room from an older one — feature detection rather than version
 * sniffing, since 1.7 lived in a fork for a while.
 */
function settingsFromSlotData(slotData) {
  if (!slotData || slotData.map_shuffle_seed === undefined) return null;

  const choice = (value, options, fallback) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return options[value] ?? fallback;
    return fallback;
  };

  return {
    mapShuffle: choice(slotData.map_shuffle,
      ['none', 'dungeons_internal', 'dungeons_mixed', 'everything'], 'none'),
    overworldShuffle: Boolean(slotData.overworld_shuffle),
    crestShuffle: Boolean(slotData.crest_shuffle),
    skyCoinMode: choice(slotData.sky_coin_mode,
      ['standard', 'start_with', 'save_the_crystals', 'shattered_sky_coin'], 'standard'),
    shatteredSkyCoinQuantity: choice(slotData.shattered_sky_coin_quantity,
      ['low_16', 'mid_24', 'high_32', 'random_narrow', 'random_wide'], 'mid_24'),
    logic: choice(slotData.logic, ['friendly', 'standard', 'expert'], 'standard'),
  };
}

/**
 * Archipelago connection.
 *
 * Read-only by design: the tracker never sends location checks, because the
 * game client owns that. It listens, and mirrors what it hears into the run.
 *
 * Entrances stay manual regardless — 1.7 does put a map shuffle seed in slot
 * data, which would in principle let the layout be derived, but discovering it
 * is the whole point of the tracker.
 */
class ApService {
  constructor() {
    this.client = null;
    this.state = 'disconnected'; // disconnected | connecting | connected | error
    this.error = null;
    this.info = null; // { host, slot, playerCount, detectedSettings }
    this.gameId = null;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit() {
    for (const listener of this.listeners) listener(this.snapshot());
  }

  snapshot() {
    return {
      state: this.state,
      error: this.error,
      info: this.info,
      connected: this.state === 'connected',
    };
  }

  _set(state, { error = null, info = this.info } = {}) {
    this.state = state;
    this.error = error;
    this.info = info;
    this._emit();
  }

  /**
   * @param {object} options
   * @param {string} options.host     e.g. "archipelago.gg:38281" or "localhost:38281"
   * @param {string} options.slot     the slot (player) name
   * @param {string} [options.password]
   * @param {number} options.gameId   which of our runs to mirror into
   */
  async connect({ host, slot, password = '', gameId }) {
    if (this.state === 'connecting') return this.snapshot();
    await this.disconnect();

    this.gameId = gameId;
    this._set('connecting', { info: { host, slot } });

    try {
      const client = new Client();
      this.client = client;

      client.items.on('itemsReceived', (items) => this._onItems(items));
      client.socket.on('roomUpdate', () => this._syncChecks());
      client.socket.on('disconnected', () => {
        if (this.state === 'connected') this._set('disconnected');
      });

      const slotData = await client.login(host, slot, GAME_NAME, {
        tags: ['Tracker'],
        slotData: true,
      });

      const detectedSettings = settingsFromSlotData(slotData);
      if (detectedSettings) gameService.updateSettings(gameId, detectedSettings);

      this._set('connected', {
        info: {
          host,
          slot,
          playerCount: client.players.slots ? Object.keys(client.players.slots).length : null,
          detectedSettings,
        },
      });

      // Catch up on everything that happened before we joined.
      this._onItems(client.items.received);
      this._syncChecks();

      return this.snapshot();
    } catch (error) {
      this.client = null;
      this._set('error', { error: describeError(error) });
      return this.snapshot();
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        this.client.socket.disconnect();
      } catch {
        // Already gone; nothing to do.
      }
      this.client = null;
    }
    if (this.state !== 'disconnected') this._set('disconnected');
  }

  /** Mirror received items into the run. */
  _onItems(items) {
    if (!this.gameId || !items?.length) return;

    // Count them rather than setting flags: Sky Fragments arrive one at a time
    // and the threshold rule needs the real total.
    const counts = new Map();
    for (const item of items) {
      const name = item?.name;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    for (const [name, count] of counts) {
      if (name === 'Sky Fragment') {
        itemService.setCount(this.gameId, name, Math.min(count, TOTAL_FRAGMENTS));
      } else {
        itemService.setItem(this.gameId, name, true);
      }
    }

    this._emit();
  }

  /** Mirror checked locations into the run's markers. */
  _syncChecks() {
    if (!this.gameId || !this.client) return;

    const checked = this.client.room.checkedLocations ?? [];
    let changed = false;

    for (const apLocationId of checked) {
      const markerId = markerByApLocation.get(apLocationId);
      if (markerId == null) continue;

      const state = locationTrackerService.getLocationState(this.gameId, markerId);
      if (state?.isOpened) continue;

      locationTrackerService.toggleCheck(this.gameId, markerId, state?.floorId ?? null, state?.type ?? 'unknown');
      changed = true;
    }

    if (changed) this._emit();
  }

  /** How many of our markers a checked-location list can actually reach. */
  static coverage() {
    return markerByApLocation.size;
  }
}

function describeError(error) {
  const message = error?.message ?? String(error);

  if (/refused|failed to connect|ECONNREFUSED/i.test(message)) {
    return 'Could not reach that server. Check the host and port, and that the room is running.';
  }
  if (/password/i.test(message)) return 'The room rejected that password.';
  if (/slot|player/i.test(message)) return 'The server did not recognise that slot name.';
  if (/insecure|SecurityError/i.test(message)) {
    return 'The browser blocked an insecure connection. Use wss:// for a remote server '
      + '(localhost is fine over ws://).';
  }
  return message;
}

export const apService = new ApService();
export { settingsFromSlotData, markerByApLocation };
