/**
 * Reading the running game over SNI.
 *
 * SNI is already on every FFMQ Archipelago player's machine — the AP client
 * needs it — and it exposes a usb2snes-compatible WebSocket on
 * ws://localhost:23074 by default. That lets the tracker read SNES memory
 * directly, which Archipelago itself cannot offer: the AP protocol carries
 * checks and items but nothing about where the player is standing.
 *
 * Reading the emulator rather than the server also means this works on a plain
 * FFMQR seed, with no Archipelago at all.
 *
 * See docs/MAP-AUTOTRACKING.md for the investigation behind the addresses.
 */

const SNI_URL = 'ws://localhost:23074';
const CLIENT_NAME = 'Mystic Quest Entrance Tracker';

// usb2snes maps SNES WRAM ($7E0000-$7FFFFF) into its own space at $F50000, so
// $7E0E88 is read as $F50E88. The Archipelago FFMQ client reads $7E0EA8 as
// 0xF50EA8, which is where that mapping is confirmed rather than assumed.
const WRAM_BASE = 0xF50000;
const MAP_BLOCK_ADDRESS = WRAM_BASE + 0x0E88;
const MAP_BLOCK_LENGTH = 10; // $0E88 through $0E91 inclusive

// Offsets within that block, from the Data Crystal RAM map.
const MAP_ID = 0x0E88 - 0x0E88;
const PLAYER_X = 0x0E89 - 0x0E88;
const PLAYER_Y = 0x0E8A - 0x0E88;
const FACING = 0x0E8B - 0x0E88;
const SUB_MAP_ID = 0x0E91 - 0x0E88;

const POLL_MS = 300;

/**
 * Why we cannot even try, if we cannot.
 *
 * A page served over https may not open a ws:// socket — it is mixed content —
 * and SNI serves no TLS, so there is no wss:// to connect to instead. That
 * makes this a local-build feature, and saying so up front beats a connect
 * button that spins forever on the deployed site.
 */
export function unavailableReason() {
  if (typeof window === 'undefined') return 'no browser';
  if (typeof WebSocket === 'undefined') return 'this browser has no WebSocket support';
  if (window.location.protocol === 'https:') {
    return 'the deployed site is served over https, which cannot open a ws:// connection to SNI. Run the tracker locally to use this.';
  }
  return null;
}

class SniService {
  constructor() {
    this.socket = null;
    this.state = 'disconnected'; // disconnected | connecting | connected | error
    this.error = null;
    this.device = null;
    this.reading = null; // { mapId, subMapId, x, y, facing, at }
    this.listeners = new Set();
    this.pending = [];
    this.pollTimer = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    return {
      state: this.state,
      error: this.error,
      device: this.device,
      reading: this.reading,
      connected: this.state === 'connected',
      unavailable: unavailableReason(),
    };
  }

  _emit() {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }

  _set(state, { error = null } = {}) {
    this.state = state;
    this.error = error;
    this._emit();
  }

