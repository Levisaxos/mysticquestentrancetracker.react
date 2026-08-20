import { ITEMS_DATA } from './itemsData';

// Our icon set predates the canonical item list, so two names differ in
// spelling. Rather than rename the files (and break anyone's fork), map them.
const ALIASES = {
  "Gaia's Armor": 'Gaia Armor',
  'Knight Sword': "Knight's Sword",
};

// "Progressive X" is a placeholder the randomiser hands out when progressive
// gear is enabled; it has no art of its own, so it borrows the first tier's.
const PROGRESSIVE_ART = {
  'Progressive Sword': 'Steel Sword',
  'Progressive Axe': 'Axe',
  'Progressive Claw': 'Cat Claw',
  'Progressive Bomb': 'Bomb',
  'Progressive Helm': 'Steel Helm',
  'Progressive Armor': 'Steel Armor',
  'Progressive Shield': 'Steel Shield',
  'Progressive Accessory': 'Charm',
};

const normalise = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

const byName = new Map();
for (const category of ITEMS_DATA.categories) {
  for (const item of category.items) {
    byName.set(normalise(item.name), item.imagePath);
  }
}

/**
 * Icon path for a canonical FFMQ item name, or null if we have no art.
 *
 * Only the consumables and refills come back null, and those are filler items
 * a tracker has no reason to show.
 */
export function iconFor(canonicalName) {
  const lookup = ALIASES[canonicalName] ?? PROGRESSIVE_ART[canonicalName] ?? canonicalName;
  return byName.get(normalise(lookup)) ?? null;
}
