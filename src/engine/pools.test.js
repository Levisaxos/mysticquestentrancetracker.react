import { describe, test, expect } from 'vitest';
import { poolOf, canPair, pairingProblem, vanillaPartnerOf, vanillaLinksFor, locationOf, fixedMarkerLinksFor } from './pools';
import binding from '../data/binding.json';
import entranceLinks from '../data/ffmq/entranceLinks.json';
import { LOCATIONS_DATA } from '../constants/locationsData';
import { MAP_DATA } from '../constants/mapData';

const e = (floorId, name) => binding.markers[
  String((LOCATIONS_DATA[floorId] ?? []).find((m) => m.name === name)?.id)
]?.entranceId;

const OVERWORLD_ICON = e('10101', 'Foresta');
const TOWN_DOOR = e('20102', "Kaeli's House");
const BONE_1F = e('20301', 'To Bone Dungeon B1');
const BONE_ENTRANCE = e('20301', 'Bone Dungeon Entrance');

const NONE = { mapShuffle: 'none', overworldShuffle: false };
const OVERWORLD_ONLY = { mapShuffle: 'none', overworldShuffle: true };
const INTERNAL = { mapShuffle: 'dungeons_internal', overworldShuffle: false };
const MIXED = { mapShuffle: 'dungeons_mixed', overworldShuffle: false };
const EVERYTHING = { mapShuffle: 'everything', overworldShuffle: true };

describe('which pool an entrance is in', () => {
  test('nothing is shuffled when the run has no shuffle', () => {
    expect(poolOf(OVERWORLD_ICON, NONE)).toBeNull();
    expect(poolOf(BONE_1F, NONE)).toBeNull();
    expect(poolOf(TOWN_DOOR, NONE)).toBeNull();
  });

  test('the overworld toggle only affects overworld entrances', () => {
    expect(poolOf(OVERWORLD_ICON, OVERWORLD_ONLY)).toBe('overworld');
    expect(poolOf(BONE_1F, OVERWORLD_ONLY)).toBeNull();
  });

  test('dungeon floors join at any dungeon mode', () => {
    expect(poolOf(BONE_1F, INTERNAL)).toBe('dungeon');
    expect(poolOf(BONE_1F, MIXED)).toBe('dungeon');
  });

  // Mirrors RoomsGenerator.py: towns and temples are held back until
  // "everything".
  test('towns and temples only join at "everything"', () => {
    expect(poolOf(TOWN_DOOR, MIXED)).toBeNull();
    expect(poolOf(TOWN_DOOR, EVERYTHING)).toBe('town-temple');
  });
});

describe('which pairings are allowed', () => {
  test('nothing may be paired when nothing is shuffled', () => {
    expect(canPair(BONE_1F, BONE_ENTRANCE, NONE)).toBe(false);
    expect(pairingProblem(BONE_1F, BONE_ENTRANCE, NONE)).toMatch(/not shuffled/);
  });

  test('the overworld never mixes with interiors', () => {
    expect(canPair(OVERWORLD_ICON, BONE_1F, EVERYTHING)).toBe(false);
    expect(pairingProblem(OVERWORLD_ICON, BONE_1F, EVERYTHING)).toMatch(/shuffled separately/);
  });

  test('overworld icons pair with each other', () => {
    const other = e('10101', 'Bone Dungeon');
    expect(canPair(OVERWORLD_ICON, other, EVERYTHING)).toBe(true);
  });

  test('dungeon floors pair freely when mixed', () => {
    const icePyramid = (LOCATIONS_DATA['40201'] ?? []).find((m) => m.type === 'door');
    const iceEntrance = binding.markers[String(icePyramid.id)]?.entranceId;

    expect(canPair(BONE_1F, iceEntrance, MIXED)).toBe(true);
  });

  // The rule that gives "Dungeons Internal" its name.
  test('dungeons internal keeps floors inside their own dungeon', () => {
    const icePyramid = (LOCATIONS_DATA['40201'] ?? []).find((m) => m.type === 'door');
    const iceEntrance = binding.markers[String(icePyramid.id)]?.entranceId;

    expect(canPair(BONE_1F, BONE_ENTRANCE, INTERNAL)).toBe(true);
    expect(canPair(BONE_1F, iceEntrance, INTERNAL)).toBe(false);
    expect(pairingProblem(BONE_1F, iceEntrance, INTERNAL)).toMatch(/same dungeon/);
  });

  test('a dead end may loop back on itself', () => {
    expect(canPair(BONE_1F, BONE_1F, MIXED)).toBe(true);
  });

  test('two entrances in the same dungeon share a location', () => {
    expect(locationOf(BONE_1F)).toBe(locationOf(BONE_ENTRANCE));
  });
});

describe('vanilla pairings', () => {
  test('an entrance knows its vanilla other side', () => {
    expect(vanillaPartnerOf(BONE_ENTRANCE)).not.toBeNull();
  });

  test('vanilla pairing is symmetric', () => {
    const partner = vanillaPartnerOf(BONE_ENTRANCE);
    expect(vanillaPartnerOf(partner)).toBe(BONE_ENTRANCE);
  });

  test('most entrances have a known vanilla side', () => {
    const known = entranceLinks.filter((l) => vanillaPartnerOf(l.entranceId) != null).length;
    expect(known / entranceLinks.length).toBeGreaterThan(0.8);
  });
});