  /**
   * One usb2snes request.
   *
   * The protocol answers informational opcodes with JSON text and memory reads
   * with raw binary, on the same socket and with no request ids — so replies
   * are matched to requests by order, and each request has to say which shape
   * it expects. A read may also arrive split across several frames, hence the
   * byte count rather than a single-frame assumption.
   */
  _request(message, expect) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('not connected to SNI'));
        return;
      }
      if (expect) this.pending.push({ expect, resolve, reject, chunks: [], got: 0 });
      this.socket.send(JSON.stringify(message));
      if (!expect) resolve(null);
    });
  }

  _onMessage(data) {
    const waiter = this.pending[0];
    if (!waiter) return;

    if (typeof data === 'string') {
      this.pending.shift();
      try {
        waiter.resolve(JSON.parse(data));
      } catch (error) {
        waiter.reject(error);
      }
      return;
    }

    const chunk = new Uint8Array(data);
    waiter.chunks.push(chunk);
    waiter.got += chunk.length;
    if (waiter.got < waiter.expect.bytes) return;

    this.pending.shift();
    const out = new Uint8Array(waiter.got);
    let at = 0;
    for (const part of waiter.chunks) { out.set(part, at); at += part.length; }
    waiter.resolve(out);
  }

  async connect() {
    const unavailable = unavailableReason();
    if (unavailable) {
      this._set('error', { error: unavailable });
      return this.snapshot();
    }
    if (this.state === 'connecting' || this.state === 'connected') return this.snapshot();

    await this.disconnect();
    this._set('connecting');

    try {
      const socket = await this._open();
      this.socket = socket;

      const list = await this._request(
        { Opcode: 'DeviceList', Space: 'SNES' },
        { kind: 'json' }
      );
      const device = list?.Results?.[0];
      if (!device) {
        throw new Error('SNI is running but no device is attached — start your emulator and connect it to SNI first.');
      }

      await this._request({ Opcode: 'Attach', Space: 'SNES', Operands: [device] });
      await this._request({ Opcode: 'Name', Space: 'SNES', Operands: [CLIENT_NAME] });

      this.device = device;
      this._set('connected');

      // Read once immediately: waiting a poll interval to show anything makes a
      // working connection look broken.
      await this._poll();
      this.pollTimer = setInterval(() => { this._poll(); }, POLL_MS);

      return this.snapshot();
    } catch (error) {
      await this.disconnect();
      this._set('error', { error: describeError(error) });
      return this.snapshot();
    }
  }

  _open() {
    return new Promise((resolve, reject) => {
      let socket;
      try {
        socket = new WebSocket(SNI_URL);
      } catch (error) {
        reject(error);
        return;
      }
      socket.binaryType = 'arraybuffer';

      const failed = () => reject(new Error(
        'could not reach SNI on localhost:23074 — check that SNI is running.'
      ));

      socket.onopen = () => {
        socket.onerror = () => this._set('error', { error: 'lost the connection to SNI' });
        socket.onclose = () => {
          if (this.state !== 'disconnected') this.disconnect();
        };
        socket.onmessage = (event) => this._onMessage(event.data);
        resolve(socket);
      };
      socket.onerror = failed;
      socket.onclose = failed;
    });
  }

  async _poll() {
    if (this.state !== 'connected') return;
    try {
      const bytes = await this._request(
        {
          Opcode: 'GetAddress',
          Space: 'SNES',
          Operands: [MAP_BLOCK_ADDRESS.toString(16), MAP_BLOCK_LENGTH.toString(16)],
        },
        { kind: 'binary', bytes: MAP_BLOCK_LENGTH }
      );

      const reading = {
        mapId: bytes[MAP_ID],
        subMapId: bytes[SUB_MAP_ID],
        x: bytes[PLAYER_X],
        y: bytes[PLAYER_Y],
        facing: bytes[FACING],
      };

      const before = this.reading;
      this.reading = reading;
      // Only wake the UI when something actually moved. At three polls a second
      // an unconditional emit re-renders the tracker for no reason.
      if (!before
        || before.subMapId !== reading.subMapId
        || before.mapId !== reading.mapId
        || before.x !== reading.x
        || before.y !== reading.y
        || before.facing !== reading.facing) {
        this._emit();
      }
    } catch {
      // A failed read mid-session is usually the emulator being closed; the
      // socket's own close handler deals with it.
    }
  }

  async disconnect() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    for (const waiter of this.pending) waiter.reject(new Error('disconnected'));
    this.pending = [];

    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.onopen = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.onmessage = null;
      try { socket.close(); } catch { /* already gone */ }
    }

    this.device = null;
    this.reading = null;
    if (this.state !== 'disconnected') this._set('disconnected');
  }
}

function describeError(error) {
  const message = error?.message ?? String(error);
  return message.replace(/^Error:\s*/, '');
}

export const sniService = new SniService();
