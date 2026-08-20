import { LOCATIONS_DATA } from './locationsData';
import { MAP_DATA } from './mapData';

// Where every marker lives, so a linked door can say where it goes by name
// rather than by id.
const lookup = new Map();

const floorLabels = new Map();
for (const region of MAP_DATA.regions) {
  for (const location of region.locations) {
    for (const floor of location.floors) {
      floorLabels.set(String(floor.id), {
        short: `${location.name} · ${floor.name}`,
        full: `${region.name} · ${location.name} · ${floor.name}`,
        regionId: region.id,
        locationId: location.id,
        floorId: floor.id,
      });
    }
  }
}

for (const [floorId, markers] of Object.entries(LOCATIONS_DATA)) {
  const floor = floorLabels.get(floorId);
  for (const marker of markers) {
    lookup.set(marker.id, { ...marker, floorId, floor: floor ?? null });
  }
}

/** Marker details by id, including which floor it sits on. */
export function findMarker(markerId) {
  return lookup.get(markerId) ?? null;
}

/** "Bone Dungeon · First Floor — Entrance", for describing a link target. */
export function describeMarkerLocation(markerId) {
  const marker = findMarker(markerId);
  if (!marker) return `location ${markerId}`;
  if (!marker.floor) return marker.name;
  return `${marker.floor.short} — ${marker.name}`;
}
