import { describe, test, expect } from 'vitest';
import { computeReachability, classifyChecks, isShuffled, summariseStates } from './reachability';
import { meetsRequirements, toHeldMap, firstUnmet, describeRequirement } from './rules';
import { skyDoorRequirements, fragmentsRequired, SKY_DOOR_ENTRANCE_ID } from './skyCoin';
import checks from '../data/ffmq/checks.json';
import entranceLinks from '../data/ffmq/entranceLinks.json';
import itemsData from '../data/ffmq/items.json';
import roomsData from '../data/ffmq/rooms.json';
import { startRoomId } from './reachability';

const VANILLA = { mapShuffle: 'none', overworldShuffle: false };
const allItems = itemsData.map((i) => i.name);

describe('graph assumptions', () => {
  // The engine hardcodes the start room rather than importing the 148 KB room
  // table to look it up. This is the guard on that shortcut.
  test('the hardcoded start room is still the Overworld', () => {
    const overworld = roomsData.find((r) => r.name === 'Overworld');
    expect(overworld).toBeDefined();
    expect(startRoomId).toBe(overworld.id);
  });
});

describe('requirement evaluation', () => {
  test('no requirements is always satisfied', () => {
    expect(meetsRequirements([], toHeldMap([]))).toBe(true);
    expect(meetsRequirements(undefined, toHeldMap([]))).toBe(true);
  });

  test('a plain item requirement needs that item', () => {
    const rule = [{ type: 'item', item: 'Dragon Claw' }];

    expect(meetsRequirements(rule, toHeldMap([]))).toBe(false);
    expect(meetsRequirements(rule, toHeldMap(['Dragon Claw']))).toBe(true);
  });

  test('requirements are ANDed', () => {
    const rule = [{ type: 'item', item: 'Dragon Claw' }, { type: 'item', item: 'Mega Grenade' }];

    expect(meetsRequirements(rule, toHeldMap(['Dragon Claw']))).toBe(false);
    expect(meetsRequirements(rule, toHeldMap(['Dragon Claw', 'Mega Grenade']))).toBe(true);
  });

  test('a weapon class is satisfied by any member', () => {
    const rule = [{ type: 'anyOfGroup', group: 'Claws' }];

    expect(meetsRequirements(rule, toHeldMap(['Steel Sword']))).toBe(false);
    expect(meetsRequirements(rule, toHeldMap(['Charm Claw']))).toBe(true);
  });

  // The upstream group-tagging bug this corrects would otherwise make every
  // claw-gated check unreachable on a progressive-gear run.
  test('Progressive Claw satisfies a claw requirement', () => {
    const rule = [{ type: 'anyOfGroup', group: 'Claws' }];
    expect(meetsRequirements(rule, toHeldMap(['Progressive Claw']))).toBe(true);
  });

  test('"never" is never satisfied, even holding everything', () => {
    expect(meetsRequirements([{ type: 'never' }], toHeldMap(allItems))).toBe(false);
  });

  test('an unrecognised requirement fails closed', () => {
    expect(meetsRequirements([{ type: 'nonsense' }], toHeldMap(allItems))).toBe(false);
  });

  test('counted requirements compare against how many are held', () => {
    const rule = [{ type: 'item', item: 'Sky Fragment', count: 24 }];

    expect(meetsRequirements(rule, toHeldMap({ 'Sky Fragment': 23 }))).toBe(false);
    expect(meetsRequirements(rule, toHeldMap({ 'Sky Fragment': 24 }))).toBe(true);
    expect(meetsRequirements(rule, toHeldMap({ 'Sky Fragment': 40 }))).toBe(true);
  });

  test('reports which requirement blocked, for explaining a red marker', () => {
    const rule = [{ type: 'item', item: 'Dragon Claw' }, { type: 'item', item: 'Mega Grenade' }];
    const blocked = firstUnmet(rule, toHeldMap(['Dragon Claw']));

    expect(blocked.item).toBe('Mega Grenade');
    expect(describeRequirement(blocked)).toBe('Mega Grenade');
  });

  test('describes a counted requirement with progress', () => {
    const rule = { type: 'item', item: 'Sky Fragment', count: 24 };
    expect(describeRequirement(rule, toHeldMap({ 'Sky Fragment': 5 }))).toContain('have 5');
  });
});

