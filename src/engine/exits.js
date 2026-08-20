import binding from '../data/binding.json';
import entrances from '../data/ffmq/entrances.json';
import { LOCATIONS_DATA } from '../constants/locationsData';
import { MAP_DATA } from '../constants/mapData';

const entranceById = new Map(entrances.map((e) => [e.id, e]));

// Reverse the binding: the engine talks in entrance ids, the map talks in
// marker ids, and the exits list needs to get from one to the other.
const markerByEntrance = new Map();
for (const [markerId, bound] of Object.entries(binding.markers)) {
  if (bound.kind === 'entrance') markerByEntrance.set(bound.entranceId, Number(markerId));
}

const floorByMarker = new Map();
for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
  for (const marker of markers) floorByMarker.set(marker.id, floorId);
}

const floorInfo = new Map();
for (const region of MAP_DATA.regions) {
  for (const location of region.locations) {
    for (const floor of location.floors) {
      floorInfo.set(String(floor.id), {
        floorId: floor.id,
        regionId: region.id,
        locationId: location.id,
        regionName: region.name,
        locationName: location.name,
        floorName: floor.name,
      });
    }
  }
}

/**
 * The exits you can reach but have not yet followed, grouped by floor.
 *
 * This is the tracker's to-do list, and it falls straight out of the
 * reachability pass: an entrance whose room you can get to, whose own
 * requirements you meet, and which has no pairing recorded.
 *
 * Exits whose marker the binding could not resolve are counted separately
 * rather than hidden — they are still real exits, we just cannot point at them
 * on the map yet.
 */
export function groupUnexploredExits(unexploredExits) {
  const byFloor = new Map();
  let unmapped = 0;

  for (const entranceId of unexploredExits) {
    const markerId = markerByEntrance.get(entranceId);
    const floorId = markerId != null ? floorByMarker.get(markerId) : null;
    const info = floorId != null ? floorInfo.get(floorId) : null;

    if (!info) {
      unmapped += 1;
      continue;
    }

    if (!byFloor.has(floorId)) byFloor.set(floorId, { ...info, exits: [] });
    byFloor.get(floorId).exits.push({
      entranceId,
      markerId,
      // Our marker names are often bare ("Exit", "Entrance"), so show the
      // canonical name too — "Bone Dungeon B1 - Checker Room - To Waterway"
      // actually tells you where you are.
      name: markerName(markerId, floorId) ?? `Entrance ${entranceId}`,
      canonicalName: entranceById.get(entranceId)?.name ?? null,
    });
  }

  const groups = [...byFloor.values()].sort((a, b) =>
    a.regionName.localeCompare(b.regionName) || a.locationName.localeCompare(b.locationName));

  return { groups, unmapped, total: unexploredExits.size ?? unexploredExits.length ?? 0 };
}

function markerName(markerId, floorId) {
  return (LOCATIONS_DATA[floorId] ?? []).find((m) => m.id === markerId)?.name ?? null;
}
