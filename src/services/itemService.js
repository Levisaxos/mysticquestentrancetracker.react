import { gameService } from './gameService';
import { TOTAL_FRAGMENTS } from '../engine/skyCoin';
import itemGroups from '../data/ffmq/itemGroups.json';
import canonicalItems from '../data/ffmq/items.json';

// Gear comes in tiers. The randomiser can hand these out either individually or
// as "Progressive X" placeholders, so the tier list is the group minus its
// progressive entry, in the order upstream declares it.
const GEAR_CLASSES = ['Swords', 'Axes', 'Claws', 'Bombs', 'Helms', 'Armors', 'Shields', 'Accessories'];

// Filler. A tracker has no reason to show these.
const UNTRACKED_GROUPS = ['Consumables', 'Refills'];

const untracked = new Set(UNTRACKED_GROUPS.flatMap((g) => itemGroups[g] ?? []));

export const gearClasses = GEAR_CLASSES.map((name) => ({
  name,
  tiers: (itemGroups[name] ?? []).filter((item) => !item.startsWith('Progressive ')),
  progressive: (itemGroups[name] ?? []).find((item) => item.startsWith('Progressive ')) ?? null,
}));

const gearItems = new Set(gearClasses.flatMap((c) => [...c.tiers, c.progressive].filter(Boolean)));

/** Key items and spells: simple on/off, shown as their own grids. */
export const simpleCategories = [
  { name: 'Key Items', items: (itemGroups['Key Items'] ?? []) },
  { name: 'Spells', items: (itemGroups.Spells ?? []) },
];

/** Everything a tracker should show — excludes filler. */
export const trackableItems = canonicalItems
  .map((i) => i.name)
  .filter((name) => !untracked.has(name));

/**
 * Items you hold more than one of. Sky Fragments are the only case: when the
 * coin is shattered there are 40 of them and the Doom Castle opens at a
 * configured threshold, so a plain on/off toggle cannot express the run.
 */
export const COUNTED_ITEMS = { 'Sky Fragment': TOTAL_FRAGMENTS };

class ItemService {
  _mutate(gameId, fn) {
    const game = gameService.getGame(gameId);
    if (!game) return false;

    game.items = game.items ?? {};
    fn(game);
    gameService.saveGame(game);
    return true;
  }

  getItems(gameId) {
    return gameService.getGame(gameId)?.items ?? {};
  }

  has(gameId, itemName) {
    return this.getCount(gameId, itemName) > 0;
  }

  /** How many of an item the player holds. Boolean entries count as one. */
  getCount(gameId, itemName) {
    const value = this.getItems(gameId)[itemName];
    if (typeof value === 'number') return value;
    return value ? 1 : 0;
  }

  setCount(gameId, itemName, count) {
    const max = COUNTED_ITEMS[itemName] ?? 1;
    const clamped = Math.max(0, Math.min(count, max));

    this._mutate(gameId, (game) => {
      if (clamped <= 0) delete game.items[itemName];
      else game.items[itemName] = max > 1 ? clamped : true;
    });
  }

  /**
   * Step a counted item up or down, wrapping at the ends so a mis-click is one
   * more click to undo rather than a reset.
   */
  adjustCount(gameId, itemName, delta) {
    const max = COUNTED_ITEMS[itemName] ?? 1;
    const current = this.getCount(gameId, itemName);
    const next = (current + delta + max + 1) % (max + 1);
    this.setCount(gameId, itemName, next);
  }

  isCounted(itemName) {
    return itemName in COUNTED_ITEMS;
  }

  setItem(gameId, itemName, owned) {
    this._mutate(gameId, (game) => {
      if (owned) game.items[itemName] = true;
      else delete game.items[itemName];
    });
  }

  toggleItem(gameId, itemName) {
    if (this.isCounted(itemName)) {
      this.adjustCount(gameId, itemName, 1);
      return;
    }
    this.setItem(gameId, itemName, !this.has(gameId, itemName));
  }

  /**
   * How far up a gear class the player has got: 0 for nothing, else the
   * 1-based index of the highest tier owned.
   *
   * Progressive placeholders count too — holding two "Progressive Sword" is the
   * same as holding the second sword, which is what the randomiser means by it.
   */
  getGearTier(gameId, className) {
    const gear = gearClasses.find((c) => c.name === className);
    if (!gear) return 0;

    const items = this.getItems(gameId);

    let highest = 0;
    gear.tiers.forEach((tier, index) => {
      if (items[tier]) highest = Math.max(highest, index + 1);
    });

    if (gear.progressive && items[gear.progressive]) {
      highest = Math.max(highest, Math.min(items[gear.progressive], gear.tiers.length));
    }

    return highest;
  }

  /** Advance a gear class one tier, wrapping back to nothing at the top. */
  cycleGear(gameId, className, direction = 1) {
    const gear = gearClasses.find((c) => c.name === className);
    if (!gear) return;

    const current = this.getGearTier(gameId, className);
    const count = gear.tiers.length;
    const next = (current + direction + count + 1) % (count + 1);

    this._mutate(gameId, (game) => {
      // Owning a tier implies the ones below it, which is how the game plays and
      // how the logic reads it. Clearing and re-setting keeps that consistent.
      for (const tier of gear.tiers) delete game.items[tier];
      if (gear.progressive) delete game.items[gear.progressive];

      for (let i = 0; i < next; i += 1) game.items[gear.tiers[i]] = true;
    });
  }

  /** Item names the player holds — kept for callers that only need presence. */
  getOwnedItemNames(gameId) {
    return Object.entries(this.getItems(gameId))
      .filter(([, owned]) => owned)
      .map(([name]) => name);
  }

  /**
   * Name → count, which is what the logic engine consumes. Counted items keep
   * their real quantity so threshold rules (Sky Fragments) evaluate correctly.
   */
  getOwnedCounts(gameId) {
    const owned = {};
    for (const [name, value] of Object.entries(this.getItems(gameId))) {
      const count = typeof value === 'number' ? value : (value ? 1 : 0);
      if (count > 0) owned[name] = count;
    }
    return owned;
  }

  isGearItem(itemName) {
    return gearItems.has(itemName);
  }
}

export const itemService = new ItemService();
