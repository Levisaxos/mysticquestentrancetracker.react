import binding from '../data/binding.json';
import checks from '../data/ffmq/checks.json';
import internalLinks from '../data/ffmq/internalLinks.json';
import overworldEntranceIds from '../data/ffmq/overworldEntrances.json';
import entranceLinks from '../data/ffmq/entranceLinks.json';
import { computeReachability, classifyChecks, isShuffled } from './reachability';
import { firstUnmet, describeRequirement, meetsRequirements } from './rules';

const checkByApId = new Map(checks.map((c) => [c.apLocationId, c]));
const roomOfEntrance = new Map(entranceLinks.map((l) => [l.entranceId, l.fromRoomId]));
const linkByEntrance = new Map(entranceLinks.map((l) => [l.entranceId, l]));
const overworldEntrances = new Set(overworldEntranceIds);

const entranceLinksByRoom = new Map();
for (const link of entranceLinks) {
  if (!entranceLinksByRoom.has(link.fromRoomId)) entranceLinksByRoom.set(link.fromRoomId, []);
  entranceLinksByRoom.get(link.fromRoomId).push(link);
}

// Mirrors resolveDestination: pairing with an overworld icon means "leads where
// that icon leads"; pairing with an inside door means you emerge at that door.
function destinationRoomOf(partnerId) {
  const partnerLink = linkByEntrance.get(partnerId);
  if (!partnerLink) return null;
  return overworldEntrances.has(partnerId) ? partnerLink.toRoomId : partnerLink.fromRoomId;
}

const checksByRoom = new Map();
for (const check of checks) {
  if (!checksByRoom.has(check.roomId)) checksByRoom.set(check.roomId, []);
  checksByRoom.get(check.roomId).push(check);
}

// Rooms joined by internal plumbing rather than a door. Walking through an
// entrance drops you into a connected space, not a single room, so "what is
// behind this door" means this cluster — not the whole graph beyond it, which
// would make every linked door the same colour.
const internalNeighbours = new Map();
for (const link of internalLinks) {
  if (!internalNeighbours.has(link.fromRoomId)) internalNeighbours.set(link.fromRoomId, []);
  internalNeighbours.get(link.fromRoomId).push(link);
}

function spaceBehind(roomId, held) {
  const seen = new Set([roomId]);
  const queue = [roomId];

  while (queue.length) {
    const current = queue.shift();
    for (const link of internalNeighbours.get(current) ?? []) {
      if (seen.has(link.toRoomId)) continue;
      if (!meetsRequirements(link.requirements, held)) continue;
      seen.add(link.toRoomId);
      queue.push(link.toRoomId);
    }
  }

  return seen;
}

/**
 * Reachability state for each of our map markers.
 *
 * The engine works in canonical terms — rooms, entrances, AP location ids — so
 * this walks the binding to translate that into something the map can colour.
 *
 * Markers the binding could not resolve come back as `unknown` rather than
 * being guessed at. Colouring an unbound marker green would be a confident lie.
 */
export function computeMarkerStatus({
  ownedItems = {},
  discoveredLinks = {},
  settings = {},
  collectedApIds = new Set(),
} = {}) {
  const strict = computeReachability({ ownedItems, discoveredLinks, settings });

  // The permissive pass allows the routes FFMQ calls "expert": crest
  // teleporters, the Fireburg-Aquaria lava bridge and the Sealed Temple exit
  // trick. Anything reachable there but not under the player's own logic level
  // is out of logic rather than unreachable.
  const permissive = settings.logic === 'expert'
    ? null
    : computeReachability({
      ownedItems,
      discoveredLinks,
      settings: { ...settings, logic: 'expert' },
    });

  const checkStates = classifyChecks(strict, permissive);
  const context = { strict, permissive, checkStates, collectedApIds, discoveredLinks, settings };
  const status = new Map();

  for (const [markerId, bound] of Object.entries(binding.markers)) {
    status.set(Number(markerId), describeMarker(bound, context));
  }

  // The two things a player wants a running total of: exits they could walk
  // through but haven't, and checks they could collect but haven't.
  const checksLeft = checks.filter((check) => (
    !collectedApIds.has(check.apLocationId)
    && checkStates.get(check.apLocationId)?.state === 'in-logic'
  )).length;

  return {
    status,
    strict,
    permissive,
    counts: {
      doorsLeft: strict.unexploredExits.size,
      checksLeft,
    },
  };
}

function describeMarker(bound, context) {
  if (bound.kind === 'entrance') return describeEntrance(bound, context);
  return describeCheck(bound, context);
}

function describeEntrance(bound, context) {
  const { strict, permissive, discoveredLinks, settings } = context;

  const partnerId = discoveredLinks[bound.entranceId];
  if (partnerId != null) {
    // Being linked does not mean being reachable. A door you recorded a link
    // for can still sit in a room you have no route to — and describing it by
    // what lies beyond would paint it green while you cannot even get to it,
    // which is exactly the wrong signal. Reachability comes first.
    if (strict.reachableEntrances.has(bound.entranceId)) {
      return describeBehindDoor(bound, partnerId, context);
    }
    if (permissive?.reachableEntrances.has(bound.entranceId)) {
      return { state: 'out-of-logic', reason: 'linked, but only reachable out of logic' };
    }
    return { state: 'unreachable', reason: 'linked, but you cannot reach this side yet' };
  }

  if (strict.reachableEntrances.has(bound.entranceId)) {
    // "not yet linked" is a to-do, so only say it where linking is the player's
    // job. A door this run does not shuffle already goes where it goes.
    return {
      state: 'in-logic',
      reason: isShuffled(bound.entranceId, settings) ? 'reachable, not yet linked' : 'reachable',
    };
  }
  if (permissive?.reachableEntrances.has(bound.entranceId)) {
    return { state: 'out-of-logic', reason: 'only reachable out of logic' };
  }
  return { state: 'unreachable', reason: 'cannot get here yet' };
}

