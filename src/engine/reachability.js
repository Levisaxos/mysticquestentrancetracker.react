import overworldEntranceIds from '../data/ffmq/overworldEntrances.json';
import entranceLinks from '../data/ffmq/entranceLinks.json';
import checks from '../data/ffmq/checks.json';
import triggers from '../data/ffmq/triggers.json';
import internalLinks from '../data/ffmq/internalLinks.json';
import shufflingData from '../data/ffmq/shufflingData.json';
import { meetsRequirements, firstUnmet, toHeldMap } from './rules';
import { SKY_DOOR_ENTRANCE_ID, skyDoorRequirements, startsWithCoin } from './skyCoin';

// Where the player starts. Regions.py wires a menu region straight into
// "Overworld", which is room 0. Hardcoded rather than looked up so the engine
// does not have to pull the 148 KB rooms.json into the bundle for one constant;
// a test asserts it still matches the data.
const START_ROOM_ID = 0;

const TOWNS_TEMPLES = new Set(shufflingData.towns_temples ?? []);

// Whether an entrance belongs to the overworld is all the pool test needs, and
// it ships as a bare list of ids so the engine never loads the entrance table.
const OVERWORLD_ENTRANCES = new Set(overworldEntranceIds);

// Entering an entrance puts you in the room that entrance belongs to. The link
// that references it names that room, so this is the "where does this entrance
// come out" lookup used when following a discovered pairing.
const roomOfEntrance = new Map(entranceLinks.map((l) => [l.entranceId, l.fromRoomId]));
const linkByEntrance = new Map(entranceLinks.map((l) => [l.entranceId, l]));

const linkByEntranceExists = (entranceId) => roomOfEntrance.has(entranceId);

const linksByRoom = new Map();
for (const link of entranceLinks) {
  if (!linksByRoom.has(link.fromRoomId)) linksByRoom.set(link.fromRoomId, []);
  linksByRoom.get(link.fromRoomId).push(link);
}

// Internal connections (subregion plumbing). Never shuffled — they always go
// where the data says — but they do carry access rules.
const internalLinksByRoom = new Map();
for (const link of internalLinks) {
  if (!internalLinksByRoom.has(link.fromRoomId)) internalLinksByRoom.set(link.fromRoomId, []);
  internalLinksByRoom.get(link.fromRoomId).push(link);
}

const triggersByRoom = new Map();
for (const trigger of triggers) {
  if (!triggersByRoom.has(trigger.roomId)) triggersByRoom.set(trigger.roomId, []);
  triggersByRoom.get(trigger.roomId).push(trigger);
}

const checksByRoom = new Map();
for (const check of checks) {
  if (!checksByRoom.has(check.roomId)) checksByRoom.set(check.roomId, []);
  checksByRoom.get(check.roomId).push(check);
}

/**
 * Is this entrance part of the shuffled pool, given the run's settings?
 *
 * Mirrors RoomsGenerator.py: town and temple entrances only join the pool at
 * the "everything" level, and the overworld is its own independent toggle.
 */
export function isShuffled(entranceId, settings) {
  if (!linkByEntranceExists(entranceId)) return false;

  if (OVERWORLD_ENTRANCES.has(entranceId)) return Boolean(settings.overworldShuffle);

  if (!settings.mapShuffle || settings.mapShuffle === 'none') return false;
  if (TOWNS_TEMPLES.has(entranceId)) return settings.mapShuffle === 'everything';
  return true;
}

/**
 * Requirements for a link, after any settings-driven override.
 * The Sky Door is the one case upstream rewrites in code rather than data.
 */
function requirementsFor(link, settings) {
  if (link.entranceId === SKY_DOOR_ENTRANCE_ID) {
    const override = skyDoorRequirements(settings);
    if (override !== null) return override;
  }
  return link.requirements;
}

/**
 * Where does walking into this entrance put you?
 *
 *   not shuffled            -> the vanilla destination
 *   shuffled and paired     -> the room the partner entrance lives in
 *   shuffled and unpaired   -> unknown, and recorded as an exit still to explore
 */
