import { NewsFeed } from './NewsFeed';
import { TitleBar } from './TitleBar';
import { SiteSummary } from './SiteSummary';
import type { Feature, Geometry, FeatureCollection } from 'geojson';
import { SitesStatistics } from './StatisticsInformation';
import type { SiteData } from './Polygons';
import { useState } from 'react';
import styles from './spillover.module.css';
interface SiteInfo {
  selectedSites: Map<string, SiteData>;
  currentSelectedSite: SiteData | null;
  compareMode: boolean;
  setCompareMode: (value: boolean) => void; 
  clearSelection: () => void;
  focusSites: (sites: SiteData[]) => void;
  conLoading: boolean;
}

export function Spilloverlay({ selectedSites, currentSelectedSite, compareMode, setCompareMode, clearSelection, focusSites, conLoading }: SiteInfo) {
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
        uiHidden={uiHidden}
        toggleUiHidden={() => setUiHidden(!uiHidden)}
      />
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