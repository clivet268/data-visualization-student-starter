import { useState, useEffect, useRef, useCallback } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import type { PathOptions } from 'leaflet';

import type { FocusRequest } from './mapbase';
import { siteMatchesFilters, type TimeKey } from './filters';
import { fullyEnclosed, type Pin } from './geo';
interface SiteProperties {
  FID: number;
  REGION_COD: number;
  EPA_PROGRA: string;
  EPA_ID: string;
  SITE_NAME: string;
  SITE_FEATU: number;
  SITE_FEA_1: string;
  SITE_FEA_2: string;
  SITE_FEA_3: string;
  NPL_STATUS: string;
  FEDERAL_FA: string;
  LAST_CHANG: number;
  ORIGINAL_C: number;
  SITE_FEA_4: string;
  STREET_ADD: string;
  ADDR_COMME: string;
  CITY_NAME: string;
  COUNTY: string;
  STATE_CODE: string;
  ZIP_CODE: string;
  SITE_CONTA: string;
  PRIMARY_TE: string;
  SITE_CON_1: string;
  URL_ALIAS_: string;
  FEATURE_IN: string;
  FEATURE__1: string;
  GIS_AREA: number;
  GIS_AREA_U: string;
  PROJECTION: string;
  SF_GEOSPAT: string;
  Shape_Leng: number;
  Shape_Area: number;
}

interface SiteContaminants {
  archived_date: string | null;
  archived_ind: string;
  city_name: string;
  congressional_district_code: string;
  county_name: string;
  epa_id: string;
  federal_facility_ind: string;
  fips_code: string;
  fk_ref_region_code: string;
  fk_ref_state_code: string;
  name: string;
  non_npl_status_code: string | null;
  non_npl_status_date: string | null;
  non_npl_status_name: string | null;
  npl_status_code: string;
  npl_status_name: string;
  primary_latitude_decimal_val: number;
  primary_longitude_decimal_val: number;
  saa_agreement_site_ind: string;
  site_id: string;
  street_addr_txt: string;
  supplemental_addr_txt: string | null;
  zip_code: string;
  action_name: string;
  fk_site_id: string;
  media_name: string | null;
  operable_unit_num: string;
  preferred_contaminant_name: string | null;
  seq: number;
  type_code: string;
}
export interface Contaminant {
  name: string;
  media: string[];
}

export class SiteData {
  baseGeo: Geometry;
  id: string | number | undefined;
  siteProperties: SiteProperties;
  siteContaminantList?: SiteContaminants[]; // undefined = not loaded yet, [] = loaded but empty

  constructor(init: Feature<Geometry, any>) {
    this.baseGeo = init.geometry;
    this.id = init.id;
    this.siteProperties = init.properties;
  }

  addContaminants(con: SiteContaminants): void {
    (this.siteContaminantList ??= []).push(con);
  }

  addAllContaminants(con: SiteContaminants[]): void {
    this.siteContaminantList = (this.siteContaminantList ?? []).concat(con);
  }

  // one entry per contaminant name, with every medium it appears in
  getContaminants(): Contaminant[] {
    const byName = new Map<string, Set<string>>();
    for (const c of this.siteContaminantList ?? []) {
      const name = c.preferred_contaminant_name;
      if (!name) continue;
      const media = byName.get(name) ?? new Set<string>();
      if (c.media_name) media.add(c.media_name);
      byName.set(name, media);
    }
    return [...byName].map(([name, media]) => ({ name, media: [...media] }));
  }
}

interface MapInteractivity {
  setcurrentSelectedSite: (site: SiteData) => void;
  setconLoading: (loading: boolean) => void;
  compareMode: boolean;
  selectedSites: Map<string, SiteData>;
  toggleSelectedSite: (site: SiteData) => void;
  currentSelectedSite: SiteData | null;
  focusRequest: FocusRequest | null;
  statusFilter: Set<string>;
  timeFilter: TimeKey;
  pins: Pin[];
  pinsActive: boolean;
  onPinSelection: (enclosed: SiteData[]) => void;
}
const baseUrl = import.meta.env.BASE_URL;

