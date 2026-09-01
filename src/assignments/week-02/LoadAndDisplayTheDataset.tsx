import { useEffect, useState } from 'react';
import { useDimensions } from './useDimensions';

interface SeismicEvent {
  time: string;
  latitude: number;
  longitude: number;
  depth: number;
  mag: number;       
  magtype: string;
  nst: number;
  gap: string;
  dmin: string;
  rms: number;
  net: string;
  id: string;
  updated: string; 
  place: string;
  type: string;
  horizontalError: number;
  depthError: number;
  magError: number;
  magNst: number; 
  status: string; 
  locationSource: string;
  magSource: string;
}

const baseUrl = import.meta.env.BASE_URL;


//  const moveItMoveIt = loadingColor >> load;
function LoadCSV() {
  const [data, setData] = useState<SeismicEvent[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { ref: divRef, dimensions } = useDimensions();
  const [mapShow, setMapShow] = useState(false);

  useEffect(() => {
    console.log(baseUrl)
    fetch(`${baseUrl}data/All_Earthquakes_all_month.csv`)
      .then(res => res.text())
      .then(csvText => {
        const rows = csvText.split('\n').map(row => row.trim()).filter(row => row.length > 0);
        
        if (rows.length === 0) return;

        const columnHeaders = rows[0].split(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        setHeaders(columnHeaders);
        console.log(columnHeaders);

        const entries = rows.slice(1).map(row => {
          const values: string[] = [];
          let currentField = '';
          let inQuotes = false;

          for (let i = 0; i < row.length; i++) {
            const char = row[i];
          
            if (char === '"') {
              inQuotes = !inQuotes; // Toggle quote state, skip adding the literal quote character
            } else if (char === ',' && !inQuotes) {
              values.push(currentField.trim());
              currentField = ''; // Reset for the next cell
            } else {
              currentField += char;
            }
          }

          // Push the final field remaining after the loop completes
          values.push(currentField.trim());
          const entry: SeismicEvent = {
            time: values[0],
            latitude: +values[1],
            longitude: +values[2],
            depth: +values[3],
            mag: +values[4],
            magtype: values[5],
            nst: +values[6],
            gap: values[7],
            dmin: values[8],
            rms: +values[9],
            net: values[10],
            id: values[11],
            updated: values[12],
            place: values[13],
            type: values[14],
            horizontalError: +values[15],
            depthError: +values[16],
            magError: +values[17],
            magNst: +values[18],
            status: values[19],
            locationSource: values[20],
            magSource: values[21],
          };
          
          return entry;
        });

        setData(entries);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to parse CSV:", err);
        setLoading(false);
      });
  }, []);
  {/* dosent work since its all on same thread when waiting to render
  if (loading) {
    loadingColor += 1;
    console.log(loadingColor)
    return (
      <div>
        <div>
          Loading dataset...
        </div>
        <div
          style={{
            backgroundColor: `#${loadingColor.toString(16).padStart(6, '0')}`,
          }}
          >
          Loading dataset...
        </div>
      </div>
      );
  };
  */}

  if (loading) {
    return (
      <div>
        <div>
          Loading dataset...
        </div>
      </div>
      );
  };

  if (data.length === 0) return <div>No data found.</div>;
  const backgrundColorSeverity = (magValue: string | number): string => {
    const numericMag = Number(magValue);
    
    if (numericMag < 1) {
      return '#26c706';
    } else if (numericMag < 2) {
      return '#69da53';
    } else if (numericMag < 3) {
      return '#cefdc5';
    } else if (numericMag < 4) {
      return '#f0f341';
    } else if (numericMag < 5) {
      return '#ffb222';
    } else if (numericMag < 6) {
      return '#ee7a0d';
    } else if (numericMag < 7) {
      return '#dd470b';
    } else if (numericMag < 8) {
      return '#e93111';
    } else if (numericMag < 9) {
      return '#882215';
    }

    return '#500220';
  };
  return (
    <div>
      
      <button 
        onClick={() => setMapShow(!mapShow)} 
        style={{ 
          position: 'absolute', 
          top: '0px', 
          right: '810px', 
          zIndex: 11,
          padding: '0px 15px', 
          backgroundColor: '#000268', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px', 
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        }}
      >
        {mapShow ? '✕' : '🌏︎'}
      </button>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '100%',
          height: '800px',
          width: '800px',
          backgroundColor: 'transparent',
          color: '#fff',
          padding: '0px',
          boxShadow: '4px 0 15px rgba(0,0,0,0.3)',
          transition: 'transform 0.25s ease-in-out',
          transform: mapShow ? 'translateX(-800px)' : 'translateX(100%)',
          zIndex: 10,
        }}
      >
        <img src={`${baseUrl}data/Mercator_projection_Square.jpg`} alt="800x800 Square Mercator Map" />
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {
            // TODO make this just one map loop with the info applied to thhe other div too so that theres less looping??
            data.map((row, index) => {
            // I DID NOT THINK THIS WOULD BE SO COMPLEX WHEN I STARTED!!!!!
            // TODO redo
            //const xPixel = ((row["longitude"] + 180) / 360.0) * 800;
          
            //const yPixel = ((row["latitude"] + 85) / 170.0) * 800;
          
            // 1. Longitude remains perfectly linear (X-Axis)
            const xPixel = ((row["longitude"] + 180) / 360.0) * 800;

            // 2. Non-linear Web Mercator calculation for Latitude (Y-Axis)
            const latRad = (row["latitude"] * Math.PI) / 180.0;

            // Calculate logarithmic Mercator stretch
            const mercatorY = Math.log(Math.tan(Math.PI / 4.0 + latRad / 2.0));

            // Pre-calculated Mercator bounds for exactly 85° N/S
            const maxMercatorY = 3.131301; 
            const minMercatorY = -3.131301;

            // Normalize from [min, max] to a 0-1 scale, then scale to 800px
            const yPixel = ((mercatorY - minMercatorY) / (maxMercatorY - minMercatorY)) * 800;
            const mag = row.mag;

            // TODO make clicking dot scroll to it in the table or overlay info or both idk
            console.log({
              id: row.id,
              lat: row.latitude,
              lon: row.longitude,
              mag: row.mag,
              xPixel,
              yPixel,
            });

            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: `${xPixel}px`,
                  bottom: `${yPixel}px`,
                  width: `${mag}px`,
                  height: `${mag}px`,
                  backgroundColor: backgrundColorSeverity(mag) + "90",
                  borderRadius: '50%',
                  pointerEvents: 'auto',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}
        </div>
      </div>
      <div ref={divRef} className="w-full rounded-lg shadow-sm relative overflow-y-hide" style={{height: '96vh'}}>
        <table border={1} style={{ width: '100%', height: '100%', borderTop: '1px', textAlign: 'left', padding: '0px', fontSize: '10px'}}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2', position: 'sticky', top: 0, zIndex: 1 }}>
              {headers.map((header, i) => (
                <th key={i} style={{ padding: '0px' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((header, colIndex) => (
                  <td 
                    key={colIndex}
                    style={{ 
                      padding: '0px', 
                      backgroundColor: backgrundColorSeverity(row.mag) 
                    }}
                  >
                    {row[header as keyof SeismicEvent]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LoadAndDisplayTheDataset() {
  return (
    <div>
      <h2 style={{ height: "4vh", padding: "4px"}}>Earthquake Data Log: August 2026</h2>
      <LoadCSV />
    </div>
  );
}
