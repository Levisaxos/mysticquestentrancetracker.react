import React, { useEffect, useMemo } from 'react';
import { groupUnexploredExits } from '../engine/exits';

/**
 * Where you can still go but haven't yet.
 *
 * This is the question an entrance tracker exists to answer, and it comes
 * straight out of the reachability pass rather than being maintained by hand.
 */
export default function UnexploredExitsModal({ isOpen, unexploredExits, onClose, onGoToFloor }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const grouped = useMemo(
    () => groupUnexploredExits(unexploredExits ?? new Set()),
    [unexploredExits]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="bg-slate-800 rounded-lg border border-slate-600 w-full max-w-2xl max-h-full flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Unexplored exits"
      >
        <div className="px-6 py-4 border-b border-slate-600 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Where you can still go</h2>
            <p className="text-sm text-slate-400">
              {grouped.total} exit{grouped.total === 1 ? '' : 's'} you can reach but have not followed
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            Close (Esc)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!grouped.groups.length && !grouped.unmapped && (
            <p className="text-slate-400 text-center py-8">
              Nothing left to explore from where you can currently reach.
            </p>
          )}

          {grouped.groups.map((group) => (
            <div key={group.floorId} className="mb-3">
              <button
                onClick={() => { onGoToFloor(group); onClose(); }}
                className="w-full text-left px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded transition-colors"
              >
                <div className="text-slate-200 text-sm font-medium">
                  {group.locationName} · {group.floorName}
                </div>
                <div className="text-xs text-slate-500">
                  {group.regionName} — {group.exits.length} unexplored
                </div>
                <ul className="mt-1 space-y-0.5">
                  {group.exits.map((exit) => (
                    <li key={exit.entranceId} className="text-xs text-slate-400">
                      <span className="text-slate-300">{exit.name}</span>
                      {exit.canonicalName && exit.canonicalName !== exit.name && (
                        <span className="text-slate-500"> — {exit.canonicalName}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </button>
            </div>
          ))}

          {grouped.unmapped > 0 && (
            <p className="text-xs text-slate-500 mt-4 border-t border-slate-700 pt-3">
              {grouped.unmapped} further exit{grouped.unmapped === 1 ? '' : 's'} are reachable but
              not yet matched to a marker on our maps, so they cannot be listed by floor.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
