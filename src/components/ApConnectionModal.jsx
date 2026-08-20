import React, { useEffect, useState } from 'react';
import { apService, markerByApLocation } from '../services/apService';
import checks from '../data/ffmq/checks.json';

const REMEMBERED = 'ap_connection_details';

/**
 * Connect to an Archipelago room.
 *
 * The tracker joins read-only — it never sends checks, the game client does
 * that. It mirrors received items and checked locations into the run, and on
 * 1.7+ it also reads the shuffle settings out of slot data so the logic
 * configures itself.
 */
export default function ApConnectionModal({ isOpen, gameId, onClose, onChange }) {
  const [form, setForm] = useState({ host: 'archipelago.gg:38281', slot: '', password: '' });
  const [status, setStatus] = useState(apService.snapshot());
  const [busy, setBusy] = useState(false);

  useEffect(() => apService.subscribe((next) => {
    setStatus(next);
    onChange?.();
  }), [onChange]);

  useEffect(() => {
    if (!isOpen) return undefined;

    // Host and slot are worth remembering between sessions; the password is not
    // written anywhere.
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBERED) ?? 'null');
      if (saved) setForm((f) => ({ ...f, host: saved.host ?? f.host, slot: saved.slot ?? '' }));
    } catch {
      // Ignore unreadable preferences.
    }

    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);

    localStorage.setItem(REMEMBERED, JSON.stringify({ host: form.host, slot: form.slot }));
    await apService.connect({ ...form, gameId });

    setBusy(false);
  };

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="mb-3">
      <label htmlFor={`ap-${key}`} className="block text-slate-300 text-sm font-medium mb-1">
        {label}
      </label>
      <input
        id={`ap-${key}`}
        type={type}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600 focus:border-blue-400 focus:outline-none"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="bg-slate-800 rounded-lg border border-slate-600 w-full max-w-md p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Archipelago connection"
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-semibold text-slate-100">Archipelago</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            Close (Esc)
          </button>
        </div>

        <StatusLine status={status} />

        {status.connected ? (
          <>
            <dl className="text-sm text-slate-300 space-y-1 my-4">
              <Row label="Server" value={status.info?.host} />
              <Row label="Slot" value={status.info?.slot} />
              <Row
                label="Settings"
                value={status.info?.detectedSettings
                  ? 'read from the room automatically'
                  : 'not sent by this room — set them by hand'}
              />
              <Row label="Items" value="all tracked" />
              <Row
                label="Checks"
                value={`${markerByApLocation.size} of ${checks.length} can be ticked`}
              />
            </dl>

            {markerByApLocation.size < checks.length && (
              <p className="text-xs text-amber-400/90 bg-amber-950/30 border border-amber-800/50 rounded px-3 py-2 mb-4">
                Items and settings come through in full, but only{' '}
                {Math.round((markerByApLocation.size / checks.length) * 100)}% of checks can be
                ticked off on the map yet — most chests and boxes are not matched to a
                marker. Those still need ticking by hand.
              </p>
            )}

            <button
              onClick={() => apService.disconnect()}
              className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded font-medium transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4">
            {field('host', 'Server', 'text', 'archipelago.gg:38281')}
            {field('slot', 'Slot name', 'text', 'your player name')}
            {field('password', 'Password', 'password', 'only if the room has one')}

            <button
              type="submit"
              disabled={busy || !form.host.trim() || !form.slot.trim()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
            >
              {busy ? 'Connecting…' : 'Connect'}
            </button>

            <p className="text-xs text-slate-500 mt-3">
              The tracker only listens — it never sends checks, and entrances stay
              yours to discover. A room on your own machine works over
              <code className="text-slate-400"> ws://localhost:38281</code>; a remote
              one needs <code className="text-slate-400">wss://</code>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-300 truncate">{value ?? '—'}</dd>
    </div>
  );
}

function StatusLine({ status }) {
  const styles = {
    connected: 'bg-green-900/40 border-green-700 text-green-300',
    connecting: 'bg-blue-900/40 border-blue-700 text-blue-300',
    error: 'bg-red-900/40 border-red-700 text-red-300',
    disconnected: 'bg-slate-700/40 border-slate-600 text-slate-400',
  };
  const labels = {
    connected: 'Connected',
    connecting: 'Connecting…',
    error: 'Could not connect',
    disconnected: 'Not connected',
  };

  return (
    <div className={`rounded border px-3 py-2 text-sm ${styles[status.state]}`}>
      <div className="font-medium">{labels[status.state]}</div>
      {status.error && <div className="text-xs mt-1 opacity-90">{status.error}</div>}
    </div>
  );
}
