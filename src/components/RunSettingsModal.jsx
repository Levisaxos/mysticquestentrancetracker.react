import React, { useEffect } from 'react';
import { gameService } from '../services/gameService';

/**
 * Randomiser settings for a run.
 *
 * These decide which entrances are shuffled and how the Doom Castle opens, so
 * the logic is wrong until they match the seed. On Archipelago 1.7+ they arrive
 * in slot data and this form fills itself in; until then, and for non-AP runs,
 * they have to be set by hand.
 */
const FIELDS = [
  {
    key: 'mapShuffle',
    label: 'Map Shuffle',
    help: 'Which dungeon floors are shuffled among each other.',
    options: [
      ['none', 'None'],
      ['dungeons_internal', 'Dungeons, internally'],
      ['dungeons_mixed', 'Dungeons, mixed together'],
      ['everything', 'Everything (incl. towns & temples)'],
    ],
  },
  {
    key: 'skyCoinMode',
    label: 'Sky Coin',
    help: 'How the Doom Castle is unlocked.',
    options: [
      ['standard', 'Standard — find the coin'],
      ['start_with', 'Start with the coin'],
      ['save_the_crystals', 'Save all four crystals'],
      ['shattered_sky_coin', 'Shattered — collect fragments'],
    ],
  },
  {
    key: 'shatteredSkyCoinQuantity',
    label: 'Fragments required',
    help: 'Of the 40 that exist. Only applies when shattered.',
    dependsOn: (settings) => settings.skyCoinMode === 'shattered_sky_coin',
    options: [
      ['low_16', 'Low — 16'],
      ['mid_24', 'Mid — 24'],
      ['high_32', 'High — 32'],
      ['random_narrow', 'Random narrow (plan for 32)'],
      ['random_wide', 'Random wide (plan for 38)'],
    ],
  },
];

const TOGGLES = [
  { key: 'overworldShuffle', label: 'Overworld shuffle', help: 'Independent of map shuffle.' },
  { key: 'crestShuffle', label: 'Crest shuffle', help: 'Shuffles the crest tiles among themselves.' },
];

export default function RunSettingsModal({ isOpen, gameId, onClose, onChange }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const settings = gameService.getSettings(gameId);

  const update = (patch) => {
    gameService.updateSettings(gameId, patch);
    onChange?.();
  };

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
        aria-label="Run settings"
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-semibold text-slate-100">Run settings</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            Done (Esc)
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-5">
          These have to match the seed, or the logic will be wrong.
        </p>

        {FIELDS.filter((field) => !field.dependsOn || field.dependsOn(settings)).map((field) => (
          <div key={field.key} className="mb-4">
            <label htmlFor={field.key} className="block text-slate-300 text-sm font-medium mb-1">
              {field.label}
            </label>
            <select
              id={field.key}
              value={settings[field.key]}
              onChange={(e) => update({ [field.key]: e.target.value })}
              className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600 focus:border-blue-400 focus:outline-none"
            >
              {field.options.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">{field.help}</p>
          </div>
        ))}

        {TOGGLES.map((toggle) => (
          <label key={toggle.key} className="flex items-start gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings[toggle.key])}
              onChange={(e) => update({ [toggle.key]: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="text-slate-200 text-sm">{toggle.label}</span>
              <span className="block text-xs text-slate-500">{toggle.help}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