function resolveDestination(link, settings, discoveredLinks) {
  if (!isShuffled(link.entranceId, settings)) return link.toRoomId;

  const partnerId = discoveredLinks[link.entranceId];
  if (partnerId === undefined || partnerId === null) return null;

  // A self-pairing is a dead end that loops back on itself.
  if (partnerId === link.entranceId) return link.fromRoomId;

  // Where you come out depends on what kind of entrance the partner is.
  //
  // Upstream pairs an overworld entrance with an *inside* one (446 "Overworld -
  // Foresta" <-> 38 "Foresta - Exit Foresta 1"), so pairing with an inside
  // entrance means you emerge at that door — its from-room.
  //
  // But on our world map both ends of a pair can be overworld icons, because
  // that is what a player sees: they stepped on one icon and arrived at another
  // place. Pairing two overworld entrances therefore means "this icon leads
  // where that icon leads" — the partner's *destination*, not its own spot.
  // Without this, linking two world-map markers resolves to the subregion you
  // were already standing in and opens nothing.
  const partnerLink = linkByEntrance.get(partnerId);
  if (!partnerLink) return null;

  return OVERWORLD_ENTRANCES.has(partnerId)
    ? partnerLink.toRoomId
    : partnerLink.fromRoomId;
}

/**
 * Work out everything the player can currently reach.
 *
 * Rooms, events and items feed each other — reaching a trigger grants an event,
 * which can open a link, which reaches another trigger — so this iterates to a
 * fixpoint rather than doing a single pass.
 *
 * @param {object}   options
 * @param {string[]} options.ownedItems      canonical item names the player holds
 * @param {object}   options.discoveredLinks entranceId -> paired entranceId
 * @param {object}   options.settings        { mapShuffle, overworldShuffle }
 */
export function computeReachability({ ownedItems = [], discoveredLinks = {}, settings = {} } = {}) {
  const held = toHeldMap(ownedItems);

  // "Start With" means the coin is already in the inventory.
  if (startsWithCoin(settings) && !held.has('Sky Coin')) held.set('Sky Coin', 1);

  const reachableRooms = new Set([START_ROOM_ID]);
  const grantedEvents = new Set();
  const unexploredExits = new Set();
  // Entrances you could actually walk into: their room is reachable and their
  // own requirements are met. Distinct from unexploredExits, which is the
  // subset of those that have no pairing yet.
  const reachableEntrances = new Set();

  let changed = true;
  while (changed) {
    changed = false;
    unexploredExits.clear();
    reachableEntrances.clear();

    for (const roomId of [...reachableRooms]) {
      // Internal plumbing first — no entrance, no shuffle, just a rule.
      for (const link of internalLinksByRoom.get(roomId) ?? []) {
        if (!meetsRequirements(link.requirements, held)) continue;
        if (link.toRoomId != null && !reachableRooms.has(link.toRoomId)) {
          reachableRooms.add(link.toRoomId);
          changed = true;
        }
      }

      for (const link of linksByRoom.get(roomId) ?? []) {
        if (!meetsRequirements(requirementsFor(link, settings), held)) continue;
        reachableEntrances.add(link.entranceId);

        const destination = resolveDestination(link, settings, discoveredLinks);
        if (destination === null) {
          unexploredExits.add(link.entranceId);
          continue;
        }
        if (!reachableRooms.has(destination)) {
          reachableRooms.add(destination);
          changed = true;
        }
      }

      // Standing in a room with a satisfied trigger grants its events, which
      // may unlock links elsewhere — hence the outer loop.
      for (const trigger of triggersByRoom.get(roomId) ?? []) {
        if (!meetsRequirements(trigger.requirements, held)) continue;
        for (const event of trigger.grants) {
          if (!grantedEvents.has(event)) {
            grantedEvents.add(event);
            held.set(event, 1);
            changed = true;
          }
        }
      }
    }
  }

  return {
    reachableRooms,
    reachableEntrances,
    grantedEvents,
    unexploredExits,
    held,
  };
}

/**
 * Status of every check, given a reachability result.
 *
 * `permissive` is the same computation with expert-only routes allowed; a check
 * reachable there but not here is "out of logic" rather than unreachable.
 */
export function classifyChecks(strict, permissive = null) {
  const status = new Map();

  for (const check of checks) {
    const inStrict = strict.reachableRooms.has(check.roomId)
      && meetsRequirements(check.requirements, strict.held);

    if (inStrict) {
      status.set(check.apLocationId, { state: 'in-logic', blockedBy: null });
      continue;
    }

    const inPermissive = permissive
      && permissive.reachableRooms.has(check.roomId)
      && meetsRequirements(check.requirements, permissive.held);

    status.set(check.apLocationId, {
      state: inPermissive ? 'out-of-logic' : 'unreachable',
      blockedBy: firstUnmet(check.requirements, strict.held),
    });
  }

  return status;
}

/** Summarise a set of checks into one colour, splitting when they disagree. */
export function summariseStates(states) {
  const present = new Set(states);
  if (!present.size) return 'none';
  if (present.size === 1) return [...present][0];
  return 'mixed';
}

export const startRoomId = START_ROOM_ID;
export { checks };