describe('shuffle pools', () => {
  const overworldEntrance = 445; // "Overworld - Level Forest"
  const dungeonEntrance = 55; // "Bone Dungeon 1F - Bone Dungeon Entrance"

  test('nothing is shuffled in a vanilla run', () => {
    expect(isShuffled(overworldEntrance, VANILLA)).toBe(false);
    expect(isShuffled(dungeonEntrance, VANILLA)).toBe(false);
  });

  test('the overworld toggle is independent of map shuffle', () => {
    expect(isShuffled(overworldEntrance, { mapShuffle: 'none', overworldShuffle: true })).toBe(true);
    expect(isShuffled(dungeonEntrance, { mapShuffle: 'none', overworldShuffle: true })).toBe(false);
  });

  test('dungeon entrances join the pool when floors are shuffled', () => {
    expect(isShuffled(dungeonEntrance, { mapShuffle: 'dungeons_mixed' })).toBe(true);
  });

  // Mirrors RoomsGenerator.py: towns and temples only join at "everything".
  test('town and temple entrances only shuffle at "everything"', () => {
    const townEntrance = 38;

    expect(isShuffled(townEntrance, { mapShuffle: 'dungeons_mixed' })).toBe(false);
    expect(isShuffled(townEntrance, { mapShuffle: 'everything' })).toBe(true);
  });
});

describe('vanilla reachability', () => {
  test('with nothing, you are not stuck at the start', () => {
    const result = computeReachability({ settings: VANILLA });
    expect(result.reachableRooms.size).toBeGreaterThan(1);
  });

  test('with nothing, some of the game is still closed off', () => {
    const result = computeReachability({ settings: VANILLA });
    expect(result.reachableRooms.size).toBeLessThan(220);
  });

  test('holding everything opens far more than holding nothing', () => {
    const empty = computeReachability({ settings: VANILLA });
    const full = computeReachability({ ownedItems: allItems, settings: VANILLA });

    expect(full.reachableRooms.size).toBeGreaterThan(empty.reachableRooms.size);
  });

  test('a vanilla run has no unexplored exits — nothing is shuffled', () => {
    const result = computeReachability({ settings: VANILLA });
    expect(result.unexploredExits.size).toBe(0);
  });

  // The strongest single check on the whole engine. Vanilla FFMQ with every
  // item in hand is fully completable, so anything short of total coverage
  // means the graph, the rules or the event chain is wrong somewhere.
  test('every room and every check is reachable with all items', () => {
    const result = computeReachability({ ownedItems: allItems, settings: VANILLA });
    const status = classifyChecks(result);
    const notInLogic = [...status.values()].filter((v) => v.state !== 'in-logic');

    expect(result.reachableRooms.size).toBe(220);
    expect(notInLogic).toEqual([]);
  });

  test('starting out, only a small opening area is available', () => {
    const result = computeReachability({ settings: VANILLA });

    // Enough to get going, nowhere near the whole game.
    expect(result.reachableRooms.size).toBeGreaterThan(5);
    expect(result.reachableRooms.size).toBeLessThan(30);
  });

  test('the coins gate a large part of the game', () => {
    const none = computeReachability({ settings: VANILLA });
    const coins = computeReachability({
      ownedItems: ['Sand Coin', 'River Coin', 'Sun Coin', 'Sky Coin'],
      settings: VANILLA,
    });

    expect(coins.reachableRooms.size).toBeGreaterThan(none.reachableRooms.size * 3);
  });

  test('triggers grant their events once their room is reachable', () => {
    const result = computeReachability({ ownedItems: allItems, settings: VANILLA });
    expect(result.grantedEvents.size).toBeGreaterThan(0);
  });
});

describe('shuffled reachability', () => {
  const SHUFFLED = { mapShuffle: 'everything', overworldShuffle: true };

  test('with nothing discovered, exits are recorded as unexplored', () => {
    const result = computeReachability({ ownedItems: allItems, settings: SHUFFLED });
    expect(result.unexploredExits.size).toBeGreaterThan(0);
  });

  // The whole point of an entrance tracker: until you have explored, a fully
  // shuffled seed leaves you boxed in no matter what you are carrying.
  test('a fully shuffled seed strands you at the start until you explore', () => {
    const result = computeReachability({ ownedItems: allItems, settings: SHUFFLED });

    expect(result.reachableRooms.size).toBeLessThan(15);
    expect(result.unexploredExits.size).toBeGreaterThan(10);
  });

  test('shuffling closes off rooms that vanilla reaches', () => {
    const vanilla = computeReachability({ ownedItems: allItems, settings: VANILLA });
    const shuffled = computeReachability({ ownedItems: allItems, settings: SHUFFLED });

    expect(shuffled.reachableRooms.size).toBeLessThan(vanilla.reachableRooms.size);
  });

  test('discovering a pairing opens up what lies beyond it', () => {
    const before = computeReachability({ ownedItems: allItems, settings: SHUFFLED });

    // Pair the first unexplored exit with a partner from elsewhere.
    const exitId = [...before.unexploredExits][0];
    const partner = entranceLinks.find((l) => l.entranceId !== exitId
      && !before.reachableRooms.has(l.fromRoomId));

    const after = computeReachability({
      ownedItems: allItems,
      settings: SHUFFLED,
      discoveredLinks: { [exitId]: partner.entranceId },
    });

    expect(after.reachableRooms.size).toBeGreaterThan(before.reachableRooms.size);
  });

  test('a self-paired entrance is a dead end, not a crash', () => {
    const before = computeReachability({ ownedItems: allItems, settings: SHUFFLED });
    const exitId = [...before.unexploredExits][0];

    const after = computeReachability({
      ownedItems: allItems,
      settings: SHUFFLED,
      discoveredLinks: { [exitId]: exitId },
    });

    expect(after.reachableRooms.size).toBeGreaterThanOrEqual(before.reachableRooms.size);
    expect(after.unexploredExits.has(exitId)).toBe(false);
  });
});

