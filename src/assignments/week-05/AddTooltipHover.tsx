import { useEffect, useState, useRef } from 'react';
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
  const [mapShow, setMapShow] = useState(false);
  const [plotShow, setplotShow] = useState(false);
  const [minMag, setMinMag] = useState(4);
  const [maxMag, setMaxMag] = useState(10);
  const widths = [7.5, 6, 6, 2, 2, 2.5, 2, 2, 2, 2, 2, 4, 7.5, 12, 4, 4, 3, 3, 2, 3, 4, 4];
  //TODO sorton needs propper types in input
  const [sorton, setsorton] = useState('');
  const [sortInverse, setsortInverse] = useState(false);
  const [hoverPos, setHoverPos] = useState<SeismicEvent | null>(null);
  const itemRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const selectedSortOn = event.currentTarget.textContent.replace(/[⇧⇩]/g, '');
    //console.log(selectedSortOn);
    if (sorton === selectedSortOn) {
      setsortInverse(!sortInverse);
    } else {
      setsorton(selectedSortOn);
      setsortInverse(false);
    }
  };

  const handleScrollToElement = (id: string) => {
    const element = itemRefs.current.get(id);
    if (element) {
      // TODO make it like glow or something too
      element.style.scrollMarginTop = '16px';
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      //element.style.borderLeft = '2px solid #000268';
      //element.style.borderBottom = '2px solid #000268';
      //element.style.borderLeft = '1px solid #00026880';
      //element.style.borderBottom = '1px solid #00026880';
    } else {
      console.warn(`Element with ID ${id} not found.`);
    }
  };

  useEffect(() => {
    //console.log(baseUrl);
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
            //console.log(orig);
            trimmedHeaders.push(orig);
          }
        }
        //console.log(columnHeaders);
        setHeaders(trimmedHeaders);
        //console.log(trimmedHeaders);

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
          //console.log(values[5]);
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
    <div className="w-full rounded-lg shadow-sm relative overflow-y-hide mt-[4vh] self-start">
      <div
        style={{
          position: 'fixed',
          width: `100vw`,
          height: '4vh',
          border: '1px solid #000268',
          textAlign: 'left',
          paddingTop: '8px',
          paddingLeft: '10px',
          top: '0px',
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
            fontWeight: 'bold',
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
          position: 'fixed',
          top: '0px',
          right: '810px',
          zIndex: 11,
          padding: '0px 15px',
          marginTop: '8px',
          backgroundColor: '#000268',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          transition: 'transform 0.25s ease-in-out',
          transform: mapShow ? 'translateX(0px)' : 'translateX(100%)',
        }}
      >
        {mapShow ? '✕' : '🌏︎'}
      </button>
      <button
        onClick={() => setplotShow(!plotShow)}
        style={{
          position: 'fixed',
          top: '0px',
          left: '830px',
          zIndex: 11,
          padding: '0px 15px',
          marginTop: '8px',
          backgroundColor: '#000268',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          transition: 'transform 0.25s ease-in-out',
          transform: plotShow ? 'translateX(100%)' : 'translateX(0px)',
        }}
      >
        {plotShow ? '✕' : '📊'}
      </button>
      <div
        style={{
          position: 'fixed',
          top: '0px',
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
        <div
          style={{
            zIndex: 200,
            borderTop: '4px solid #222222',
            borderBottom: '4px solid #666666',
            borderLeft: '4px solid #222222',
            borderRight: '4px solid #666666',
            boxShadow: '0 2px 5px rgba(0,0,0,0.8)',
            position: 'absolute',
            //bottom: `${hoverPos.y}px`,
            //left: `calc(100% - 800px + ${hoverPos.x}px)`,
            //position: 'absolute',
            left: hoverPos == null ? '0px' : `calc(${hoverPos.pixelX}px + 1px)`,
            bottom: hoverPos == null ? '0px' : `calc(${hoverPos.pixelY}px + 5px)`,
            //background: '#faded1',
            //background: '#54aded',
            background: '#368cad',
            width: 'auto',
            height: 'auto',
            fontSize: '14px',
            padding: '4px',
            display: hoverPos == null ? 'none' : 'block',
          }}
          onMouseEnter={() => setHoverPos(hoverPos)}
          onMouseLeave={() => setHoverPos(null)}
        >
          <div
            style={{
              borderBottom: '1px solid black',
              margin: '1px',
            }}
          >
            {hoverPos?.type} : {hoverPos?.id}
          </div>
          <div>
            {hoverPos == null
              ? 'NULL data point'
              : 'Occured on ' +
                new Date(hoverPos.time).toLocaleDateString('en-US', { month: 'short' }) +
                ' ' +
                (new Date(hoverPos.time).getUTCDate() + 1) +
                ', ' +
                new Date(hoverPos.time).getFullYear()}
          </div>
          <div
            style={{
              borderBottom: '1px solid black',
              margin: '1px',
            }}
          >
            {hoverPos == null
              ? 'NULL data point'
              : new Date(hoverPos.time).getHours().toString().padStart(2, '0') +
                ':' +
                new Date(hoverPos.time).getMinutes().toString().padStart(2, '0') +
                ':' +
                new Date(hoverPos.time).getSeconds().toString().padStart(2, '0') +
                ':' +
                new Date(hoverPos.time).getMilliseconds().toString().padStart(4, '0') +
                ' UTC'}
          </div>
          <div
            //TODO just realized i use +/- for lat long but the graph has degree NS EW notation >:(
            style={{
              borderBottom: '1px solid black',
              margin: '1px',
            }}
          >
            {hoverPos?.latitude}/{hoverPos?.longitude}
          </div>

          {/* shhhh later
          <div
            style={{
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'conic-gradient(#3498db 0deg 60deg, #ecf0f1 60deg 360deg)',
            }}
          >
            f
          </div>*/}
          <div
            style={{
              fontSize: '10px',
            }}
          >
            Mag (circle): radius 0-9<br></br>
            Depth (white): 0-667km<br></br>
            Horizontal error (reduces): +/-56km
          </div>
          <div
            style={{
              width: '100%',
              height: '100%',
              minWidth: '120px',
              minHeight: '120px',
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              fontSize: '10px',
            }}
          >
            <div
              style={{
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  height: '100px',
                  width: '100px',
                  borderRadius: '50%',
                  background:
                    'repeating-radial-gradient(circle, #00000090 0px, #00000090 2px, transparent 2px, transparent 24px, #00000090 25px, #00000090 27px, transparent 2px, transparent 48px)',

                  //boxShadow: `
                  //0 0 0 2px #000000,  /* 2px thin ring */
                  //0 0 0 20px #368cad,
                  //0 0 0 22px #000000, /* 2px thin ring */
                  //0 0 0 40px #368cad,
                  //0 0 0 42px #000000  /* 2px thin ring */
                  //`
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    width: '100px',
                    height: '2px',
                    marginTop: '-1px' /* Pulls it up exactly 1px to split the center line */,
                    backgroundColor: 'black' /* Change color as needed */,
                    pointerEvents: 'none' /* Prevents it from blocking mouse hovers */,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    bottom: 0,
                    left: '50%',
                    width: '2px',
                    marginLeft: '-1px',
                    backgroundColor: 'black',
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    bottom: 0,
                    left: '50%',
                    width: '2px',
                    marginLeft: '-1px',
                    backgroundColor: '#fff',
                    zIndex: '100',
                    height: hoverPos == null ? '0px' : `${(hoverPos.depth / 667) * 50}px`,
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    left:
                      hoverPos == null ? '0px' : `${50 - (hoverPos.horizontalError / 56) * 50}px`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '2px',
                    height: '10px',
                    backgroundColor: '#ff0000',
                    zIndex: 10,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right:
                      hoverPos == null ? '0px' : `${50 - (hoverPos.horizontalError / 56) * 50}px`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '2px',
                    height: '10px',
                    backgroundColor: '#ff0000',
                    zIndex: 10,
                  }}
                />
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  //height: hoverPos == null ? '0px' : `${(hoverPos.magError / 0.35) * 100}px`,
                  //width: hoverPos == null ? '0px' : `${(hoverPos.magError / 0.35) * 100}px`,
                  height: hoverPos == null ? '0px' : `${(hoverPos.mag / 9) * 100}px`,
                  width: hoverPos == null ? '0px' : `${(hoverPos.mag / 9) * 100}px`,
                  borderRadius: '50%',
                  background:
                    hoverPos == null ? '#000 ' : backgrundColorSeverity(hoverPos.mag) + '90',
                }}
              />
            </div>
          </div>
        </div>
        <img
          src={`${baseUrl}data/Mercator_projection_Square_axislabled.png`}
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
            // TODO heres an idea, make it so that the dots get rendered into the map, then as you mouse over butons near the cursor get added?
            //  reduces the 10000+ button elements but does need to be done well
            // TODO make this just one map loop with the info applied to thhe other div too so that theres less looping??
            data
              .filter((row) => row.mag >= minMag && row.mag <= maxMag)
              .map((row, index) => {
                const pixelX = row.pixelX;
                const pixelY = row.pixelY;
                const mag = row.mag;

                // TODO make clicking dot scroll to it in the table or overlay info or both idk

                return (
                  <button
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
                    //needs to persist on click
                    /*title={
                      'Mag: ' +
                      row.mag +
                      ' Lat/Long: ' +
                      row.latitude +
                      ',' +
                      row.longitude +
                      ' ID: ' +
                      row.id
                    } */ //ID is unique enough to be a key I believe
                    onClick={() => handleScrollToElement(row.id)}
                    onMouseEnter={() => setHoverPos(row)}
                    onMouseLeave={() => setHoverPos(null)}
                  ></button>
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
          overflowY: 'auto',
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
                <th
                  key={i}
                  style={{
                    padding: '0px',
                    width: `${widths[i]}%`,
                    backgroundColor: `${header === sorton ? '#fff011' : '#f2f2f2'}`,
                  }}
                >
                  <button onClick={handleClick}>
                    {
                      // set the header to the header unless we're sorting on it, then show sorting direction too
                      header + (header === sorton ? (sortInverse ? '⇧' : '⇩') : '')
                      //ternary operator + ternary operator = holy readability
                    }
                  </button>
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
                //console.log(sortInverse);
                // sortInverse just inverts sort order and these two ifs account for diff types
                //  will add more to account for time and any other special cases
                if (typeof valueA === 'number' && typeof valueB === 'number') {
                  return sortInverse ? valueA - valueB : valueB - valueA;
                }

                if (typeof valueA === 'string' && typeof valueB === 'string') {
                  return sortInverse ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
                }

                return 0;
              })
              .map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  ref={(el) => {
                    // Deletion not strictly needed here but it handles a case,
                    //  will never normally be executed and may be useful in the future
                    //  so is here for my reference
                    if (el) {
                      // Add ti map
                      itemRefs.current.set(row.id, el);
                    } else {
                      // Dosent exist remove from map
                      itemRefs.current.delete(row.id);
                    }
                  }}
                >
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

export function AddTooltipHover() {
  //TODO too much div
  return (
    <div>
      <LoadCSV />
    </div>
  );
}
