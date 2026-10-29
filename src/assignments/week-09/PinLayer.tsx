import { useRef, useState } from 'react';
import L from 'leaflet';
import { Marker, Polygon, Polyline, useMapEvents } from 'react-leaflet';
import styles from './spillover.module.css';
import type { Pin } from './geo';

const pinIcon = L.divIcon({ className: styles.pin, iconSize: [18, 18], iconAnchor: [9, 9] });
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

interface PinLayerProps {
  active: boolean;
  pins: Pin[];
  setPins: (pins: Pin[]) => void;
}

export function PinLayer({ active, pins, setPins }: PinLayerProps) {
  const [draft, setDraft] = useState<Pin[] | null>(null); // live positions while dragging
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  useMapEvents({
    click: (e) => {
      if (active) setPins([...pinsRef.current, [e.latlng.lat, e.latlng.lng]]);
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
            drag: (e) => setDraft(moved(i, e)),
            dragend: (e) => { setPins(moved(i, e)); setDraft(null); },
            contextmenu: () => setPins(pinsRef.current.filter((_, j) => j !== i)),
          }}
        />
      ))}
    </>
  );
}