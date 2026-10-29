import styles from './spillover.module.css';
import type { Feature, Geometry } from 'geojson';
import { useEffect, useState } from 'react';
import { SiteData } from './Polygons';
import { SlidePanel } from './SlidePanel';
interface SiteInfo {
  selectedSite: SiteData | null;
  conLoading: boolean;
}

// Fallback labels for the polygon's NPL_STATUS code, used until/unless the EPA fetch succeeds
const NPL_STATUS_LABELS: Record<string, string> = {
  F: 'Final NPL',
  P: 'Proposed NPL',
  D: 'Deleted from NPL',
  N: 'Not on NPL',
};

const updateMap = (key: string, value: string) => {
  // Spreads existing entries and appends/overwrites the new key-value array entry
  setMyMap(new Map([...myMap, [key, value]]));
};

export function SiteSummary({ selectedSite, conLoading }: SiteInfo) {
  if (!selectedSite) {
  return (
    <SlidePanel side="right" placement={styles.siteSummary}>
      <div className={styles.boxTitle}>&nbsp;</div>
      <div className={styles.boxScroll}>
        <div className={styles.contentbox}>
          <div className={styles.contentboxvalue}>No site content, please select a site</div>
        </div>
      </div>
    </SlidePanel>
  );
}
  const p = selectedSite.siteProperties;
  console.log(p);
  const epaId: string = p.EPA_ID;
  const siteContaminantList = selectedSite.siteContaminantList;

  // fallbacks needed? i doubt there will be new statuses but this is a safe fallback -268
  const status =
    siteContaminantList?.[0]?.npl_status_name ?? NPL_STATUS_LABELS[p.NPL_STATUS] ?? p.NPL_STATUS;
  const siteUrl = p.URL_ALIAS_;
  console.log(siteUrl);
  const area =
    typeof p.GIS_AREA === 'number' ? `${p.GIS_AREA.toFixed(1)} ${p.GIS_AREA_U ?? ''}` : null;

  return (
<SlidePanel side="right" placement={styles.siteSummary}>
      <div className={styles.boxTitle}>
        {p.SITE_NAME}
        <span className={styles.boxSubtitle}>{p.EPA_PROGRA}</span>
      </div>

      <div className={styles.boxScroll}>
        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>Location</div>
          <div className={styles.contentboxvalue}>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>Address</span>
              <span className={styles.contentdata}>{p.STREET_ADD || '—'}</span>
            </div>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>City</span>
              <span className={styles.contentdata}>
                {p.CITY_NAME}, {p.STATE_CODE} {p.ZIP_CODE}
              </span>
            </div>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>County</span>
              <span className={styles.contentdata}>{p.COUNTY}</span>
            </div>
          </div>
        </div>

        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>Site Details</div>
          <div className={styles.contentboxvalue}>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>EPA ID</span>
              <span className={styles.contentdata}>{epaId}</span>
            </div>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>NPL status</span>
              <span className={styles.contentdata}>
                <span className={styles.badge}>{status}</span>
              </span>
            </div>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>Federal facility</span>
              <span className={styles.contentdata}>{p.FEDERAL_FA === 'Y' ? 'Yes' : 'No'}</span>
            </div>
            {area && (
              <div className={styles.contentrow}>
                <span className={styles.contentlabel}>Site area</span>
                <span className={styles.contentdata}>{area}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>Contaminants on Site</div>
          <div className={styles.contentboxvalue}>
            {conLoading && <div className={styles.muted}>Loading EPA details…</div>}
            {/*error && <div className={styles.muted}>{error}</div>*/}
            {siteContaminantList && siteContaminantList.length === 0 && (
              <div className={styles.muted}>No contaminants listed.</div>
            )}
            {siteContaminantList && siteContaminantList.length > 0 && (
              <ul className={styles.contentlist}>
                {selectedSite.getContaminants().map((c) => (
                  <li key={c.name} className={styles.contentlistitem}>
                    <strong>{c.name}</strong>
                    {c.media.length > 0 && ` (${c.media.join(', ')})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {siteUrl && (
          <div className={styles.contentbox}>
            <div className={styles.contentboxvalue}>
              <a href={'https://' + siteUrl} target="_blank" rel="noopener noreferrer">
                View EPA site page →
              </a>
            </div>
          </div>
        )}
      </div>    
</SlidePanel>
  );
}

//<div className={styles.hazardMedia}>Affected Media: {c.media.join(', ')}</div>
