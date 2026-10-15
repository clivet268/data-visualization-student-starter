import { NewsFeed } from './NewsFeed';
import { TitleBar } from './TitleBar';
import { SiteSummary } from './SiteSummary';
import type { Feature, Geometry } from 'geojson';
interface SiteInfo {
  selectedSite: Feature<Geometry, any> | null;
}

export function Spilloverlay({ selectedSite }: SiteInfo) {
  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <NewsFeed />
      <TitleBar />
      <SiteSummary selectedSite={selectedSite} />
    </div>
  );
}
