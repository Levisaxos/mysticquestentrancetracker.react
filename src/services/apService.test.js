import { describe, test, expect } from 'vitest';
import { settingsFromSlotData, markerByApLocation } from './apService';
import binding from '../data/binding.json';
import checks from '../data/ffmq/checks.json';

describe('reading settings out of slot data', () => {
  // 1.7 is detected by the presence of map_shuffle_seed rather than by version
  // number, because it lived in a fork before landing upstream.
  test('a room without map_shuffle_seed is treated as pre-1.7', () => {
    expect(settingsFromSlotData({})).toBeNull();
    expect(settingsFromSlotData(null)).toBeNull();
    expect(settingsFromSlotData({ map_shuffle: 2 })).toBeNull();
  });

  test('numeric option values map to their names, in upstream order', () => {
    const settings = settingsFromSlotData({
      map_shuffle_seed: 'ABCD',
      map_shuffle: 3,
      sky_coin_mode: 3,
      shattered_sky_coin_quantity: 0,
      logic: 2,
    });

    expect(settings.mapShuffle).toBe('everything');
    expect(settings.skyCoinMode).toBe('shattered_sky_coin');
    expect(settings.shatteredSkyCoinQuantity).toBe('low_16');
    expect(settings.logic).toBe('expert');
  });

  test('string option values pass through unchanged', () => {
    const settings = settingsFromSlotData({
      map_shuffle_seed: 'ABCD',
      map_shuffle: 'dungeons_mixed',
      sky_coin_mode: 'save_the_crystals',
    });

    expect(settings.mapShuffle).toBe('dungeons_mixed');
    expect(settings.skyCoinMode).toBe('save_the_crystals');
  });

  test('missing options fall back to a plain unshuffled game', () => {
    const settings = settingsFromSlotData({ map_shuffle_seed: 'ABCD' });

    expect(settings.mapShuffle).toBe('none');
    expect(settings.skyCoinMode).toBe('standard');
    expect(settings.overworldShuffle).toBe(false);
    expect(settings.logic).toBe('standard');
  });

  test('overworld shuffle is its own toggle, separate from map shuffle', () => {
    const settings = settingsFromSlotData({
      map_shuffle_seed: 'ABCD',
      map_shuffle: 0,
      overworld_shuffle: 1,
    });

    expect(settings.mapShuffle).toBe('none');
    expect(settings.overworldShuffle).toBe(true);
  });

  test('an out-of-range numeric option falls back rather than yielding undefined', () => {
    const settings = settingsFromSlotData({ map_shuffle_seed: 'ABCD', map_shuffle: 99 });
    expect(settings.mapShuffle).toBe('none');
  });
});

describe('mapping AP locations to our markers', () => {
  test('every mapped location is a real AP location', () => {
    const known = new Set(checks.map((c) => c.apLocationId));
    const unknown = [...markerByApLocation.keys()].filter((id) => !known.has(id));

    expect(unknown).toEqual([]);
  });

  test('every mapped marker is one we actually bound', () => {
    const bad = [...markerByApLocation.values()]
      .filter((markerId) => binding.markers[String(markerId)] === undefined);

    expect(bad).toEqual([]);
  });

  test('no two AP locations point at the same marker', () => {
    const markers = [...markerByApLocation.values()];
    expect(new Set(markers).size).toBe(markers.length);
  });

  // Honest accounting: the binding is incomplete, so a connected room will only
  // be able to tick off part of the map. Worth knowing rather than discovering.
  test('coverage is partial, and this records how partial', () => {
    const coverage = markerByApLocation.size;

    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThanOrEqual(checks.length);
  });
});
