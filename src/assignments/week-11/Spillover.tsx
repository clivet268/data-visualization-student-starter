import { useRef, useState } from 'react';
import { MapBase, type FocusRequest } from './mapbase';
import { Spilloverlay } from './Spilloverlay';
import { SiteData } from './Polygons';
import { ALL_STATUSES, type TimeKey } from './filters';
import { pinStack, pinGroupsAcres, dropPin, type Pin } from './geo';


export function Spillover() {
  const [selectedSites, setSelectedSites] = useState<Map<string, SiteData>>(new Map());
  const [currentSelectedSite, setcurrentSelectedSite] = useState<SiteData | null>(null);
  const [hoverSite, setHoverSite] = useState<SiteData | null>(null); // temporary preview while the mouse is over a site
  const [autoSite, setAutoSite] = useState<SiteData | null>(null); // visible site nearest the map centre
  const [compareMode, setCompareMode] = useState(false);
  const [conLoading, setconLoading] = useState<boolean>(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(ALL_STATUSES));
  const [timeFilter, setTimeFilter] = useState<TimeKey>('any');
  const [pinGroups, setPinGroups] = useState<Pin[][]>([]);
  const [activeGroup, setActiveGroup] = useState(0);
  const [pinsActive, setPinsActive] = useState(false);

  // ids that the pin area added, so they can be removed again when the area moves off them
  const pinAdded = useRef<Set<string>>(new Set());

  // what the summary box shows: the hovered site, else the chosen one, else the one nearest the map centre
  const summarySite = hoverSite ?? currentSelectedSite ?? autoSite;
  // leaving a site puts back whatever was showing; if nothing was, the hovered site stays
  const endHover = () => {
    if (hoverSite && !currentSelectedSite && !autoSite) setcurrentSelectedSite(hoverSite);
    setHoverSite(null);
  };

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

  const groupsRef = useRef(pinGroups);
  groupsRef.current = pinGroups;
  const activeRef = useRef(activeGroup);
  activeRef.current = activeGroup;

  // clearing pins keeps whatever they selected, as ordinary selections
  const clearPins = () => { pinAdded.current.clear(); pinStack.length = 0; setPinGroups([]); setActiveGroup(0); };

  // removes the most recently placed pin that still exists (in any group), falling back to the last pin of the last group
  const removeLastPin = () => {
    const gs = groupsRef.current;
    let gi = -1;
    let i = -1;
    while (gi < 0 && pinStack.length) {
      const p = pinStack.pop()!;
      gi = gs.findIndex((g) => g.includes(p));
      if (gi >= 0) i = gs[gi].indexOf(p);
    }
    if (gi < 0) {
      gi = gs.length - 1;
      i = gi >= 0 ? gs[gi].length - 1 : -1;
    }
    if (gi < 0) return;
    const r = dropPin(gs, activeRef.current, gi, i);
    setPinGroups(r.groups);
    setActiveGroup(r.active);
  };

  const pinCount = pinGroups.reduce((n, g) => n + g.length, 0);
  const outlinedAcres = pinGroupsAcres(pinGroups);

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
          summarySite={summarySite}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          clearSelection={clearSelection}
          focusSites={focusSites}
          pinsActive={pinsActive}
          setPinsActive={setPinsActive}
          pinCount={pinCount}
          clearPins={clearPins}
          removeLastPin={removeLastPin}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
          outlinedAcres={outlinedAcres}
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
          pinGroups={pinGroups}
          setPinGroups={setPinGroups}
          activeGroup={activeGroup}
          setActiveGroup={setActiveGroup}
          pinsActive={pinsActive}
          onPinSelection={applyPinSelection}
          onHoverSite={setHoverSite}
          onHoverEnd={endHover}
          setAutoSite={setAutoSite}
        />
      </div>
    </div>
  );
}