describe('pre-filled vanilla links', () => {
  test('an unshuffled run comes fully linked', () => {
    const links = vanillaLinksFor(NONE);
    expect(Object.keys(links).length).toBeGreaterThan(250);
  });

  test('shuffled entrances are left for the player', () => {
    const links = vanillaLinksFor(EVERYTHING);
    expect(links[BONE_1F]).toBeUndefined();
    expect(links[OVERWORLD_ICON]).toBeUndefined();
  });

  // The case that caused real confusion: with only dungeons shuffled, town
  // doors have fixed destinations and should already be filled in.
  test('a dungeons-only run pre-fills the towns but not the dungeons', () => {
    const links = vanillaLinksFor(MIXED);

    expect(links[TOWN_DOOR]).toBeDefined();
    expect(links[BONE_1F]).toBeUndefined();
  });

  test('overworld icons are pre-filled unless overworld shuffle is on', () => {
    expect(vanillaLinksFor(INTERNAL)[OVERWORLD_ICON]).toBeDefined();
    expect(vanillaLinksFor(OVERWORLD_ONLY)[OVERWORLD_ICON]).toBeUndefined();
  });
});

const marker = (floorId, name) => (LOCATIONS_DATA[floorId] ?? []).find((m) => m.name === name)?.id;

describe('fixed destinations on our own maps', () => {
  test('an unshuffled overworld icon leads to the door it opens', () => {
    const links = fixedMarkerLinksFor(NONE);

    expect(links.get(marker('10101', 'Bone Dungeon')))
      .toBe(marker('20301', 'Bone Dungeon Entrance'));
    expect(links.get(marker('10101', 'Sand Temple')))
      .toBe(marker('20501', 'Sand Temple Entrance'));
  });

  test('shuffled doors have no fixed destination to show', () => {
    expect(fixedMarkerLinksFor(EVERYTHING).size).toBe(0);
  });

  // Falls Basin used to claim it led into Bone Dungeon: our Bone Dungeon B2
  // sheet had been handed the game's Fall Basin area on geometry alone, because
  // no name could vouch for the right one either way.
  test('Falls Basin leads into Falls Basin', () => {
    const target = fixedMarkerLinksFor(NONE).get(marker('10101', 'Falls Basin'));
    expect(LOCATIONS_DATA['40301'].map((m) => m.id)).toContain(target);
  });

  // Naming nothing beats naming the wrong dungeon. Stated as a property rather
  // than by example, so it keeps holding as sheets get bound properly and the
  // set of coin-flip floors shrinks.
  test('no destination is named from a floor matched on geometry alone', () => {
    const floorOfMarker = new Map();
    for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
      for (const m of markers) floorOfMarker.set(m.id, floorId);
    }
    const coinFlip = (markerId) => binding.floors[floorOfMarker.get(markerId)]?.confidence === 'geometry-only';

    for (const [from, to] of fixedMarkerLinksFor(NONE)) {
      expect(coinFlip(from), `marker ${from}`).toBe(false);
      expect(coinFlip(to), `marker ${to}`).toBe(false);
    }
  });

  // The Bone Dungeon B2 sheets are drawn one room per sheet where the game
  // keeps the whole basement in one area, so no automatic pass can place them.
  // They are stated by hand in bindingOverrides.json instead.
  test('hand-stated sheets connect through the Two Skulls Room', () => {
    const links = fixedMarkerLinksFor(NONE);

    expect(links.get(marker('20306', 'Right'))).toBe(marker('20307', 'Exit to 2F'));
    expect(links.get(marker('20306', 'Left'))).toBe(marker('20308', 'Main Exit'));
    expect(links.get(marker('20306', 'Exit'))).toBe(marker('20309', 'To Spencer Cave'));
    expect(links.get(marker('20303', 'Entrance')))
      .toBe(marker('20302', 'Waterway - Exit Waterway'));
    expect(links.get(marker('20105', 'Entrance'))).toBe(marker('20102', 'Rest House'));
  });

  // Every one of these was thrown away by the old substring name test, which
  // could not see that "Pazuzu's Tower" and the area "Pazuzu 1F" are the same
  // place, so the whole tower and the whole of Mac's Ship went unmatched.
  test('stairs within one dungeon connect to each other', () => {
    const links = fixedMarkerLinksFor(NONE);

    expect(links.get(marker('60401', 'South Stairs'))).toBe(marker('60402', 'South Stairs'));
    expect(links.get(marker('20103', "Kaeli's House Entrance")))
      .toBe(marker('20102', "Kaeli's House"));
  });
});

// A door only leaves its region in ways you can name, so anything else on this
// list is a sheet bound to the wrong area — that is how Pazuzu's Tower came to
// open into the Lava Dome. Stated as an allowlist rather than a warning,
// because the wrong ones look exactly like the right ones until you read the
// region names.
describe('links that cross regions', () => {
  const EXPECTED = new Set([
    'Water Region → Fire Region',   // Gemini crest, Aquaria to Fireburg
    'Wind Region → Fire Region',    // Mobius crest, Windia to Fireburg
    'Fire Region → Water Region',
    'Fire Region → Wind Region',
    'Other Regions → Center of the World', // Doom Castle to Focus Tower
    'Center of the World → Other Regions',
  ]);

  test('are only the world map, the crests, and Doom Castle', () => {
    const region = new Map();
    for (const r of MAP_DATA.regions) {
      for (const l of r.locations) for (const f of l.floors) region.set(String(f.id), r.name);
    }
    const floorOf = new Map();
    for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
      for (const m of markers) floorOf.set(m.id, floorId);
    }

    const surprises = [];
    for (const [from, to] of fixedMarkerLinksFor(NONE)) {
      const a = region.get(floorOf.get(from));
      const b = region.get(floorOf.get(to));
      if (!a || !b || a === b) continue;
      if (a === 'World Map' || b === 'World Map') continue;
      const crossing = `${a} → ${b}`;
      if (!EXPECTED.has(crossing)) surprises.push(`${crossing} (m${from} -> m${to})`);
    }

    expect(surprises).toEqual([]);
  });
});
