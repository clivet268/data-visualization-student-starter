import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Polygons, SiteData } from './Polygons';
import { useEffect } from 'react';
import L from 'leaflet';
import { PinLayer } from './PinLayer';
import type { Pin } from './geo';
import type { TimeKey } from './filters';
//https://experience.arcgis.com/experience/69b43a291c364115962141077eab1bec#data_s=id%3AdataSource_2-Environmental_NJEMS_8402%3A2000&widget_8=active_datasource_id:dataSource_2,center:-8345301.289019154%2C4939561.8923708815%2C102100,scale:26000.57494296,level:14.560000000015508,rotation:0,viewpoint:%7B%22rotation%22%3A0%2C%22scale%22%3A26000.57494296%2C%22targetGeometry%22%3A%7B%22spatialReference%22%3A%7B%22latestWkid%22%3A3857%2C%22wkid%22%3A102100%7D%2C%22x%22%3A-8345301.289019154%2C%22y%22%3A4939561.8923708815%7D%7D,layer_visibility:%7B%22widget_8-dataSource_2%22%3A%7B%22widget_8-dataSource_2-19f14507863-layer-170%22%3Atrue%2C%22widget_8-dataSource_2-19f14507151-layer-169%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_mon_4364%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_2544%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_mon_gw_1710%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_mon_gw_1710_765%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_mon_gw_3774%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_NJEMS_5793%22%3Atrue%7D%7D&zoom_to_selection=true
// VERY VERY HELPFUL, main source of data, at least for superfunds -268
export interface FocusRequest {
  sites: SiteData[];
  nonce: number;
}
interface MapInteractivity {
  setcurrentSelectedSite: (currentSelectedSite: SiteData) => void;
  setconLoading: (loading: boolean) => void;
  compareMode: boolean;
  selectedSites: Map<string, SiteData>;
  toggleSelectedSite: (site: SiteData) => void;
  currentSelectedSite: SiteData | null;
  focusRequest: FocusRequest | null;
  statusFilter: Set<string>;
  timeFilter: TimeKey;
  pins: Pin[];
  setPins: (pins: Pin[]) => void;
  pinsActive: boolean;
  onPinSelection: (enclosed: SiteData[]) => void;
}

// zooms so the requested sites fill the middle 60% of the screen (20% padding per side)
function MapController({ focusRequest }: { focusRequest: FocusRequest | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focusRequest) return;
    let bounds: L.LatLngBounds | null = null;
    for (const site of focusRequest.sites) {
      const b = L.geoJSON(site.baseGeo as any).getBounds();
      bounds = bounds ? bounds.extend(b) : b;
    }
    if (!bounds || !bounds.isValid()) return;
    const size = map.getSize();
    const allpaddingpercent = 0.3;
    const px = size.x * allpaddingpercent;
    const py = size.y * allpaddingpercent;
    map.fitBounds(bounds, { paddingTopLeft: [px, py], paddingBottomRight: [px, py], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);
  return null;
}

export function MapBase({
  setcurrentSelectedSite, setconLoading, compareMode, selectedSites, toggleSelectedSite, currentSelectedSite,
  focusRequest, statusFilter, timeFilter, pins, setPins, pinsActive, onPinSelection,
}: MapInteractivity) {
  return (
    <MapContainer
      center={[40.141046, -74.568632]}
      zoom={13}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%' }}
      preferCanvas={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
            <Polygons
        setcurrentSelectedSite={setcurrentSelectedSite}
        setconLoading={setconLoading}
        compareMode={compareMode}
        selectedSites={selectedSites}
        toggleSelectedSite={toggleSelectedSite}
        currentSelectedSite={currentSelectedSite}
        focusRequest={focusRequest}
        statusFilter={statusFilter}
        timeFilter={timeFilter}
        pins={pins}
        pinsActive={pinsActive}
        onPinSelection={onPinSelection}
      />
      <PinLayer active={compareMode && pinsActive} pins={pins} setPins={setPins} />
      <MapController focusRequest={focusRequest} />
    </MapContainer>
  );
}
