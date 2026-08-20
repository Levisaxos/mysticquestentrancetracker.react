import itemGroups from '../data/ffmq/itemGroups.json';

/**
 * Evaluate the access requirements extracted from the Archipelago FFMQ world.
 *
 * Requirements are ANDed — upstream uses `state.has_all(...)` — and come in
 * these shapes:
 *
 *   { type: 'item',       item: 'Dragon Claw' }              hold this item
 *   { type: 'item',       item: 'Sky Fragment', count: 24 }  hold this many
 *   { type: 'anyOfGroup', group: 'Claws' }                   any of this class
 *   { type: 'never' }                                        impassable
 *
 * `held` maps a name to how many the player has. Event flags granted by
 * triggers live in the same map with a count of 1 — upstream treats events as
 * items, so we do too.
 */

/** Normalise item input into the name → count map the rules work against. */
export function toHeldMap(input) {
  if (input instanceof Map) return new Map(input);

  const held = new Map();
  if (!input) return held;

  if (Array.isArray(input)) {
    for (const name of input) held.set(name, (held.get(name) ?? 0) + 1);
    return held;
  }

  for (const [name, value] of Object.entries(input)) {
    // Boolean-style entries mean "have one"; numbers are counts.
    const count = typeof value === 'number' ? value : (value ? 1 : 0);
    if (count > 0) held.set(name, count);
  }
  return held;
}

const countOf = (held, name) => held.get(name) ?? 0;

export function meetsRequirements(requirements, held) {
  if (!requirements?.length) return true;
  for (const requirement of requirements) {
    if (!meetsOne(requirement, held)) return false;
  }
  return true;
}

function meetsOne(requirement, held) {
  switch (requirement.type) {
    case 'never':
      return false;

    case 'anyOfGroup': {
      const members = itemGroups[requirement.group];
      if (!members) return false;
      return members.some((member) => countOf(held, member) > 0);
    }

    case 'item':
      return countOf(held, requirement.item) >= (requirement.count ?? 1);

    default:
      // An unrecognised requirement counts as unmet rather than ignored:
      // over-reporting reachability is the more damaging failure for a tracker.
      return false;
  }
}

/** Which single requirement blocks this rule — for explaining a red marker. */
export function firstUnmet(requirements, held) {
  if (!requirements?.length) return null;
  return requirements.find((requirement) => !meetsOne(requirement, held)) ?? null;
}

/** Human-readable form of a requirement, for tooltips. */
export function describeRequirement(requirement, held) {
  if (!requirement) return null;

  switch (requirement.type) {
    case 'never':
      return 'permanently blocked';
    case 'anyOfGroup':
      return `any ${requirement.group.replace(/s$/, '').toLowerCase()}`;
    case 'item':
      if (requirement.count && requirement.count > 1) {
        const have = held ? countOf(held, requirement.item) : 0;
        return `${requirement.item} ×${requirement.count} (have ${have})`;
      }
      return requirement.item;
    default:
      return requirement.raw ?? 'unknown requirement';
  }
}
