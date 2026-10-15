import styles from './spillover.module.css';
import type { Feature, Geometry } from 'geojson';
interface SiteInfo {
  selectedSite: Feature<Geometry, any> | null;
}

// BN? -268
const POSSIBLE_HAZARDS = [
  'ARSENIC',
  'BENZENE',
  'BENZO_A_PYRENE',
  'BN',
  'CADMIUM',
  'CARBON_TETRACHLORIDE',
  'CHLOROFORM',
  'CHROMIUM',
  'DIOXANE_1_4',
  'DIOXIN',
  'HISTORIC_FILL',
  'HISTORIC_PESTICIDES',
  'LEAD_PB',
  'MERCURY',
  'METALS',
  'MTBE',
  'NAPHTHALENE',
  'OTHER',
  'PCBS',
  'PCE',
  'PESTICIDES',
  'PFAS',
  'RADIONUCLIDES',
  'TBA',
  'TCE',
  'TICS',
  'VINYL_CHLORIDE',
  'VO',
];

export function SiteSummary({ selectedSite }: SiteInfo) {
  if (!selectedSite) {
    return null;
  }

  console.log(selectedSite);

  //const parsed = JSON.parse(selectedSite.properties);
  //console.log(parsed);

  //const display : SiteDisplayedInfo = selectedSite.properties

  const p = selectedSite.properties || {};
  const foundContaminants: string[] = [];

  POSSIBLE_HAZARDS.forEach((hazard) => {
    const hazval = p[hazard].trim();
    console.log(hazard + ': ' + hazval);
    if (hazval) {
      if (hazval !== 'No') foundContaminants.push(hazard + ': ' + hazval);
    }
  });

  //const hazards = p.ARSENIC;

  return (
    <div className={`${styles.siteSummary} ${styles.spilloverlay}`}>
      <div>
        {p.PI_NAME} in {p.COUNTY} County
      </div>
      <div>
        Program Interest Number: {p.PREF_ID_NUM} Site ID: {p.SITE_ID}
      </div>
      <div>
        Potential Hazards:
        <ul style={{ paddingLeft: '20px' }}>
          {foundContaminants.map((contaminant, index) => (
            <li key={index} style={{ margin: '4px 0', color: 'red', fontWeight: 'bold' }}>
              {contaminant}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
