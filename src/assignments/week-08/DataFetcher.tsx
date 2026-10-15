
//const stringToColor = (str: string): string => `hsl(${str.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0) % 360}, 70%, 50%)`;

// Example usage:
//console.log(stringToColor("TypeScript")); // "hsl(102, 70%, 50%)"
//console.log(stringToColor("John Doe"));   // "hsl(43, 70%, 50%)"


//https://data.epa.gov/dmapservice/sems.envirofacts_site/epa_id/equals/MED980732291/json
//https://semspub.epa.gov/work/01/100036570.pdf
//https:data.epa.gov/dmapservice/sems.envirofacts_site/sems.envirofacts_site.epa_id/equals/MED980732291/left/sems.envirofacts_contaminants/site_id/equals/fk_site_id/csv

// Define the expected structure of the EPA response object
/*
interface EpaSiteData {
  EPA_ID: string;
  SITE_NAME: string;
  STREET_ADDR?: string;
  CITY_NAME?: string;
  STATE_CODE?: string;
  ZIP_CODE?: string;
  REGION?: string;
  [key: string]: any; // Catch-all for remaining dynamic columns
}
  */

interface EpaSiteData
{
  "archived_date": Date,
  "archived_ind": string,
  "city_name": string,
  "congressional_district_code": string,//maybe number
  "county_name": string,
  "epa_id": string,
  "federal_facility_ind": string,
  "fips_code": string, //maybe number
  "fk_ref_region_code": string, //maybe number
  "fk_ref_state_code": string,
  "name": string,
  "non_npl_status_code": string | null,
  "non_npl_status_date": Date | null,
  "non_npl_status_name": string | null,
  "npl_status_code": string,
  "npl_status_name": string,
  "primary_latitude_decimal_val": number,
  "primary_longitude_decimal_val": number,
  "saa_agreement_site_ind": string,
  "site_id": string, //numberlike but with leading 0s
  "street_addr_txt": string,
  "supplemental_addr_txt": string | null,
  "zip_code": string // some may be special or be xxxxx-yyyy so leaving as string for now
}


/**
 * Automatically fetches Superfund site details when an EPA ID link/button is clicked.
 * @param epaId The targeted EPA ID string (e.g., 'MED980732291')
 */

// If ever this project is continued we MUST MUST MUST make this serverside
async function handleEpaIdClick(epaId: string): Promise<void> {
  const targetUrl = `https://data.epa.gov/dmapservice/sems.envirofacts_site/epa_id/equals/{epaid}/json`;

  console.log(`[EPA Fetch] Initiating request for ID: ${epaId}...`);
  // UI logic layer optimization: Enable your UI spinner element here
  
  try {
    // 2. Execute the asynchronous payload request
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`EPA Server returned status code: ${response.status}`);
    }

    // 3. Parse JSON array payload
    const data: EpaSiteData[] = await response.json();

    if (!data || data.length === 0) {
      console.warn(`[EPA Fetch] No records found matching ID: ${epaId}`);
      return;
    }

    // 4. Handle successful structural extraction
    const siteDetails = data[0]; 
    console.log("[EPA Fetch] Success! Site payload retrieved:", siteDetails);
    
    // UI logic layer optimization: Pass 'siteDetails' down to your application layout components here

  } catch (error) {
    console.error(`[EPA Fetch] Automated collection failed for ID ${epaId}:`, error);
    // UI logic layer optimization: Render error message fallback to your user interface
  } finally {
    // UI logic layer optimization: Disable your UI spinner element here
  }
}