const FINAL_NPL_STYLE: PathOptions = { color: '#ff8008', fillColor: '#efa249', fillOpacity: 0.3 };
const PROP_NPL_STYLE: PathOptions = { color: '#af7f78', fillColor: '#efefbf', fillOpacity: 0.2 };
const OTHER_STYLE: PathOptions = { color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 0.2 };
const SELECTED_STYLE: PathOptions = {
  color: '#0057ff',
  fillColor: '#1e90ff',
  fillOpacity: 0.6,
  weight: 3,
};
// Leaflet setStyle merges, so every visible style must put opacity back to 1
const HIDDEN_STYLE: PathOptions = { opacity: 0, fillOpacity: 0 };
const show = (s: PathOptions): PathOptions => ({ ...s, opacity: 1 });
const FLASH_MS = 600;
const FLASH_TOGGLES = 6; // 3 slow flashes
const loading = new Set<string>(); // EPA ids with a request in flight
const siteDataCache: Map<string, SiteData> = new Map();
// number of EPA requests currently in flight; conLoading is true while this is > 0
let inFlight = 0;
// "F" = Final NPL. Everything else (proposed, deleted, not on NPL, missing) is grey.
const styleSite = (feature?: Feature<Geometry, any>): PathOptions => {
  if (feature?.properties?.NPL_STATUS === 'F') {
    return FINAL_NPL_STYLE;
  } else if (feature?.properties?.NPL_STATUS === 'P') {
    return PROP_NPL_STYLE;
  } else {
    return OTHER_STYLE;
  }
};

// TODO: move server-side (CORS / rate limits)
async function fetchEpaSummary(epaId: string, signal: AbortSignal): Promise<SiteData | null> {
  // cache hit lazy caching for now, not too bad as itll update on page refresh anyway -268
  // TODO not happy with flow -268
  const s: SiteData | undefined = siteDataCache.get(epaId);
  if (!s) {
    throw new Error('EPA ID not found in dataset');
  }

  // cache hit: contaminants already loaded (an empty array still counts as loaded)
  if (s.siteContaminantList !== undefined) {
    return s;
  }

  const url =
    `https://data.epa.gov/dmapservice/sems.envirofacts_site/sems.envirofacts_site.epa_id/equals/` +
    `${encodeURIComponent(epaId)}/left/sems.envirofacts_contaminants/site_id/equals/fk_site_id/json`;

  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(`EPA server returned ${res.status}`);

  const jsons: SiteContaminants[] = (await res.json()) ?? [];

  // a loaded-but-empty result is valid; the left join also yields all-null rows, drop those
  s.siteContaminantList = jsons.filter((c) => c.preferred_contaminant_name);
  siteDataCache.set(epaId, s);
  return s.siteContaminantList.length === 0 ? null : s;
}

