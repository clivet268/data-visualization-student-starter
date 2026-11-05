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

// removes one pin; a group left empty is deleted and the active index is kept pointing at a real group
export function dropPin(groups: Pin[][], active: number, gi: number, i: number): { groups: Pin[][]; active: number } {
  const g = groups[gi].filter((_, j) => j !== i);
  if (g.length > 0) return { groups: groups.map((x, k) => (k === gi ? g : x)), active };
  const next = groups.filter((_, k) => k !== gi);
  const a = gi < active ? active - 1 : active;
  return { groups: next, active: Math.max(0, Math.min(a, next.length - 1)) };
}

// total outlined area over every group that has 3+ pins; null if none do
export function pinGroupsAcres(groups: Pin[][]): number | null {
  const areas = groups.map(pinAreaAcres).filter((a): a is number => a !== null);
  return areas.length ? areas.reduce((s, a) => s + a, 0) : null;
}

export type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

export function bboxOf(g: Geometry): BBox | null {
  if (g.type === 'GeometryCollection') return null;
  const b: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') {
      const [x, y] = c as number[];
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    } else c.forEach(walk);
  };
  walk(g.coordinates);
  return Number.isFinite(b[0]) ? b : null;
}

// index of the box nearest the point (distance 0 when inside it), only among boxes where ok(i) is true; -1 if none
export function nearestBox(boxes: (BBox | null)[], lat: number, lng: number, ok: (i: number) => boolean): number {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = -1;
  let bestD = Infinity;
  let bestC = Infinity;
  boxes.forEach((b, i) => {
    if (!b || !ok(i)) return;
    const d = Math.hypot(Math.max(b[0] - lng, 0, lng - b[2]) * k, Math.max(b[1] - lat, 0, lat - b[3]));
    const cd = Math.hypot(((b[0] + b[2]) / 2 - lng) * k, (b[1] + b[3]) / 2 - lat); // tie-break: closest centre
    if (d < bestD || (d === bestD && cd < bestC)) { best = i; bestD = d; bestC = cd; }
  });
  return best;
}
