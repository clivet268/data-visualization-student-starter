import { useState, useEffect, useRef, useCallback } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import type { PathOptions } from 'leaflet';
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
}

interface MapInteractivity {
  setcurrentSelectedSite: (site: SiteData) => void;
  setconLoading: (loading: boolean) => void;
  compareMode: boolean;
  selectedSites: Map<string, SiteData>;
  toggleSelectedSite: (site: SiteData) => void;
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

const siteDataCache: Map<string, SiteData> = new Map();

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

  // cache hit: contaminants already loaded
  if (s.siteContaminantList.length !== 0) {
    return s;
  }

  const url =
    `https://data.epa.gov/dmapservice/sems.envirofacts_site/sems.envirofacts_site.epa_id/equals/` +
    `${encodeURIComponent(epaId)}/left/sems.envirofacts_contaminants/site_id/equals/fk_site_id/json`;

  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(`EPA server returned ${res.status}`);

  const jsons: SiteContaminants[] = await res.json();
  if (!jsons || jsons.length === 0) return null;

  s.siteContaminantList = jsons;
  siteDataCache.set(epaId, s);
  return s;
}

export function Polygons({
  setcurrentSelectedSite,
  setconLoading,
  compareMode,
  selectedSites,
  toggleSelectedSite,
}: MapInteractivity) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);

  // onEachFeature only runs once per layer, so the click handler reads compareMode through a ref
  const compareRef = useRef(compareMode);
  compareRef.current = compareMode;

  // new function identity whenever the selection changes, so react-leaflet re-applies styles
  const styleWithSelection = useCallback(
    (feature?: Feature<Geometry, any>): PathOptions => {
      const id = feature?.properties?.EPA_ID;
      return id && selectedSites.has(id) ? SELECTED_STYLE : styleSite(feature);
    },
    [selectedSites],
  );

  useEffect(() => {
    //fetch(`${baseUrl}data/Superfund_National_Priorities_List_(NPL)_Sites_with_Status_Information.geojson`)Groundwater Contamination Areas (CEA).geojson
    //fetch(`${baseUrl}data/Groundwater Contamination Areas (CEA).geojson`)
    fetch(`${baseUrl}data/Superfunds.geojson`)
      .then((res: Response) => res.json())
      .then((geojson) => {
        setGeoData(geojson as FeatureCollection);
      });
  }, []);

  if (geoData === null) {
    return null;
  } else {
  }

  const handleSelectSite = (feature: Feature<Geometry, any>, layer: any) => {
    layer.on({
      click: () => {
        const s: SiteData = new SiteData(feature);
        const epaId: string = s.siteProperties.EPA_ID;

        let st: SiteData | undefined = siteDataCache.get(epaId);
        if (!st) {
          siteDataCache.set(epaId, s);
          st = s;
        }

        if (compareRef.current) toggleSelectedSite(st);
        else setcurrentSelectedSite(st);

        const controller = new AbortController();

        setconLoading(true);
        fetchEpaSummary(epaId, controller.signal)
          .then((contaminants) => {
            if (!contaminants) {
              console.log('No additional EPA records found.');
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setconLoading(false);
          });
      },
    });
  };
  return <GeoJSON data={geoData} onEachFeature={handleSelectSite} style={styleWithSelection} />;
}
