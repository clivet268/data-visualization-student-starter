import { useState } from 'react';
import { NewsFeed } from './NewsFeed';
import { TitleBar } from './TitleBar';
import { SiteSummary } from './SiteSummary';
import { SitesStatistics } from './StatisticsInformation';
import type { SiteData } from './Polygons';
import type { TimeKey } from './filters';
import styles from './spillover.module.css';

interface SiteInfo {
  selectedSites: Map<string, SiteData>;
  currentSelectedSite: SiteData | null;
  compareMode: boolean;
  setCompareMode: (value: boolean) => void;
  clearSelection: () => void;
  focusSites: (sites: SiteData[]) => void;
  conLoading: boolean;
  pinsActive: boolean;
  setPinsActive: (value: boolean) => void;
  pinCount: number;
  clearPins: () => void;
  statusFilter: Set<string>;
  setStatusFilter: (s: Set<string>) => void;
  timeFilter: TimeKey;
  setTimeFilter: (t: TimeKey) => void;
}

export function Spilloverlay({
  selectedSites, currentSelectedSite, compareMode, setCompareMode, clearSelection, focusSites, conLoading,
  pinsActive, setPinsActive, pinCount, clearPins, statusFilter, setStatusFilter, timeFilter, setTimeFilter,
}: SiteInfo) {
  const [uiHidden, setUiHidden] = useState(false);

  const canFocus = selectedSites.size > 0 || currentSelectedSite !== null;
  // the multi-selection wins; otherwise focus the site open in the summary
  const focusSelected = () =>
    focusSites(
      selectedSites.size > 0 ? [...selectedSites.values()] : currentSelectedSite ? [currentSelectedSite] : []
    );

  return (
  <div
    className={uiHidden ? styles.uiHidden : undefined}
    style={{ width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}
  >
    <NewsFeed />
    <TitleBar
      compareMode={compareMode}
      setCompareMode={setCompareMode}
      selectedCount={selectedSites.size}
      clearSelection={clearSelection}
      focusSelected={focusSelected}
      canFocus={canFocus}
      pinsActive={pinsActive}
      setPinsActive={setPinsActive}
      pinCount={pinCount}
      clearPins={clearPins}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      timeFilter={timeFilter}
      setTimeFilter={setTimeFilter}
    />
    <button
      type="button"
      className={`${styles.hideTab} ${uiHidden ? styles.hideTabHidden : ''}`}
      onClick={() => setUiHidden(!uiHidden)}
      aria-expanded={!uiHidden}
      aria-label={uiHidden ? 'Show UI' : 'Hide UI'}
    >
      {uiHidden ? '▼' : '▲'}
    </button>
    <SiteSummary selectedSite={currentSelectedSite} conLoading={conLoading}/>
    <SitesStatistics
      selectedSites={selectedSites}
      compareMode={compareMode}
      onSiteClick={(id) => {
        const s = selectedSites.get(id);
        if (s) focusSites([s]);
      }}
    />
  </div>
);
}