export function Polygons({
  setcurrentSelectedSite, setconLoading, compareMode, selectedSites, toggleSelectedSite, currentSelectedSite,
  focusRequest, statusFilter, timeFilter, pins, pinsActive, onPinSelection,
}: MapInteractivity) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [flash, setFlash] = useState<{ ids: Set<string>; on: boolean } | null>(null);

  // onEachFeature only runs once per layer, so click handlers read live values through refs
  const compareRef = useRef(compareMode);
  compareRef.current = compareMode;
  const pinModeRef = useRef(pinsActive);
  pinModeRef.current = pinsActive;
  const filtersRef = useRef({ statusFilter, timeFilter });
  filtersRef.current = { statusFilter, timeFilter };

  const currentId = currentSelectedSite?.siteProperties.EPA_ID;

  // new function identity whenever anything visual changes, so react-leaflet re-applies styles
  const styleWithSelection = useCallback(
    (feature?: Feature<Geometry, any>): PathOptions => {
      if (!siteMatchesFilters(feature?.properties, statusFilter, timeFilter)) return HIDDEN_STYLE;
      const id = feature?.properties?.EPA_ID;
      // flashing sites alternate blue / normal, so it shows even if they are already selected
      if (id && flash?.ids.has(id)) return show(flash.on ? SELECTED_STYLE : styleSite(feature));
      const picked = id && (selectedSites.has(id) || (!compareMode && id === currentId));
      return show(picked ? SELECTED_STYLE : styleSite(feature));
    },
    [selectedSites, currentId, compareMode, flash, statusFilter, timeFilter]
  );

  const loadSite = (epaId: string) => {
    if (loading.has(epaId)) return;
    loading.add(epaId);
    inFlight++;
    setconLoading(true);
    fetchEpaSummary(epaId, new AbortController().signal)
      .then((contaminants) => {
        if (!contaminants) console.log('No additional EPA records found.');
      })
      .finally(() => {
        loading.delete(epaId);
        inFlight--;
        setconLoading(inFlight > 0);
      });
  };

  useEffect(() => {
  fetch(`${baseUrl}data/Superfunds.geojson`)
    .then((res: Response) => res.json())
    .then((geojson) => {
      setGeoData(geojson as FeatureCollection);
    });
}, []);

  // slow blue flash on whatever was just focused, in any mode
  useEffect(() => {
    if (!focusRequest) return;
    const ids = new Set(focusRequest.sites.map((s) => s.siteProperties.EPA_ID));
    let ticks = 0;
    setFlash({ ids, on: true });
    const timer = setInterval(() => {
      ticks++;
      if (ticks >= FLASH_TOGGLES) {
        clearInterval(timer);
        setFlash(null);
      } else {
        setFlash({ ids, on: ticks % 2 === 0 });
      }
    }, FLASH_MS);
    return () => clearInterval(timer);
  }, [focusRequest]);

  // select everything fully inside the pin area
  useEffect(() => {
    if (!geoData || !compareMode || !pinsActive) return;
    const enclosed: SiteData[] = [];
    if (pins.length >= 3) {
      for (const f of geoData.features) {
        const epaId = f.properties?.EPA_ID;
        if (!epaId || !f.geometry) continue;
        if (!siteMatchesFilters(f.properties, statusFilter, timeFilter)) continue;
        if (!fullyEnclosed(f.geometry, pins)) continue;
        let s = siteDataCache.get(epaId);
        if (!s) {
          s = new SiteData(f);
          siteDataCache.set(epaId, s);
        }
        enclosed.push(s);
      }
    }
    onPinSelection(enclosed);
    for (const s of enclosed) {
      if (s.siteContaminantList === undefined) loadSite(s.siteProperties.EPA_ID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoData, pins, pinsActive, compareMode, statusFilter, timeFilter]);

  if (geoData === null) {
    return null;
  }

  const handleSelectSite = (feature: Feature<Geometry, any>, layer: any) => {
    layer.on({
      click: () => {
        const { statusFilter: sf, timeFilter: tf } = filtersRef.current;
        if (!siteMatchesFilters(feature.properties, sf, tf)) return; // hidden by a filter
        if (compareRef.current && pinModeRef.current) return; // pin mode: clicks drop pins instead

        const s: SiteData = new SiteData(feature);
        const epaId: string = s.siteProperties.EPA_ID;

        let st: SiteData | undefined = siteDataCache.get(epaId);
        if (!st) {
          siteDataCache.set(epaId, s);
          st = s;
        }

        if (compareRef.current) toggleSelectedSite(st);
        else setcurrentSelectedSite(st);

        loadSite(epaId);
      },
    });
  };

  return (
    <GeoJSON
      data={geoData}
      onEachFeature={handleSelectSite}
      style={styleWithSelection}
    />
  );
}