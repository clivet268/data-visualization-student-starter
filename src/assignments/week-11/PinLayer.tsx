import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Marker, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import styles from './spillover.module.css';
import { pinStack, type Pin } from './geo';
const DRAGGING_CLASS = 'spillover-pin-dragging';

const pinIcon = L.divIcon({ className: styles.pin, iconSize: [18, 18], iconAnchor: [9, 9] });
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const PIN_MODE_CLASS = 'spillover-pin-mode'; // plain global class on purpose, not a CSS-module one
const STYLE_ID = 'spillover-pin-cursor-style';

type Pt = { x: number; y: number };
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
// proper crossing only; segments that merely share an endpoint don't count
const segsCross = (a: Pt, b: Pt, c: Pt, d: Pt) =>
  cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;

// Adds a pin and returns the whole list in an order that does not self-intersect.
function insertPin(map: L.Map, list: Pin[], at: L.LatLng): { list: Pin[]; pin: Pin } {
  const p: Pin = [at.lat, at.lng];
  if (list.length < 3) return { list: [...list, p], pin: p };

  const z = map.getZoom();
  const proj = (ll: L.LatLngExpression) => map.project(L.latLng(ll), z);
  const pts = list.map(proj);
  const q = proj(at);
  const n = pts.length;

  let best = -1;
  let bestCost = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const cost = a.distanceTo(q) + q.distanceTo(b) - a.distanceTo(b); // perimeter added by this insertion
    if (cost >= bestCost) continue;

    let clean = true;
    for (let j = 0; j < n && clean; j++) {
      if (j === i) continue; // that's the edge being replaced
      const c = pts[j];
      const d = pts[(j + 1) % n];
      if (segsCross(a, q, c, d) || segsCross(q, b, c, d)) clean = false;
    }
    if (clean) { best = i; bestCost = cost; }
  }

  if (best >= 0) return { list: [...list.slice(0, best + 1), p, ...list.slice(best + 1)], pin: p };


  // no clean insertion exists: re-order every pin by angle around their center
  const all: { pin: Pin; pt: Pt }[] = [...list, p].map((pin) => ({ pin, pt: proj(pin) }));
  const cx = all.reduce((s, o) => s + o.pt.x, 0) / all.length;
  const cy = all.reduce((s, o) => s + o.pt.y, 0) / all.length;
  all.sort((u, v) => Math.atan2(u.pt.y - cy, u.pt.x - cx) - Math.atan2(v.pt.y - cy, v.pt.x - cx));
  return { list: all.map((o) => o.pin), pin: p };
}

interface PinLayerProps {
  active: boolean;
  pins: Pin[];
  setPins: (pins: Pin[]) => void;
}

export function PinLayer({ active, pins, setPins }: PinLayerProps) {
  const map = useMap();
  const [draft, setDraft] = useState<Pin[] | null>(null); // live positions while dragging
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

// hotspot = the pixel in the image that counts as the click point.
// Lower x moves the image right, lower y moves it down.
const CURSOR_HOTSPOT = { x: 16, y: 32 };

useEffect(() => {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const cursor = `url("${import.meta.env.BASE_URL}spillovercursor.png") ${CURSOR_HOTSPOT.x} ${CURSOR_HOTSPOT.y}, crosshair`;
  el.textContent = `
    /* Apply custom cursor and hotspot ONLY to the parent layer container */
    .${PIN_MODE_CLASS} { 
      cursor: ${cursor} !important; 
    } 
    
    /* Force inner child elements to inherit the parent pointer context instead of breaking it */
    .${PIN_MODE_CLASS} * { 
      cursor: inherit !important; 
    }
    .${PIN_MODE_CLASS} .leaflet-marker-draggable { cursor: grab !important; }
    .${PIN_MODE_CLASS} .leaflet-control, .${PIN_MODE_CLASS} .leaflet-control * { cursor: pointer !important; }
    .${DRAGGING_CLASS}.${DRAGGING_CLASS}.${DRAGGING_CLASS},
    .${DRAGGING_CLASS}.${DRAGGING_CLASS}.${DRAGGING_CLASS} * { cursor: grabbing !important; }
  `;
}, []);

  // class goes straight onto Leaflet's container (setting className via React would wipe Leaflet's own)
  useEffect(() => {
  const el = map.getContainer();
  el.classList.toggle(PIN_MODE_CLASS, active);
  return () => {
    el.classList.remove(PIN_MODE_CLASS);
    document.documentElement.classList.remove(DRAGGING_CLASS);
  };
}, [map, active]);

  useMapEvents({
    click: (e) => {
  if (!active) return;
  const { list, pin } = insertPin(map, pinsRef.current, e.latlng);
  pinStack.push(pin);
  setPins(list);
},
  });

  if (!active) return null;

  const shown = draft ?? pins;
  const region = cssVar('--pin-region');
  const path = { color: region, fillColor: region, fillOpacity: 0.12, weight: 2, dashArray: '6 6', interactive: false };
  const moved = (i: number, e: L.LeafletEvent): Pin[] => {
    const ll = (e.target as L.Marker).getLatLng();
    return pinsRef.current.map((p, j) => (j === i ? ([ll.lat, ll.lng] as Pin) : p));
  };

  return (
    <>
      {shown.length >= 3 && <Polygon positions={shown} pathOptions={path} />}
      {shown.length === 2 && <Polyline positions={shown} pathOptions={path} />}
      {shown.map((p, i) => (
        <Marker
          key={i}
          position={p}
          icon={pinIcon}
          draggable
          eventHandlers={{
  dragstart: () => document.documentElement.classList.add(DRAGGING_CLASS),
  drag: (e) => setDraft(moved(i, e)),
  dragend: (e) => {
    document.documentElement.classList.remove(DRAGGING_CLASS);
    const next = moved(i, e);
    const k = pinStack.indexOf(pinsRef.current[i]);
    if (k >= 0) pinStack[k] = next[i]; // keep its place in the undo order after being dragged
    setPins(next);
    setDraft(null);
  },
  contextmenu: () => setPins(pinsRef.current.filter((_, j) => j !== i)),
}}
        />
      ))}
    </>
  );
}