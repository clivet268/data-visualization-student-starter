import { Fragment, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Marker, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import styles from './spillover.module.css';
import { dropPin, pinStack, type Pin } from './geo';
const DRAGGING_CLASS = 'spillover-pin-dragging';

const pinIcon = L.divIcon({ className: styles.pin, iconSize: [18, 18], iconAnchor: [9, 9] });
const pinIconInactive = L.divIcon({
  className: `${styles.pin} ${styles.pinInactive}`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
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
  groups: Pin[][];
  setGroups: (groups: Pin[][]) => void;
  activeGroup: number;
  setActiveGroup: (i: number) => void;
}

// hotspot = the pixel in the image that counts as the click point.
// Lower x moves the image right, lower y moves it down.
const CURSOR_HOTSPOT = { x: 16, y: 32 };

export function PinLayer({ active, groups, setGroups, activeGroup, setActiveGroup }: PinLayerProps) {
  const map = useMap();
  const [draft, setDraft] = useState<Pin[][] | null>(null); // live positions while dragging
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const activeRef = useRef(activeGroup);
  activeRef.current = activeGroup;

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

  // shift+click would otherwise start Leaflet's shift-drag box zoom
  useEffect(() => {
    if (!active) return;
    map.boxZoom.disable();
    return () => {
      map.boxZoom.enable();
    };
  }, [map, active]);

  useMapEvents({
    click: (e) => {
      if (!active) return;
      const oe = e.originalEvent;
      if (oe.ctrlKey || oe.metaKey) return; // ctrl/cmd-click switches the active group instead

      const all = groupsRef.current;
      if (oe.shiftKey || all.length === 0) {
        // shift starts a brand new group
        const pin: Pin = [e.latlng.lat, e.latlng.lng];
        pinStack.push(pin);
        setGroups([...all, [pin]]);
        setActiveGroup(all.length);
        return;
      }
      const gi = Math.min(activeRef.current, all.length - 1);
      const { list, pin } = insertPin(map, all[gi], e.latlng);
      pinStack.push(pin);
      setGroups(all.map((g, k) => (k === gi ? list : g)));
      setActiveGroup(gi);
    },
  });

  if (!active) return null;

  const shown = draft ?? groups;
  const act = Math.min(activeGroup, shown.length - 1);
  const shape = (color: string, dim: boolean): L.PathOptions => ({
    color,
    fillColor: color,
    fillOpacity: dim ? 0.06 : 0.12,
    weight: 2,
    dashArray: dim ? '2 8' : '6 6',
  });
  const activePath = shape(cssVar('--pin-region'), false);
  const inactivePath = shape(cssVar('--pin-region-inactive'), true);

  const moved = (gi: number, i: number, e: L.LeafletEvent): Pin[][] => {
    const ll = (e.target as L.Marker).getLatLng();
    return groupsRef.current.map((g, a) =>
      a === gi ? g.map((p, j) => (j === i ? ([ll.lat, ll.lng] as Pin) : p)) : g
    );
  };

  return (
    <>
      {shown.map((grp, gi) => {
        const isActive = gi === act;
        // ctrl/cmd-click anywhere on a group's outline, line or pins makes it the active group
        const activate = (e: L.LeafletMouseEvent) => {
          const oe = e.originalEvent;
          if (!(oe.ctrlKey || oe.metaKey)) return false;
          oe.preventDefault(); // on a Mac, ctrl+click also raises the context menu
          setActiveGroup(gi);
          return true;
        };
        const path = isActive ? activePath : inactivePath;
        return (
          <Fragment key={gi}>
            {grp.length >= 3 && (
              <Polygon positions={grp} pathOptions={path} eventHandlers={{ click: activate, contextmenu: activate }} />
            )}
            {grp.length === 2 && (
              <Polyline positions={grp} pathOptions={path} eventHandlers={{ click: activate, contextmenu: activate }} />
            )}
            {grp.map((p, i) => (
              <Marker
                key={`${gi}-${i}`}
                position={p}
                icon={isActive ? pinIcon : pinIconInactive}
                draggable
                eventHandlers={{
                  click: activate,
                  dragstart: () => {
                    document.documentElement.classList.add(DRAGGING_CLASS);
                    setActiveGroup(gi);
                  },
                  drag: (e) => setDraft(moved(gi, i, e)),
                  dragend: (e) => {
                    document.documentElement.classList.remove(DRAGGING_CLASS);
                    const next = moved(gi, i, e);
                    const k = pinStack.indexOf(groupsRef.current[gi][i]);
                    if (k >= 0) pinStack[k] = next[gi][i]; // keep its place in the undo order after being dragged
                    setGroups(next);
                    setDraft(null);
                  },
                  contextmenu: (e) => {
                    if (activate(e)) return; // ctrl-click on a Mac arrives here
                    const r = dropPin(groupsRef.current, activeRef.current, gi, i);
                    setGroups(r.groups);
                    setActiveGroup(r.active);
                  },
                }}
              />
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
