import { useEffect, useState } from 'react';
import { useDimensions } from './useDimensions';
// TODO learn more tailwind
interface SeismicEvent {
  time: string;
  latitude: number;
  longitude: number;
  depth: number;
  mag: number;
  magType: string;
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
  pixelX: number;
  pixelY: number;
}

const baseUrl = import.meta.env.BASE_URL;

function LoadCSV() {
  const [data, setData] = useState<SeismicEvent[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { ref: divRef, dimensions } = useDimensions();
  const [mapShow, setMapShow] = useState(false);
  const [minMag, setMinMag] = useState(6);
  const [maxMag, setMaxMag] = useState(10);
  const widths = [7.5, 6, 6, 2, 2, 2.5, 2, 2, 2, 2, 2, 4, 7.5, 12, 4, 4, 3, 3, 2, 3, 4, 4];
  //TODO sorton needs propper types in input
  const [sorton, setsorton] = useState('');

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setsorton(event.currentTarget.textContent);
  };

  useEffect(() => {
    console.log(baseUrl);
    fetch(`${baseUrl}data/All_Earthquakes_all_month.csv`)
      .then((res) => res.text())
      .then((csvText) => {
        const rows = csvText
          .split('\n')
          .map((row) => row.trim())
          .filter((row) => row.length > 0);

        if (rows.length === 0) return;

        const columnHeaders = rows[0].split(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        const trimmedHeaders: string[] = [];
        for (const orig of columnHeaders) {
          if (orig != ',' && orig != '') {
            console.log(orig);
            trimmedHeaders.push(orig);
          }
        }
        console.log(columnHeaders);
        setHeaders(trimmedHeaders);
        console.log(trimmedHeaders);

        const entries = rows.slice(1).map((row) => {
          const values: string[] = [];
          let currentField = '';
          let inQuotes = false;

          //TODO no other entries should have quotes but could be made more robust?
          for (let i = 0; i < row.length; i++) {
            const char = row[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentField.trim());
              currentField = '';
            } else {
              currentField += char;
            }
          }

          // Push the final field remaining after the loop completes
          values.push(currentField.trim());

          // I DID NOT THINK THIS WOULD BE SO COMPLEX WHEN I STARTED!
          // Map the lat and long onto a square 2D map that is bound by 85/-85 degrees lat.
          //  This requires funky math and wouldnt be good enought for a final product since
          //  some earthquakes occur above/below that 85 degree mark
          //  https://en.wikipedia.org/wiki/Web_Mercator_projection
          //  https://en.wikipedia.org/wiki/Gudermannian_function#History
          //  ^ using Using Cayley's notation
          const xPixel = ((+values[2] + 180) / 360.0) * 800;

          const latRad = (+values[1] * Math.PI) / 180.0;
          // Logarithmic Mercator stretch (the u in phi = gd(u))
          const mercatorY = Math.log(Math.tan(Math.PI / 4.0 + latRad / 2.0));

          // Pre-calculated at 85° N/S for the chosen map
          //  +/-85 degrees = +/-1.4835298642 radians
          //  Math.log(Math.tan((Math.PI / 4.0) + (+/-1.4835298642 / 2.0)) = +/-3.13130133147

          const maxMercatorY = 3.13130133147;
          const minMercatorY = -3.13130133147;

          // Normalize and scale to 800px
          const yPixelscaled = ((mercatorY - minMercatorY) / (maxMercatorY - minMercatorY)) * 800;
          console.log(values[5]);
          const entry: SeismicEvent = {
            time: values[0],
            latitude: +values[1],
            longitude: +values[2],
            depth: +values[3],
            mag: +values[4],
            magType: values[5],
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
            pixelX: xPixel,
            pixelY: yPixelscaled,
          };

          return entry;
        });

        setData(entries);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to parse CSV:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div>
        <div>Loading dataset...</div>
      </div>
    );
  }

  //TODO account for different scales, modify and scale before putting into mem
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
    <div ref={divRef} className="w-full rounded-lg shadow-sm relative overflow-y-hide">
      <div
        style={{
          width: `${dimensions}`,
          height: '4vh',
          border: '1px solid #000268',
          textAlign: 'left',
          paddingTop: '10px',
          paddingLeft: '10px',
          display: 'flex',
          justifyContent: 'left',
          fontSize: '14px',
          backgroundColor: '#FFFD97',
          columnGap: '10px',
        }}
      >
        <div
          style={{
            fontSize: '16px',
          }}
        >
          Earthquake Data Log: August 2026
        </div>
        <form>
          <label>Min Magnitude:</label>
          <input
            type="min"
            min="0"
            value={minMag}
            max={maxMag}
            onChange={(e) => setMinMag(Number(e.target.value))}
            style={{
              backgroundColor: '#000268',
              color: 'white',
              border: 'black',
              borderRadius: '4px',
              width: '30px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            }}
          ></input>
          <label>Max Magnitude:</label>
          <input
            type="max"
            min={minMag}
            value={maxMag}
            max="10"
            onChange={(e) => setMaxMag(Number(e.target.value))}
            style={{
              backgroundColor: '#000268',
              color: 'white',
              border: 'black',
              borderRadius: '4px',
              width: '30px',
              //paddingLeft: '10px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            }}
          ></input>
        </form>
      </div>
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
          color: 'white',
          padding: '0px',
          boxShadow: '4px 0 15px rgba(0,0,0,0.3)',
          transition: 'transform 0.25s ease-in-out',
          transform: mapShow ? 'translateX(-800px)' : 'translateX(100%)',
          zIndex: 10,
        }}
      >
        <img
          src={`${baseUrl}data/Mercator_projection_Square.jpg`}
          alt="800x800 Square Mercator Map"
        />
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
            data
              .filter((row) => row.mag >= minMag && row.mag <= maxMag)
              .map((row, index) => {
                const pixelX = row.pixelX;
                const pixelY = row.pixelY;
                const mag = row.mag;

                // TODO make clicking dot scroll to it in the table or overlay info or both idk

                return (
                  <div
                    key={index}
                    style={{
                      position: 'absolute',
                      left: `${pixelX}px`,
                      bottom: `${pixelY}px`,
                      width: `${mag}px`,
                      height: `${mag}px`,
                      backgroundColor: backgrundColorSeverity(mag) + '90',
                      borderRadius: '50%',
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })
          }
        </div>
      </div>
      <div
        //ref={divRef}
        //className="w-99 rounded-lg shadow-sm relative overflow-y-hide"
        style={{
          height: '96vh',
          width: '100%',
        }}
      >
        <table
          border={1}
          style={{
            width: '100%',
            height: '100%',
            borderTop: '1px',
            textAlign: 'left',
            padding: '0px',
            fontSize: '10px',
            flexShrink: '0',
            tableLayout: 'fixed',
            overflowX: 'hidden',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2', position: 'sticky', top: 0, zIndex: 1 }}>
              {headers.map((header, i) => (
                <th key={i} style={{ padding: '0px', width: `${widths[i]}%` }}>
                  <button onClick={handleClick}>{header}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data
              .filter((row) => row.mag >= minMag && row.mag <= maxMag)
              .sort((a, b) => {
                const valueA = a[sorton as keyof SeismicEvent];
                const valueB = b[sorton as keyof SeismicEvent];
                if (typeof valueA === 'number' && typeof valueB === 'number') {
                  return valueB - valueA;
                }

                if (typeof valueA === 'string' && typeof valueB === 'string') {
                  return valueA.localeCompare(valueB);
                }

                return 0;
              }) //=> a[sorton as keyof SeismicEvent] - b[sorton as keyof SeismicEvent])
              .map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((header, colIndex) => (
                    <td
                      key={colIndex}
                      style={{
                        padding: '1px',
                        borderLeft: '1px solid #262626',
                        borderRight: '1px solid #262626',
                        borderBottom: '1px solid #00026880',
                        backgroundColor: backgrundColorSeverity(row.mag),
                      }}
                    >
                      <div style={{ overflowX: 'hidden' }}>{row[header as keyof SeismicEvent]}</div>
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

export function EnhanceTheDisplay() {
  //TODO too much div
  return (
    <div>
      <LoadCSV />
    </div>
  );
}
