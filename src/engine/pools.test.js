import { describe, test, expect } from 'vitest';
import { poolOf, canPair, pairingProblem, vanillaPartnerOf, vanillaLinksFor, locationOf } from './pools';
import binding from '../data/binding.json';
import entranceLinks from '../data/ffmq/entranceLinks.json';
import { LOCATIONS_DATA } from '../constants/locationsData';

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