/*[
{
  "archived_date": null,
  "archived_ind": "N",
  "city_name": "WASHBURN",
  "congressional_district_code": "02",
  "county_name": "AROOSTOOK",
  "epa_id": "MED980732291",
  "federal_facility_ind": "N",
  "fips_code": "23003",
  "fk_ref_region_code": "01",
  "fk_ref_state_code": "ME",
  "name": "PINETTE'S SALVAGE YARD",
  "non_npl_status_code": null,
  "non_npl_status_date": null,
  "non_npl_status_name": null,
  "npl_status_code": "D",
  "npl_status_name": "Deleted from the Final NPL",
  "primary_latitude_decimal_val": "46.7782",
  "primary_longitude_decimal_val": "-68.1701",
  "saa_agreement_site_ind": "N",
  "site_id": "0101036",
  "street_addr_txt": "GARDNER CREEK RD",
  "supplemental_addr_txt": null,
  "zip_code": "04786",
  "action_name": "ROD Amendment",
  "fk_site_id": "0101036",
  "media_name": "Soil",
  "operable_unit_num": "01",
  "preferred_contaminant_name": "BENZENE",
  "seq": 1,
  "type_code": "JQ"
},
{
  "archived_date": null,
  "archived_ind": "N",
  "city_name": "WASHBURN",
  "congressional_district_code": "02",
  "county_name": "AROOSTOOK",
  "epa_id": "MED980732291",
  "federal_facility_ind": "N",
  "fips_code": "23003",
  "fk_ref_region_code": "01",
  "fk_ref_state_code": "ME",
  "name": "PINETTE'S SALVAGE YARD",
  "non_npl_status_code": null,
  "non_npl_status_date": null,
  "non_npl_status_name": null,
  "npl_status_code": "D",
  "npl_status_name": "Deleted from the Final NPL",
  "primary_latitude_decimal_val": "46.7782",
  "primary_longitude_decimal_val": "-68.1701",
  "saa_agreement_site_ind": "N",
  "site_id": "0101036",
  "street_addr_txt": "GARDNER CREEK RD",
  "supplemental_addr_txt": null,
  "zip_code": "04786",
  "action_name": "Record of Decision",
  "fk_site_id": "0101036",
  "media_name": "Soil",
  "operable_unit_num": "01",
  "preferred_contaminant_name": "POLYCHLORINATED BIPHENYLS (PCBs)",
  "seq": 1,
  "type_code": "RO"
},
{
  "archived_date": null,
  "archived_ind": "N",
  "city_name": "WASHBURN",
  "congressional_district_code": "02",
  "county_name": "AROOSTOOK",
  "epa_id": "MED980732291",
  "federal_facility_ind": "N",
  "fips_code": "23003",
  "fk_ref_region_code": "01",
  "fk_ref_state_code": "ME",
  "name": "PINETTE'S SALVAGE YARD",
  "non_npl_status_code": null,
  "non_npl_status_date": null,
  "non_npl_status_name": null,
  "npl_status_code": "D",
  "npl_status_name": "Deleted from the Final NPL",
  "primary_latitude_decimal_val": "46.7782",
  "primary_longitude_decimal_val": "-68.1701",
  "saa_agreement_site_ind": "N",
  "site_id": "0101036",
  "street_addr_txt": "GARDNER CREEK RD",
  "supplemental_addr_txt": null,
  "zip_code": "04786",
  "action_name": "Record of Decision",
  "fk_site_id": "0101036",
  "media_name": "Groundwater",
  "operable_unit_num": "01",
  "preferred_contaminant_name": "POLYCHLORINATED BIPHENYLS (PCBs)",
  "seq": 1,
  "type_code": "RO"
},
{
  "archived_date": null,
  "archived_ind": "N",
  "city_name": "WASHBURN",
  "congressional_district_code": "02",
  "county_name": "AROOSTOOK",
  "epa_id": "MED980732291",
  "federal_facility_ind": "N",
  "fips_code": "23003",
  "fk_ref_region_code": "01",
  "fk_ref_state_code": "ME",
  "name": "PINETTE'S SALVAGE YARD",
  "non_npl_status_code": null,
  "non_npl_status_date": null,
  "non_npl_status_name": null,
  "npl_status_code": "D",
  "npl_status_name": "Deleted from the Final NPL",
  "primary_latitude_decimal_val": "46.7782",
  "primary_longitude_decimal_val": "-68.1701",
  "saa_agreement_site_ind": "N",
  "site_id": "0101036",
  "street_addr_txt": "GARDNER CREEK RD",
  "supplemental_addr_txt": null,
  "zip_code": "04786",
  "action_name": "ROD Amendment",
  "fk_site_id": "0101036",
  "media_name": "Soil",
  "operable_unit_num": "01",
  "preferred_contaminant_name": "CHLOROBENZENE",
  "seq": 1,
  "type_code": "JQ"
},
{
  "archived_date": null,
  "archived_ind": "N",
  "city_name": "WASHBURN",
  "congressional_district_code": "02",
  "county_name": "AROOSTOOK",
  "epa_id": "MED980732291",
  "federal_facility_ind": "N",
  "fips_code": "23003",
  "fk_ref_region_code": "01",
  "fk_ref_state_code": "ME",
  "name": "PINETTE'S SALVAGE YARD",
  "non_npl_status_code": null,
  "non_npl_status_date": null,
  "non_npl_status_name": null,
  "npl_status_code": "D",
  "npl_status_name": "Deleted from the Final NPL",
  "primary_latitude_decimal_val": "46.7782",
  "primary_longitude_decimal_val": "-68.1701",
  "saa_agreement_site_ind": "N",
  "site_id": "0101036",
  "street_addr_txt": "GARDNER CREEK RD",
  "supplemental_addr_txt": null,
  "zip_code": "04786",
  "action_name": "ROD Amendment",
  "fk_site_id": "0101036",
  "media_name": "Soil",
  "operable_unit_num": "01",
  "preferred_contaminant_name": "CHLOROMETHANE",
  "seq": 1,
  "type_code": "JQ"
},
{
  "archived_date": null,
  "archived_ind": "N",
  "city_name": "WASHBURN",
  "congressional_district_code": "02",
  "county_name": "AROOSTOOK",
  "epa_id": "MED980732291",
  "federal_facility_ind": "N",
  "fips_code": "23003",
  "fk_ref_region_code": "01",
  "fk_ref_state_code": "ME",
  "name": "PINETTE'S SALVAGE YARD",
  "non_npl_status_code": null,
  "non_npl_status_date": null,
  "non_npl_status_name": null,
  "npl_status_code": "D",
  "npl_status_name": "Deleted from the Final NPL",
  "primary_latitude_decimal_val": "46.7782",
  "primary_longitude_decimal_val": "-68.1701",
  "saa_agreement_site_ind": "N",
  "site_id": "0101036",
  "street_addr_txt": "GARDNER CREEK RD",
  "supplemental_addr_txt": null,
  "zip_code": "04786",
  "action_name": "ROD Amendment",
  "fk_site_id": "0101036",
  "media_name": "Soil",
  "operable_unit_num": "01",
  "preferred_contaminant_name": "1,2,4-TRICHLOROBENZENE",
  "seq": 1,
  "type_code": "JQ"
},
{
  "archived_date": null,
  "archived_ind": "N",
  "city_name": "WASHBURN",
  "congressional_district_code": "02",
  "county_name": "AROOSTOOK",
  "epa_id": "MED980732291",
  "federal_facility_ind": "N",
  "fips_code": "23003",
  "fk_ref_region_code": "01",
  "fk_ref_state_code": "ME",
  "name": "PINETTE'S SALVAGE YARD",
  "non_npl_status_code": null,
  "non_npl_status_date": null,
  "non_npl_status_name": null,
  "npl_status_code": "D",
  "npl_status_name": "Deleted from the Final NPL",
  "primary_latitude_decimal_val": "46.7782",
  "primary_longitude_decimal_val": "-68.1701",
  "saa_agreement_site_ind": "N",
  "site_id": "0101036",
  "street_addr_txt": "GARDNER CREEK RD",
  "supplemental_addr_txt": null,
  "zip_code": "04786",
  "action_name": "ROD Amendment",
  "fk_site_id": "0101036",
  "media_name": "Soil",
  "operable_unit_num": "01",
  "preferred_contaminant_name": "1,4-DICHLOROBENZENE",
  "seq": 1,
  "type_code": "JQ"
},
{
  "archived_date": null,
  "archived_ind": "N",
  "city_name": "WASHBURN",
  "congressional_district_code": "02",
  "county_name": "AROOSTOOK",
  "epa_id": "MED980732291",
  "federal_facility_ind": "N",
  "fips_code": "23003",
  "fk_ref_region_code": "01",
  "fk_ref_state_code": "ME",
  "name": "PINETTE'S SALVAGE YARD",
  "non_npl_status_code": null,
  "non_npl_status_date": null,
  "non_npl_status_name": null,
  "npl_status_code": "D",
  "npl_status_name": "Deleted from the Final NPL",
  "primary_latitude_decimal_val": "46.7782",
  "primary_longitude_decimal_val": "-68.1701",
  "saa_agreement_site_ind": "N",
  "site_id": "0101036",
  "street_addr_txt": "GARDNER CREEK RD",
  "supplemental_addr_txt": null,
  "zip_code": "04786",
  "action_name": "ROD Amendment",
  "fk_site_id": "0101036",
  "media_name": "Soil",
  "operable_unit_num": "01",
  "preferred_contaminant_name": "POLYCHLORINATED BIPHENYLS (PCBs)",
  "seq": 1,
  "type_code": "JQ"
}
]
*/