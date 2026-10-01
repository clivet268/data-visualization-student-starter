import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, Geometry } from 'geojson';
import { LoadData } from './Polygons';
//https://experience.arcgis.com/experience/69b43a291c364115962141077eab1bec#data_s=id%3AdataSource_2-Environmental_NJEMS_8402%3A2000&widget_8=active_datasource_id:dataSource_2,center:-8345301.289019154%2C4939561.8923708815%2C102100,scale:26000.57494296,level:14.560000000015508,rotation:0,viewpoint:%7B%22rotation%22%3A0%2C%22scale%22%3A26000.57494296%2C%22targetGeometry%22%3A%7B%22spatialReference%22%3A%7B%22latestWkid%22%3A3857%2C%22wkid%22%3A102100%7D%2C%22x%22%3A-8345301.289019154%2C%22y%22%3A4939561.8923708815%7D%7D,layer_visibility:%7B%22widget_8-dataSource_2%22%3A%7B%22widget_8-dataSource_2-19f14507863-layer-170%22%3Atrue%2C%22widget_8-dataSource_2-19f14507151-layer-169%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_mon_4364%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_2544%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_mon_gw_1710%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_mon_gw_1710_765%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_mon_gw_3774%22%3Atrue%2C%22widget_8-dataSource_2-Environmental_NJEMS_5793%22%3Atrue%7D%7D&zoom_to_selection=true
// VERY VERY HELPFUL, main source of data, at least for superfunds -268

interface MapInteractivity {
  setSelectedSite: (siteData: Feature<Geometry, any>) => void;
}

export function MapBase({ setSelectedSite }: MapInteractivity) {
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
      <LoadData setSelectedSite={setSelectedSite} />
    </MapContainer>
  );
}
