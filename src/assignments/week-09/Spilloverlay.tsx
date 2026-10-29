import { NewsFeed } from './NewsFeed';
import { TitleBar } from './TitleBar';
import { SiteSummary } from './SiteSummary';
import type { Feature, Geometry, FeatureCollection } from 'geojson';
import { SitesStatistics } from './StatisticsInformation';
import type { SiteData } from './Polygons';

interface SiteInfo {
  selectedSites: Map<string, SiteData>;
  currentSelectedSite: SiteData | null;
  compareMode: boolean;
  setCompareMode: (value: boolean) => void;
  clearSelection: () => void;
  conLoading: boolean;
}

export function Spilloverlay({
  selectedSites,
  currentSelectedSite,
  compareMode,
  setCompareMode,
  clearSelection,
  conLoading,
}: SiteInfo) {
  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <NewsFeed />
      <TitleBar
        compareMode={compareMode}
        setCompareMode={setCompareMode}
        selectedCount={selectedSites.size}
        clearSelection={clearSelection}
      />
      <SiteSummary selectedSite={currentSelectedSite} conLoading={conLoading} />
      <SitesStatistics selectedSites={selectedSites} compareMode={compareMode} />
    </div>
  );
}
