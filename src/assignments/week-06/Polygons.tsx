import { useState, useEffect } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { FeatureCollection, Feature, Geometry } from 'geojson';

interface MapInteractivity {
  setSelectedSite: (siteData: Feature<Geometry, any>) => void;
}

const baseUrl = import.meta.env.BASE_URL;

export function LoadData({ setSelectedSite }: MapInteractivity) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    //fetch(`${baseUrl}data/Superfund_National_Priorities_List_(NPL)_Sites_with_Status_Information.geojson`)Groundwater Contamination Areas (CEA).geojson
    fetch(`${baseUrl}data/Groundwater Contamination Areas (CEA).geojson`)
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
        console.log(feature);
        setSelectedSite(feature);
      },
    });
  };
  return (
    <GeoJSON
      data={geoData}
      onEachFeature={handleSelectSite}
      pathOptions={{ color: 'purple', fillColor: 'blue', fillOpacity: 0.5 }}
    />
  );
}