describe('the Sky Door', () => {
  test('standard mode wants the coin', () => {
    const rule = skyDoorRequirements({ skyCoinMode: 'standard' });
    expect(rule).toEqual([{ type: 'item', item: 'Sky Coin', raw: 'SkyCoin' }]);
  });

  test('start_with opens it outright', () => {
    expect(skyDoorRequirements({ skyCoinMode: 'start_with' })).toEqual([]);
  });

  test('save_the_crystals wants all four bosses', () => {
    const rule = skyDoorRequirements({ skyCoinMode: 'save_the_crystals' });
    expect(rule).toHaveLength(4);
    expect(rule.map((r) => r.item)).toContain('Pazuzu');
  });

  test('shattered wants the configured number of fragments', () => {
    const rule = skyDoorRequirements({
      skyCoinMode: 'shattered_sky_coin',
      shatteredSkyCoinQuantity: 'high_32',
    });

    expect(rule[0].item).toBe('Sky Fragment');
    expect(rule[0].count).toBe(32);
  });

  test('the thresholds match the upstream table', () => {
    expect(fragmentsRequired('low_16')).toBe(16);
    expect(fragmentsRequired('mid_24')).toBe(24);
    expect(fragmentsRequired('high_32')).toBe(32);
    expect(fragmentsRequired('random_wide')).toBe(38);
  });

  test('the override actually replaces the rule baked into the data', () => {
    // The data's own rule is the most restrictive of the four — coin AND all
    // four bosses — so leaving it in place would understate every mode.
    const dataRule = entranceLinks.find((l) => l.entranceId === SKY_DOOR_ENTRANCE_ID);
    expect(dataRule.access.length).toBeGreaterThan(1);
    expect(skyDoorRequirements({ skyCoinMode: 'standard' })).toHaveLength(1);
  });

  test('start_with grants the coin to the player', () => {
    const result = computeReachability({
      settings: { ...VANILLA, skyCoinMode: 'start_with' },
    });
    expect(result.held.get('Sky Coin')).toBe(1);
  });

  test('fragments below the threshold do not open the door', () => {
    const settings = { ...VANILLA, skyCoinMode: 'shattered_sky_coin', shatteredSkyCoinQuantity: 'mid_24' };

    const short = computeReachability({ ownedItems: { ...Object.fromEntries(allItems.map(n => [n, 1])), 'Sky Fragment': 23 }, settings });
    const enough = computeReachability({ ownedItems: { ...Object.fromEntries(allItems.map(n => [n, 1])), 'Sky Fragment': 24 }, settings });

    expect(enough.reachableRooms.size).toBeGreaterThan(short.reachableRooms.size);
  });
});

describe('classifying checks', () => {
  test('every check gets a state', () => {
    const result = computeReachability({ ownedItems: allItems, settings: VANILLA });
    const status = classifyChecks(result);

    expect(status.size).toBe(checks.length);
    for (const [, value] of status) {
      expect(['in-logic', 'out-of-logic', 'unreachable']).toContain(value.state);
    }
  });

  test('holding nothing leaves plenty unreachable', () => {
    const status = classifyChecks(computeReachability({ settings: VANILLA }));
    const unreachable = [...status.values()].filter((v) => v.state === 'unreachable');

    expect(unreachable.length).toBeGreaterThan(0);
  });

  test('an unreachable check explains what blocked it where it can', () => {
    const status = classifyChecks(computeReachability({ settings: VANILLA }));
    const blocked = [...status.values()].filter((v) => v.blockedBy);

    expect(blocked.length).toBeGreaterThan(0);
  });

  test('a permissive pass promotes unreachable to out-of-logic', () => {
    const strict = computeReachability({ settings: VANILLA });
    const permissive = computeReachability({ ownedItems: allItems, settings: VANILLA });
    const status = classifyChecks(strict, permissive);

    const outOfLogic = [...status.values()].filter((v) => v.state === 'out-of-logic');
    expect(outOfLogic.length).toBeGreaterThan(0);
  });
});

describe('summarising a group of checks', () => {
  test('all agreeing yields that state', () => {
    expect(summariseStates(['in-logic', 'in-logic'])).toBe('in-logic');
  });

  test('disagreement yields mixed, so a group never claims to be all green', () => {
    expect(summariseStates(['in-logic', 'unreachable'])).toBe('mixed');
  });

  test('an empty group is none', () => {
    expect(summariseStates([])).toBe('none');
  });
});