function describeBehindDoor(bound, partnerId, context) {
  const { strict, checkStates, collectedApIds, discoveredLinks } = context;

  const destination = partnerId === bound.entranceId
    ? roomOfEntrance.get(bound.entranceId)
    : destinationRoomOf(partnerId);

  if (destination === undefined || destination === null) {
    return { state: 'unknown', reason: 'linked, but the far side is not mapped' };
  }

  const rooms = spaceBehind(destination, strict.held);

  // "Anything to do behind this door" is not just chests and boxes — an exit
  // you have not followed yet is a thing to do as well.
  const behindChecks = [...rooms]
    .flatMap((roomId) => checksByRoom.get(roomId) ?? [])
    .filter((c) => !collectedApIds.has(c.apLocationId));

  const behindExits = [...rooms]
    .flatMap((roomId) => entranceLinksByRoom.get(roomId) ?? [])
    .filter((l) => discoveredLinks[l.entranceId] == null);

  const available = behindChecks.filter(
    (c) => checkStates.get(c.apLocationId)?.state === 'in-logic'
  ).length;
  const reachableExits = behindExits.filter(
    (l) => strict.reachableEntrances.has(l.entranceId)
  ).length;

  const todo = available + reachableExits;

  if (todo > 0) {
    const parts = [];
    if (available) parts.push(`${available} check${available === 1 ? '' : 's'}`);
    if (reachableExits) parts.push(`${reachableExits} unexplored exit${reachableExits === 1 ? '' : 's'}`);
    return { state: 'in-logic', reason: `${parts.join(' and ')} behind it` };
  }

  const remaining = behindChecks.length + behindExits.length;
  return {
    state: 'unreachable',
    reason: remaining
      ? `${remaining} thing${remaining === 1 ? '' : 's'} behind it, none reachable yet`
      : 'nothing left behind it',
  };
}

function describeCheck(bound, context) {
  const { strict, checkStates, collectedApIds } = context;

  // Battlegrounds resolve to a subregion rather than a single battlefield.
  // Every battlefield in one subregion shares a room, so they share
  // reachability — enough to colour, even without knowing which one it is.
  if (bound.confidence === 'room-only') {
    const candidates = (bound.candidates ?? [])
      .map((id) => checkByApId.get(id))
      .filter(Boolean);

    if (!candidates.length) return { state: 'unknown', reason: 'not yet matched to a game location' };

    const outstanding = candidates.filter((c) => !collectedApIds.has(c.apLocationId));
    const pool = outstanding.length ? outstanding : candidates;
    const summary = summariseMarkerStates(pool.map((c) => checkStates.get(c.apLocationId)?.state ?? 'unreachable'));

    return { state: summary, reason: reachableReason(summary) };
  }

  if (bound.confidence === 'unresolved') {
    return { state: 'unknown', reason: 'not yet matched to a game location' };
  }

  const check = checkByApId.get(bound.apLocationId);
  const state = checkStates.get(bound.apLocationId);
  if (!check || !state) return { state: 'unknown', reason: 'not yet matched to a game location' };

  if (state.state === 'in-logic') return { state: 'in-logic', reason: 'available now' };
  if (state.state === 'out-of-logic') return { state: 'out-of-logic', reason: 'only available out of logic' };

  const blocker = firstUnmet(check.requirements, strict.held);
  return {
    state: 'unreachable',
    reason: blocker ? `needs ${describeRequirement(blocker, strict.held)}` : 'cannot get here yet',
  };
}

function reachableReason(state) {
  switch (state) {
    case 'in-logic': return 'available now';
    case 'out-of-logic': return 'only available out of logic';
    case 'mixed': return 'some available, some not';
    default: return 'cannot get here yet';
  }
}

/**
 * One colour for a group of markers, splitting when they disagree.
 *
 * A group rendered entirely green when only some of it is reachable is worse
 * than no colour at all, so mixed is its own state rather than a majority vote.
 */
export function summariseMarkerStates(states) {
  const meaningful = states.filter((s) => s !== 'unknown');
  if (!meaningful.length) return 'unknown';

  const distinct = new Set(meaningful);
  if (distinct.size === 1) return [...distinct][0];
  return 'mixed';
}

/** Tailwind classes per state, so the palette lives in one place. */
export const STATE_STYLES = {
  'in-logic': {
    marker: 'bg-green-600 hover:bg-green-500 border-green-300',
    label: 'In logic',
  },
  'out-of-logic': {
    marker: 'bg-yellow-500 hover:bg-yellow-400 border-yellow-200',
    label: 'Out of logic',
  },
  unreachable: {
    marker: 'bg-red-700 hover:bg-red-600 border-red-400',
    label: 'No access',
  },
  mixed: {
    // A visible split rather than a blend, so "some of these" never reads as
    // "all of these".
    marker: 'bg-gradient-to-br from-green-600 to-red-700 hover:from-green-500 hover:to-red-600 border-yellow-200',
    label: 'Partly available',
  },
  unknown: {
    marker: 'bg-gray-600 hover:bg-gray-500 border-slate-400',
    label: 'Unknown',
  },
};
