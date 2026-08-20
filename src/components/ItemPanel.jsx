import React, { useState } from 'react';
import { itemService, gearClasses, simpleCategories } from '../services/itemService';
import { gameService } from '../services/gameService';
import { usesFragments, startsWithCoin, fragmentsRequired, TOTAL_FRAGMENTS } from '../engine/skyCoin';
import { iconFor } from '../constants/itemIcons';
import { assetUrl } from '../utils/assetUrl';
import RunSettingsModal from './RunSettingsModal';

/**
 * Item tracker.
 *
 * Owned items show in full colour; unowned ones are dimmed and desaturated so
 * the panel reads at a glance without needing a legend. Gear is grouped by
 * class and cycles through its tiers, which is how the randomiser hands it out.
 */
function ItemIcon({ name, owned, label, badge, onClick, onContextMenu }) {
  const icon = iconFor(name);

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={label}
      className={`relative w-10 h-10 rounded flex items-center justify-center transition-all
        focus:outline-none focus-visible:ring-2 focus-visible:ring-white
        ${owned
          ? 'bg-slate-700 hover:bg-slate-600'
          : 'bg-slate-800/60 hover:bg-slate-700/60'}`}
    >
      {icon ? (
        <img
          src={assetUrl(icon)}
          alt={name}
          className={`w-8 h-8 object-contain transition-all ${
            owned ? '' : 'grayscale opacity-30'
          }`}
        />
      ) : (
        <span className={`text-[10px] leading-tight text-center px-0.5 ${
          owned ? 'text-slate-100' : 'text-slate-600'
        }`}>
          {name.split(' ')[0]}
        </span>
      )}

      {badge != null && (
        <span className="absolute -bottom-1 -right-1 bg-slate-900 text-slate-200 text-[9px] font-bold rounded px-1 border border-slate-600 whitespace-nowrap">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function ItemPanel({ gameId, refreshTrigger, onChange }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const items = itemService.getItems(gameId);
  const settings = gameService.getSettings(gameId);
  const notify = () => onChange?.();

  const shattered = usesFragments(settings);
  const required = fragmentsRequired(settings.shatteredSkyCoinQuantity);
  const fragments = itemService.getCount(gameId, 'Sky Fragment');

  // With the coin shattered it is replaced by 40 fragments, and the Doom Castle
  // opens at a configured threshold. Show the running count, and swap to the
  // coin art once enough are in hand — at that point they *are* the coin.
  const skySlot = (() => {
    if (!shattered) {
      const owned = startsWithCoin(settings) || Boolean(items['Sky Coin']);
      return {
        name: 'Sky Coin',
        owned,
        badge: null,
        label: startsWithCoin(settings)
          ? 'Sky Coin (you start with it)'
          : `Sky Coin${owned ? ' (have)' : ''}`,
        readOnly: startsWithCoin(settings),
      };
    }

    const enough = fragments >= required;
    return {
      name: enough ? 'Sky Coin' : 'Sky Fragment',
      owned: fragments > 0,
      badge: `${fragments}/${required}`,
      label: enough
        ? `Sky Coin — ${fragments} fragments, enough to enter Doom Castle`
        : `Sky Fragment ${fragments} of ${required} needed (${TOTAL_FRAGMENTS} exist)`
        + ' — click to add, right-click to remove',
      readOnly: false,
    };
  })();

  return (
    <aside className="w-56 shrink-0 bg-slate-800 rounded-lg border border-slate-700 p-3 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Items
        </h2>
        <button
          onClick={() => setSettingsOpen(true)}
          title="Run settings — map shuffle, sky coin mode"
          className="text-slate-400 hover:text-white hover:bg-slate-700 rounded px-1.5 py-0.5 text-sm transition-colors"
        >
          ⚙
        </button>
      </div>

      <RunSettingsModal
        isOpen={settingsOpen}
        gameId={gameId}
        onClose={() => setSettingsOpen(false)}
        onChange={notify}
      />

      {simpleCategories.map((category) => (
        <section key={category.name} className="mb-4">
          <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">
            {category.name}
          </h3>
          <div className="grid grid-cols-4 gap-1">
            {category.items
              .filter((name) => name !== 'Sky Coin' && name !== 'Sky Fragment')
              .map((name) => (
                <ItemIcon
                  key={name}
                  name={name}
                  owned={Boolean(items[name])}
                  label={`${name}${items[name] ? ' (have)' : ''}`}
                  onClick={() => { itemService.toggleItem(gameId, name); notify(); }}
                />
              ))}

            {category.name === 'Key Items' && (
              <ItemIcon
                name={skySlot.name}
                owned={skySlot.owned}
                badge={skySlot.badge}
                label={skySlot.label}
                onClick={() => {
                  if (skySlot.readOnly) return;
                  if (shattered) itemService.adjustCount(gameId, 'Sky Fragment', 1);
                  else itemService.toggleItem(gameId, 'Sky Coin');
                  notify();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (skySlot.readOnly) return;
                  if (shattered) itemService.adjustCount(gameId, 'Sky Fragment', -1);
                  else itemService.setItem(gameId, 'Sky Coin', false);
                  notify();
                }}
              />
            )}
          </div>
        </section>
      ))}

      <section>
        <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">
          Gear
        </h3>
        <div className="grid grid-cols-4 gap-1">
          {gearClasses.map((gear) => {
            const tier = itemService.getGearTier(gameId, gear.name);
            const shown = tier > 0 ? gear.tiers[tier - 1] : gear.tiers[0];

            return (
              <ItemIcon
                key={gear.name}
                name={shown}
                owned={tier > 0}
                badge={tier > 0 ? tier : null}
                label={
                  tier > 0
                    ? `${shown} — click to advance, right-click to go back`
                    : `${gear.name}: none — click to add ${gear.tiers[0]}`
                }
                onClick={() => { itemService.cycleGear(gameId, gear.name, 1); notify(); }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  itemService.cycleGear(gameId, gear.name, -1);
                  notify();
                }}
              />
            );
          })}
        </div>
      </section>
    </aside>
  );
}
