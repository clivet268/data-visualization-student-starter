import { MapBase } from './mapbase';
import { Spilloverlay } from './Spilloverlay';
import { useState } from 'react';
import type { Feature, Geometry, FeatureCollection } from 'geojson';
import { SiteData } from './Polygons';
import type { FocusRequest } from './mapbase';

export function Spillover() {
  const [selectedSites, setSelectedSites] = useState<Map<string, SiteData>>(new Map());
  const [currentSelectedSite, setcurrentSelectedSite] = useState<SiteData | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [conLoading, setconLoading] = useState<boolean>(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
// nonce makes repeat requests for the same sites still fire
const focusSites = (sites: SiteData[]) => setFocusRequest({ sites, nonce: Date.now() });

  // click a polygon in compare mode: add it, or remove it if already selected
  const toggleSelectedSite = (site: SiteData) => {
    setSelectedSites((prev) => {
      const next = new Map(prev);
      const id = site.siteProperties.EPA_ID;
      if (next.has(id)) next.delete(id);
      else next.set(id, site);
      return next;
    });
  };

  // leaving compare mode clears the selection (and so the blue fills)
  const handleSetCompareMode = (value: boolean) => {
    setCompareMode(value);
  };

  // selection now survives leaving compare mode; only this clears it
  const clearSelection = () => setSelectedSites(new Map());
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
        <Spilloverlay
          conLoading={conLoading}
          selectedSites={selectedSites}
          currentSelectedSite={currentSelectedSite}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          clearSelection={clearSelection}
          focusSites={focusSites}
        />
      </div>
      <div style={{ width: '100%', height: '100%' }}>
        <MapBase
          setcurrentSelectedSite={setcurrentSelectedSite}
          setconLoading={setconLoading}
          compareMode={compareMode}
          selectedSites={selectedSites}
          toggleSelectedSite={toggleSelectedSite}
          focusRequest={focusRequest}
        />
      </div>
    </div>
  );
}
