import { MapBase } from './mapbase';
import { Spilloverlay } from './Spilloverlay';
import { useState } from 'react';
import type { Feature, Geometry } from 'geojson';

export function Spillover() {
  const [selectedSite, setSelectedSite] = useState<Feature<Geometry, any> | null>(null);
  {
    /*1000 is leaflet z I think, so always at least zIndex 1001 for overlay -268*/
  }
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: '0px',
          left: '0px',
          zIndex: '1001',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <Spilloverlay selectedSite={selectedSite} />
      </div>
      <div style={{ width: '100%', height: '100%' }}>
        <MapBase setSelectedSite={setSelectedSite} />
      </div>
    </div>
  );
}
