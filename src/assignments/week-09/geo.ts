import type { Geometry, Position } from 'geojson';

export type Pin = [number, number]; // [lat, lng]

function outerRings(g: Geometry): Position[][] {
  if (g.type === 'Polygon') return [g.coordinates[0]];
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p[0]);
  return [];
}

// ray casting; region is [lng, lat][]
function inside([x, y]: Position, region: Position[]): boolean {
  let c = false;
  for (let i = 0, j = region.length - 1; i < region.length; j = i++) {
    const [xi, yi] = region[i];
    const [xj, yj] = region[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function fullyEnclosed(g: Geometry, pins: Pin[]): boolean {
  const region: Position[] = pins.map(([lat, lng]) => [lng, lat]);
  const rings = outerRings(g);
  return rings.length > 0 && rings.every((r) => r.every((pt) => inside(pt, region)));
}