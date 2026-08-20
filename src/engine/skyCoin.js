// The Doom Castle gate.
//
// Archipelago does not express this in the room data — Regions.py *replaces*
// the access rule on the "Focus Tower 1F - Sky Door" entrance depending on
// sky_coin_mode. The rule baked into the data is the most restrictive of the
// four (Sky Coin AND all four bosses), so using it unchanged would understate
// reachability for every mode. Hence this override.
//
// Mirrors worlds/ffmq/Regions.py.

export const SKY_DOOR_ENTRANCE_ID = 13;

/** The four crystal bosses, which are trigger events rather than items. */
export const CRYSTAL_BOSSES = ['Flamerus Rex', 'Dualhead Hydra', 'Ice Golem', 'Pazuzu'];

/** Fragments required per ShatteredSkyCoinQuantity option, in option order. */
export const SHATTERED_THRESHOLDS = {
  low_16: 16,
  mid_24: 24,
  high_32: 32,
  random_narrow: 32, // upstream plans for the worst case
  random_wide: 38,
};

/** Total fragments that exist when the coin is shattered. */
export const TOTAL_FRAGMENTS = 40;

export function fragmentsRequired(quantity = 'mid_24') {
  return SHATTERED_THRESHOLDS[quantity] ?? SHATTERED_THRESHOLDS.mid_24;
}

/**
 * Requirements for the Sky Door under the run's settings.
 * Returns null when the mode is unrecognised, so callers keep the data's rule.
 */
export function skyDoorRequirements(settings = {}) {
  const mode = settings.skyCoinMode ?? 'standard';

  switch (mode) {
    case 'standard':
      return [{ type: 'item', item: 'Sky Coin', raw: 'SkyCoin' }];

    case 'start_with':
      // The coin is in your inventory from the start, so the door is open.
      return [];

    case 'save_the_crystals':
      return CRYSTAL_BOSSES.map((boss) => ({ type: 'item', item: boss, raw: boss }));

    case 'shattered_sky_coin':
      return [{
        type: 'item',
        item: 'Sky Fragment',
        count: fragmentsRequired(settings.shatteredSkyCoinQuantity),
        raw: 'SkyFragment',
      }];

    default:
      return null;
  }
}

/**
 * Does this run track fragments rather than a single coin?
 * Drives whether the item panel shows a counter or a toggle.
 */
export function usesFragments(settings = {}) {
  return (settings.skyCoinMode ?? 'standard') === 'shattered_sky_coin';
}

/** Does the player start holding the coin? */
export function startsWithCoin(settings = {}) {
  return (settings.skyCoinMode ?? 'standard') === 'start_with';
}
