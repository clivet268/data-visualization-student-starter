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

// pins in the order they were placed (by object identity), so "remove last pin" can undo placement order
export const pinStack: Pin[] = [];

// spherical polygon area of the pin outline, in acres; null until there are 3 pins
export function pinAreaAcres(pins: Pin[]): number | null {
  if (pins.length < 3) return null;
  const R = 6378137;
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < pins.length; i++) {
    const [lat1, lng1] = pins[i];
    const [lat2, lng2] = pins[(i + 1) % pins.length];
    sum += (lng2 - lng1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((sum * R * R) / 2) / 4046.8564224;
}