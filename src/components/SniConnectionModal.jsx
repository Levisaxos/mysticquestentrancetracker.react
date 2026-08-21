import React, { useEffect, useState } from 'react';
import { sniService } from '../services/sniService';
import { floorForReading, followCoverage } from '../engine/mapFollow';
import { MAP_DATA } from '../constants/mapData';

const floorNames = new Map();
for (const region of MAP_DATA.regions) {
  for (const location of region.locations) {
    for (const floor of location.floors) {
      floorNames.set(String(floor.id), `${region.name} · ${location.name} · ${floor.name}`);
    }
  }
}

/**
 * Follow the running game.
 *
 * SNI is already running for anyone playing through Archipelago, and it will
 * hand out SNES memory to anything that asks on localhost. Reading the room the
 * player is standing in is enough to move the tracker's view with them.
 *
 * Deliberately shows the raw bytes as well as the conclusion: the mapping from
 * the game's room id to our sheets is derived, not given, and when it picks the
 * wrong sheet the only way to tell why is to see what it read.
 */
export default function SniConnectionModal({ isOpen, onClose, following, onFollowingChange }) {
  const [status, setStatus] = useState(sniService.snapshot());
  const [busy, setBusy] = useState(false);

  useEffect(() => sniService.subscribe(setStatus), []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { reading, unavailable } = status;
  const floorId = reading ? floorForReading(reading) : null;
  const coverage = followCoverage();

  const connect = async () => {
    setBusy(true);
    await sniService.connect();
    setBusy(false);
  };

  const disconnect = async () => {
    setBusy(true);
    await sniService.disconnect();
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="bg-slate-800 rounded-lg border border-slate-600 w-full max-w-lg max-h-full flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Follow the game"
      >
        <div className="px-6 py-4 border-b border-slate-600 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Follow the game</h2>
            <p className="text-sm text-slate-400">
              Reads the room you are standing in from SNI and shows that map
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            Close (Esc)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm">
          {unavailable ? (
            <p className="rounded bg-amber-900/40 border border-amber-700/60 px-3 py-2 text-amber-200">
              Not available here — {unavailable}
            </p>
          ) : (
            <p className="text-slate-400">
              Needs SNI running with your emulator attached, the same SNI the
              Archipelago client uses. Nothing is sent to it; the tracker only reads.
            </p>
          )}

          {status.state === 'error' && status.error && (
            <p className="rounded bg-red-900/40 border border-red-700/60 px-3 py-2 text-red-200">
              {status.error}
            </p>
          )}

          <div className="flex items-center gap-3">
            {status.connected ? (
              <button
                onClick={disconnect}
                disabled={busy}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={busy || Boolean(unavailable)}
                className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Connecting…' : 'Connect to SNI'}
              </button>
            )}
            {status.device && (
              <span className="text-slate-400 truncate">{status.device}</span>
            )}
          </div>

          {status.connected && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={following}
                onChange={(e) => onFollowingChange(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-slate-300">
                Move the map to wherever I am
                <span className="block text-xs text-slate-500">
                  {coverage.reachable} of {coverage.floors} sheets can be reached this way
                </span>
              </span>
            </label>
          )}

          {/* The raw read, because when the wrong sheet comes up this is the
              only thing that says whether the read or the lookup was at fault. */}
          {status.connected && (
            <div className="rounded border border-slate-700 bg-slate-900/50 p-3 font-mono text-xs space-y-1">
              {reading ? (
                <>
                  <div className="text-slate-400">
                    sub map <span className="text-slate-200">
                      ${reading.subMapId.toString(16).padStart(2, '0')}
                    </span> ({reading.subMapId})
                    · map <span className="text-slate-200">
                      ${reading.mapId.toString(16).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    at tile <span className="text-slate-200">{reading.x}, {reading.y}</span>
                    · facing <span className="text-slate-200">{reading.facing}</span>
                  </div>
                  <div className={floorId ? 'text-green-400' : 'text-amber-400'}>
                    {floorId
                      ? floorNames.get(String(floorId)) ?? `floor ${floorId}`
                      : 'no sheet matches this room yet'}
                  </div>
                </>
              ) : (
                <div className="text-slate-500">waiting for a read…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
