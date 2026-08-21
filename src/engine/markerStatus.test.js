import { describe, test, expect } from 'vitest';
import { computeMarkerStatus, summariseMarkerStates, STATE_STYLES } from './markerStatus';
import { vanillaLinksFor } from './pools';
import binding from '../data/binding.json';
import { LOCATIONS_DATA } from '../constants/locationsData';

const SHUFFLED = { mapShuffle: 'everything', overworldShuffle: true, skyCoinMode: 'standard' };

const marker = (floorId, name) => (LOCATIONS_DATA[floorId] ?? []).find((m) => m.name === name);
const entranceOf = (floorId, name) => binding.markers[String(marker(floorId, name)?.id)]?.entranceId;

const stateOf = (status, floorId, name) => status.get(marker(floorId, name).id)?.state;

// Fixed points in the data used across these tests.
const FORESTA_ICON = entranceOf('10101', 'Foresta');
const BONE_ENTRANCE = entranceOf('20301', 'Bone Dungeon Entrance');
const BONE_TO_B1 = entranceOf('20301', 'To Bone Dungeon B1');

describe('unlinked entrances', () => {
  test('an unreachable door reads as no access', () => {
    const { status } = computeMarkerStatus({ settings: SHUFFLED });
    expect(stateOf(status, '20301', 'To Bone Dungeon B1')).toBe('unreachable');
  });

  test('a reachable but unlinked door reads as in logic', () => {
    const { status } = computeMarkerStatus({
      settings: SHUFFLED,
      discoveredLinks: { [FORESTA_ICON]: BONE_ENTRANCE, [BONE_ENTRANCE]: FORESTA_ICON },
    });
    expect(stateOf(status, '20301', 'To Bone Dungeon B1')).toBe('in-logic');
  });
});

describe('linked entrances', () => {
  // The bug this guards: a linked door was described purely by what lay beyond
  // it, so one sitting in a room you had no route to still showed green — while
  // the door right next to it correctly showed red. Two markers in the same
  // unreachable room must not disagree.
  test('a linked door you cannot reach is not green', () => {
    const farAway = entranceOf('40201', (LOCATIONS_DATA['40201'] ?? []).find((m) => m.type === 'door')?.name);

    const { status } = computeMarkerStatus({
      settings: SHUFFLED,
      discoveredLinks: { [BONE_ENTRANCE]: farAway, [farAway]: BONE_ENTRANCE },
    });

    expect(stateOf(status, '20301', 'Bone Dungeon Entrance')).toBe('unreachable');
  });

  test('markers in the same unreachable room agree with each other', () => {
    const farAway = entranceOf('40201', (LOCATIONS_DATA['40201'] ?? []).find((m) => m.type === 'door')?.name);

    const { status } = computeMarkerStatus({
      settings: SHUFFLED,
      discoveredLinks: { [BONE_ENTRANCE]: farAway, [farAway]: BONE_ENTRANCE },
    });

    expect(stateOf(status, '20301', 'Bone Dungeon Entrance'))
      .toBe(stateOf(status, '20301', 'To Bone Dungeon B1'));
  });

  test('a reachable linked door reports what is still behind it', () => {
    const { status } = computeMarkerStatus({
      settings: SHUFFLED,
      discoveredLinks: { [FORESTA_ICON]: BONE_ENTRANCE, [BONE_ENTRANCE]: FORESTA_ICON },
    });

    const state = status.get(marker('20301', 'Bone Dungeon Entrance').id);
    expect(['in-logic', 'unreachable']).toContain(state.state);
    expect(state.reason).toMatch(/behind it/);
  });
});

describe('opening a link changes what is reachable', () => {
  test('linking an overworld icon to a dungeon opens that dungeon', () => {
    const before = computeMarkerStatus({ settings: SHUFFLED });
    const after = computeMarkerStatus({
      settings: SHUFFLED,
      discoveredLinks: { [FORESTA_ICON]: BONE_ENTRANCE, [BONE_ENTRANCE]: FORESTA_ICON },
    });

    expect(before.strict.reachableEntrances.has(BONE_TO_B1)).toBe(false);
    expect(after.strict.reachableEntrances.has(BONE_TO_B1)).toBe(true);
  });

  // Pairing two overworld icons means "this icon leads where that one leads".
  // Resolving it to the subregion instead opened nothing, which is what made a
  // linked overworld icon appear to do nothing at all.
  test('pairing two overworld icons opens the destination, not the subregion', () => {
    const boneIcon = entranceOf('10101', 'Bone Dungeon');
    const result = computeMarkerStatus({
      settings: SHUFFLED,
      discoveredLinks: { [boneIcon]: FORESTA_ICON, [FORESTA_ICON]: boneIcon },
    });

    // Foresta town's doors should now be available.
    expect(stateOf(result.status, '20102', "Kaeli's House")).toBe('in-logic');
  });
});

describe('summarising a group', () => {
  test('agreement yields that state', () => {
    expect(summariseMarkerStates(['in-logic', 'in-logic'])).toBe('in-logic');
  });

  test('disagreement yields mixed, so a group never claims to be all green', () => {
    expect(summariseMarkerStates(['in-logic', 'unreachable'])).toBe('mixed');
  });

  test('unknown is ignored unless it is all there is', () => {
    expect(summariseMarkerStates(['in-logic', 'unknown'])).toBe('in-logic');
    expect(summariseMarkerStates(['unknown'])).toBe('unknown');
  });
});

describe('the palette', () => {
  test('every state the engine can report has a style', () => {
    for (const state of ['in-logic', 'out-of-logic', 'unreachable', 'mixed', 'unknown']) {
      expect(STATE_STYLES[state], state).toBeDefined();
      expect(STATE_STYLES[state].marker).toBeTruthy();
      expect(STATE_STYLES[state].label).toBeTruthy();
    }
  });
});

// A run with no shuffle used to be handed every vanilla pairing as if the
// player had walked it. That made "has a link" meaningless: every door was
// described by the little pocket of rooms directly behind it, with no
// unexplored exit left anywhere, so Foresta and Sand Temple both went red.
describe('a run that shuffles nothing', () => {
  const VANILLA = { mapShuffle: 'none', overworldShuffle: false, skyCoinMode: 'standard' };

  test('reachable doors still read as in logic', () => {
    const { status } = computeMarkerStatus({ settings: VANILLA });

    expect(stateOf(status, '10101', 'Foresta')).toBe('in-logic');
    expect(stateOf(status, '10101', 'Sand Temple')).toBe('in-logic');
  });

  test('and are not nagged about being unlinked', () => {
    const { status } = computeMarkerStatus({ settings: VANILLA });
    expect(status.get(marker('10101', 'Foresta').id).reason).toBe('reachable');
  });

  test('feeding the vanilla pairings in as discoveries is what broke it', () => {
    const { status } = computeMarkerStatus({
      settings: VANILLA,
      discoveredLinks: vanillaLinksFor(VANILLA),
    });
    expect(stateOf(status, '10101', 'Sand Temple')).not.toBe('in-logic');
  });
});
