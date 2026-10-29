import { useRef, useState } from 'react';
import { MapBase, type FocusRequest } from './mapbase';
import { Spilloverlay } from './Spilloverlay';
import { SiteData } from './Polygons';
import { ALL_STATUSES, type TimeKey } from './filters';
import type { Pin } from './geo';

export function Spillover() {
  const [selectedSites, setSelectedSites] = useState<Map<string, SiteData>>(new Map());
  const [currentSelectedSite, setcurrentSelectedSite] = useState<SiteData | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [conLoading, setconLoading] = useState<boolean>(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(ALL_STATUSES));
  const [timeFilter, setTimeFilter] = useState<TimeKey>('any');
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinsActive, setPinsActive] = useState(false);

  // ids that the pin area added, so they can be removed again when the area moves off them
  const pinAdded = useRef<Set<string>>(new Set());

  const toggleSelectedSite = (site: SiteData) => {
    const id = site.siteProperties.EPA_ID;
    pinAdded.current.delete(id); // a manual choice sticks
    setSelectedSites((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, site);
      return next;
    });
  };

  const applyPinSelection = (enclosed: SiteData[]) => {
    const next = new Map(selectedSites);
    const enclosedIds = new Set(enclosed.map((s) => s.siteProperties.EPA_ID));
    for (const id of [...pinAdded.current]) {
      if (!enclosedIds.has(id)) { next.delete(id); pinAdded.current.delete(id); }
    }
    for (const s of enclosed) {
      const id = s.siteProperties.EPA_ID;
      if (!next.has(id)) { next.set(id, s); pinAdded.current.add(id); }
    }
    setSelectedSites(next);
  };

  const clearSelection = () => { setSelectedSites(new Map()); pinAdded.current.clear(); };
  // clearing pins keeps whatever they selected, as ordinary selections
  const clearPins = () => { pinAdded.current.clear(); setPins([]); };

  const focusSites = (sites: SiteData[]) => setFocusRequest({ sites, nonce: Date.now() });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute', top: '0px', left: '0px', zIndex: '1001',
          width: '100%', height: '100%', pointerEvents: 'none',
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
          pinsActive={pinsActive}
          setPinsActive={setPinsActive}
          pinCount={pins.length}
          clearPins={clearPins}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
        />
      </div>
      <div style={{ width: '100%', height: '100%' }}>
        <MapBase
          setcurrentSelectedSite={setcurrentSelectedSite}
          setconLoading={setconLoading}
          compareMode={compareMode}
          selectedSites={selectedSites}
          toggleSelectedSite={toggleSelectedSite}
          currentSelectedSite={currentSelectedSite}
          focusRequest={focusRequest}
          statusFilter={statusFilter}
          timeFilter={timeFilter}
          pins={pins}
          setPins={setPins}
          pinsActive={pinsActive}
          onPinSelection={applyPinSelection}
        />
      </div>
    </div>
  );
}