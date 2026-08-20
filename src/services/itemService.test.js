import { describe, test, expect, beforeEach } from 'vitest';
import { gameService } from './gameService';
import { itemService, gearClasses, simpleCategories, trackableItems } from './itemService';
import { iconFor } from '../constants/itemIcons';

let gameId;

beforeEach(() => {
  localStorage.clear();
  gameId = gameService.createGame('item run').id;
});

describe('simple items', () => {
  test('a new run holds nothing', () => {
    expect(itemService.getItems(gameId)).toEqual({});
    expect(itemService.has(gameId, 'Elixir')).toBe(false);
  });

  test('toggling grants and removes', () => {
    itemService.toggleItem(gameId, 'Elixir');
    expect(itemService.has(gameId, 'Elixir')).toBe(true);

    itemService.toggleItem(gameId, 'Elixir');
    expect(itemService.has(gameId, 'Elixir')).toBe(false);
  });

  test('items persist across a reload', () => {
    itemService.toggleItem(gameId, 'Magic Mirror');
    expect(gameService.getGame(gameId).items['Magic Mirror']).toBe(true);
  });

  test('runs do not share items', () => {
    const other = gameService.createGame('other').id;
    itemService.toggleItem(gameId, 'Elixir');

    expect(itemService.has(other, 'Elixir')).toBe(false);
  });

  test('an unknown run is handled without throwing', () => {
    expect(() => itemService.toggleItem(9999, 'Elixir')).not.toThrow();
    expect(itemService.getItems(9999)).toEqual({});
  });
});

describe('gear tiers', () => {
  test('every gear class has tiers and no progressive placeholder among them', () => {
    for (const gear of gearClasses) {
      expect(gear.tiers.length, gear.name).toBeGreaterThan(0);
      expect(gear.tiers.some((t) => t.startsWith('Progressive '))).toBe(false);
    }
  });

  test('starts at zero', () => {
    expect(itemService.getGearTier(gameId, 'Swords')).toBe(0);
  });

  test('cycling advances one tier at a time', () => {
    itemService.cycleGear(gameId, 'Swords', 1);
    expect(itemService.getGearTier(gameId, 'Swords')).toBe(1);

    itemService.cycleGear(gameId, 'Swords', 1);
    expect(itemService.getGearTier(gameId, 'Swords')).toBe(2);
  });

  test('a tier implies the ones below it', () => {
    const swords = gearClasses.find((g) => g.name === 'Swords');
    itemService.cycleGear(gameId, 'Swords', 1);
    itemService.cycleGear(gameId, 'Swords', 1);

    expect(itemService.has(gameId, swords.tiers[0])).toBe(true);
    expect(itemService.has(gameId, swords.tiers[1])).toBe(true);
    expect(itemService.has(gameId, swords.tiers[2])).toBe(false);
  });

  test('wraps back to nothing past the top tier', () => {
    const swords = gearClasses.find((g) => g.name === 'Swords');
    for (let i = 0; i < swords.tiers.length; i += 1) itemService.cycleGear(gameId, 'Swords', 1);
    expect(itemService.getGearTier(gameId, 'Swords')).toBe(swords.tiers.length);

    itemService.cycleGear(gameId, 'Swords', 1);
    expect(itemService.getGearTier(gameId, 'Swords')).toBe(0);
  });

  test('cycling backwards steps down', () => {
    itemService.cycleGear(gameId, 'Swords', 1);
    itemService.cycleGear(gameId, 'Swords', 1);
    itemService.cycleGear(gameId, 'Swords', -1);

    expect(itemService.getGearTier(gameId, 'Swords')).toBe(1);
  });

  test('backwards from nothing wraps to the top', () => {
    const swords = gearClasses.find((g) => g.name === 'Swords');
    itemService.cycleGear(gameId, 'Swords', -1);
    expect(itemService.getGearTier(gameId, 'Swords')).toBe(swords.tiers.length);
  });

  test('gear classes are independent', () => {
    itemService.cycleGear(gameId, 'Swords', 1);
    expect(itemService.getGearTier(gameId, 'Axes')).toBe(0);
  });

  test('an unknown class is a no-op', () => {
    expect(() => itemService.cycleGear(gameId, 'Nonsense', 1)).not.toThrow();
    expect(itemService.getGearTier(gameId, 'Nonsense')).toBe(0);
  });
});

describe('what the logic engine will consume', () => {
  test('owned item names come back as a flat list', () => {
    itemService.toggleItem(gameId, 'Elixir');
    itemService.cycleGear(gameId, 'Claws', 1);

    const owned = itemService.getOwnedItemNames(gameId);
    expect(owned).toContain('Elixir');
    expect(owned).toContain(gearClasses.find((g) => g.name === 'Claws').tiers[0]);
  });
});

describe('catalogue', () => {
  test('key items and spells are both populated', () => {
    for (const category of simpleCategories) {
      expect(category.items.length, category.name).toBeGreaterThan(0);
    }
  });

  test('filler is excluded from the trackable set', () => {
    expect(trackableItems).not.toContain('Cure Potion');
    expect(trackableItems).not.toContain('Bomb Refill');
  });

  test('every trackable item resolves to an icon', () => {
    const missing = trackableItems.filter((name) => !iconFor(name));
    expect(missing).toEqual([]);
  });

  // The two spellings that differ between our art and the canonical names.
  test('the aliased names resolve', () => {
    expect(iconFor("Gaia's Armor")).toContain('gaiaarmor');
    expect(iconFor('Knight Sword')).toContain('knightssword');
  });

  test('progressive placeholders borrow their first tier art', () => {
    expect(iconFor('Progressive Sword')).toBe(iconFor('Steel Sword'));
    expect(iconFor('Progressive Claw')).toBe(iconFor('Cat Claw'));
  });
});

describe('the corrected Progressive Claw group', () => {
  // Upstream tags "Progressive Claw" into Axes rather than Claws; the sync
  // corrects it. Without the fix, claw-gated logic breaks for progressive runs.
  test('Progressive Claw sits with the claws', () => {
    const claws = gearClasses.find((g) => g.name === 'Claws');
    const axes = gearClasses.find((g) => g.name === 'Axes');

    expect(claws.progressive).toBe('Progressive Claw');
    expect(axes.progressive).toBe('Progressive Axe');
  });
});
