import styles from './spillover.module.css';
import type { Feature, Geometry } from 'geojson';
import { useEffect, useState } from 'react';
import { SiteData } from './Polygons';

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
    return <div> SELECTED SITE NOT FOUND!!!! </div>;
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
    <div
      className={`${styles.panel} ${styles.siteSummary} ${styles.spilloverlay} ${styles.nicebox}`}
    >
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
                {siteContaminantList.map((c) => (
                  <li key={c.preferred_contaminant_name} className={styles.contentlistitem}>
                    <strong>{c.preferred_contaminant_name}</strong>
                    {c.media_name && ` (${c.media_name})`}
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
    </div>
  );
}

//<div className={styles.hazardMedia}>Affected Media: {c.media.join(', ')}</div>
