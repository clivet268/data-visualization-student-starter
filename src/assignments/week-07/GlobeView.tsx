// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';
import ThreeGlobe from 'three-globe';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Natural Earth 1:110m country polygons (ships with the three-globe package).
const COUNTRIES_URL =
  'https://cdn.jsdelivr.net/npm/three-globe/example/country-polygons/ne_110m_admin_0_countries.geojson';

const POLY_ALT = 0.006;          // polygon height above surface (fraction of globe radius)
const SELECTED_ALT = 0.03;       // raised height for the clicked country
const GLOBE_RADIUS = 100;        // three-globe default radius
const GLOBE_COLOR = '#dddddd';
const PAGE_BG = '#f1f1f1';
const DOT_ALT = 1.07;        // dot height above the surface (multiple of the globe radius)
const DOT_SIZE = 4.5;        // dot sprite size in world units
const OUTLINE_COLOR = 'rgba(60, 60, 60, 0.85)';

// ---------------------------------------------------------------------------
// Per-country data
// ---------------------------------------------------------------------------

// Keys: indexa_warming ... indexg_warming
const INDEX_KEYS = 'ABCDEFG'.split('').map((l) => `Market Index ${l}`);

// Each index holds a set of 50 random values. Each set gets a "center" drawn from
// a double bell curve (one bell around 2, one around 8); the 50 values then
// scatter around that center. So the averages cluster around 2 and 8.
const VALUES_PER_INDEX = 50;
const CENTER_LOW = 2;
const CENTER_HIGH = 8;
const HIGH_TO_LOW_RATIO = 0.3;                           // weight of the 8 bell relative to the 2 bell
const P_HIGH = HIGH_TO_LOW_RATIO / (1 + HIGH_TO_LOW_RATIO); // ~23% of sets are centered near 8
const CENTER_SD = 1;   // spread of the centers around each bell
const VALUE_SD = 1;    // spread of the 50 values around their center

const randn = () => {
  // standard normal (Box-Muller)
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const randomSet = (n = VALUES_PER_INDEX) => {
  const center = (Math.random() < P_HIGH ? CENTER_HIGH : CENTER_LOW) + randn() * CENTER_SD;
  return Array.from({ length: n }, () =>
    Math.min(10, Math.max(0, Math.round((center + randn() * VALUE_SD) * 100) / 100))
  );
};

// Stable id for a country feature (ADM0_A3 is populated even where ISO_A3 is -99)
const countryId = (feature) => feature.properties.ADM0_A3 || feature.properties.ADMIN;

const NAME_A = ['Destructive', 'Constructive', 'Steely', 'Revolutionary', 'Zeolite', 'Catalyst', 'Elastomer', 'Surfactant', 'Reagent', 'Polypeptide', 'Substrate', 'Enzyme', 'Polymer', 'Electrolyte', 'Isomerize', 'Polymerize', 'Ozonize', 'Decant', 'Saponify', 'Electrolyze', 'Magnetize', 'Alloy', 'Precipitate', 'Fluoresce', 'Enzymatize', 'Volatilize', 'Scintillate', 'Transesterify', 'Devitrify', 'Centrifuge', 'Agglomerate', 'Titrate', 'Lyophilize', 'Calcine', 'Apex', 'Nova', 'Terra', 'Helix', 'Orion', 'Vertex', 'Solstice', 'Atlas', 'Zenith', 'Cobalt', 'Meridian', 'Aurora', 'Summit', 'Borealis', 'Quantum', 'Ember', 'Tidal', 'Granite', 'Lumen', 'Pioneer', 'Energy', 'Sector', 'Industry', 'Leader', 'Logistics', 'Network', 'Power', 'Grid', 'Steel', 'Mill', 'Motor', 'Vehicle', 'Chemical', 'Reaction', 'Mining', 'Operation', 'Utility', 'Company', 'Freight', 'Train', 'Resource', 'Management', 'Cement', 'Mixer', 'Petroleum', 'Refinery', 'Airway', 'Route', 'Fuel', 'Source', 'Material', 'Science', 'Sprint', 'Jump', 'Accelerate', 'Catapult', 'Galvanize', 'Liquefy', 'Extrapolate', 'Synthesize', 'Coagulate', 'Automate', 'Sublime', 'Calibrate', 'Fracture'];
const NAME_B = ['Construction', 'Commodities', 'Superalloy', 'Nanocomposite', 'Biopolymer', 'Photovoltaic', 'Superconductor', 'Cryogenics', 'Microfluidics', 'Piezoelectric', 'Aerogel', 'Metamaterial','Energy', 'Industries', 'Logistics', 'Power', 'Steel', 'Motors', 'Chemicals', 'Mining', 'Utilities', 'Freight', 'Resources', 'Cement', 'Petroleum', 'Airways', 'Fuels', 'Materials', 'Bioreactor', 'Semiconductor', 'Infrastructure', 'Automated', 'Metallurgy', 'Petrochemical', 'Logistics', 'Geothermal', 'Hydrocarbon', 'Aerospace'];
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const companyName = () => `${pickOf(NAME_A)} ${pickOf(NAME_B)}`;

// The 4 metrics every company has (shown as colored circles on the left of the screen)
const METRICS = [
  { key: 'metric_a', name: 'Metric A', color: '#ff1f1f' }, // red
  { key: 'metric_b', name: 'Metric B', color: '#14c93c' }, // green
  { key: 'metric_c', name: 'Metric C', color: '#9b30ff' }, // purple
  { key: 'metric_d', name: 'Metric D', color: '#1e6bff' }, // blue
];

// ----- Metric data shapes (per country, per index) -----
//   A: one value per company (50)           -> rec.companies[i].a
//   B: 7 values (3 economy, 3 environment, 1 third group), 0-10   -> rec.b
//   C: one value per company (50)           -> rec.companies[i].c
//   D: 60 smooth-ish points Jan 1 - Oct 31, 0.1-10.1 plus noise   -> rec.d
const B_ITEMS = ['GDP growth', 'Employment', 'Trade', 'Emissions', 'Biodiversity', 'Water', 'Wellbeing'];
// angle (degrees clockwise from the top) of each B value:
// top third = economy, bottom-left = environment, bottom-right = the single-value third
const B_ANGLES = [320, 0, 40, 200, 240, 280, 120];
const B_SECTORS = [
  { label: 'Economy', ang: 0 },
  { label: 'Environment', ang: 240 },
  { label: 'Society', ang: 120 },
];

const SERIES_POINTS = 60;
const SERIES_NOISE = 0.35; // sd of the random offset applied to every point
const randomSeries = () => {
  const nTerms = 1 + Math.floor(Math.random() * 5); // 1 to 5 terms
  const terms = Array.from({ length: nTerms }, () => ({
    amp: 0.4 + Math.random() * 1.2,
    freq: 0.5 + Math.random() * 3.5,
    phase: Math.random() * 2 * Math.PI,
  }));
  const raw = Array.from({ length: SERIES_POINTS }, (_, i) => {
    const t = i / (SERIES_POINTS - 1);
    return terms.reduce((sum, { amp, freq, phase }) => sum + amp * Math.sin(2 * Math.PI * freq * t + phase), 0);
  });
  const [lo, hi] = d3.extent(raw);
  const span = hi - lo || 1;
  return raw.map((r) => {
    const v = 0.1 + ((r - lo) / span) * 10 + randn() * SERIES_NOISE; // smooth 0.1 .. 10.1, then offset
    return Math.min(10.1, Math.max(0, Math.round(v * 100) / 100));
  });
};

// date label of series point i (points are spread from Jan 1 to Oct 31)
const seriesLabel = (i) =>
  new Date(2026, 0, 1 + Math.round((i / (SERIES_POINTS - 1)) * 303)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const recOf = (entry, key) => entry.data.find(([k]) => k === key)[1];
// the list of numbers behind a metric (what gets averaged for color / ranking)
const valuesOf = (rec, metric) =>
  metric === 0
    ? rec.companies.map((c) => c.a)
    : metric === 1
    ? rec.b
    : metric === 2
    ? rec.companies.map((c) => c.c)
    : rec.d;

// Metric B shape in the same unit square the country shapes use: a rounded closed spline
// whose distance from the center is the value (10 = touches the edge of the square)
function radialPath(entry, key) {
  const rec = recOf(entry, key);
  const pts = rec.b
    .map((v, i) => ({ ang: B_ANGLES[i], r: (v / 10) * 0.5 }))
    .sort((p, q) => p.ang - q.ang)
    .map(({ ang, r }) => [
      0.5 + r * Math.sin((ang * Math.PI) / 180),
      0.5 - r * Math.cos((ang * Math.PI) / 180),
    ]);
  return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(pts);
}

// Builds: { [countryId]: { name, data: [[indexKey, rec]], means: { [indexKey]: number[4] } } }
function buildCountryData(features) {
  const out = {};
  features.forEach((f) => {
    const data = INDEX_KEYS.map((key) => {
      const a = randomSet();
      const c = randomSet();
      const companies = Array.from({ length: VALUES_PER_INDEX }, (_, i) => ({
        name: companyName(),
        a: a[i],
        c: c[i],
      }));
      return [key, { companies, b: randomSet(7), d: randomSeries() }];
    });
    out[countryId(f)] = {
      name: f.properties.ADMIN || f.properties.NAME,
      data,
      means: Object.fromEntries(
        data.map(([key, rec]) => [key, METRICS.map((_, m) => d3.mean(valuesOf(rec, m)))])
      ),
    };
  });
  return out;
}

// The value used for color, ranking and chart placement: the average, over the 50
// companies, of the currently selected metric
const getValue = (entry, key, metric) => entry?.means?.[key]?.[metric];

// ---------------------------------------------------------------------------
// Fixed-color scale. Each range fades from "color + white" at the bottom to
// the solid color at the top. The first (baby blue) range is the exception: solid
// at the bottom, lighter at the top.
// ---------------------------------------------------------------------------
const WHITE = new THREE.Color('#ffffff');
const MAX_WHITE = 0.12; // how much white is mixed in at the lightest end
const RANGES = [
  { lo: 0, hi: 2, color: new THREE.Color('#1ec0ff'), solidAtBottom: true }, // baby blue
  { lo: 2, hi: 4, color: new THREE.Color('#ff8a1a') },                      // creamsicle orange
  { lo: 4, hi: 5, color: new THREE.Color('#ff6a00') },                      // orange
  { lo: 5, hi: 7, color: new THREE.Color('#ff2200') },                      // red-orange
  { lo: 7, hi: 10, color: new THREE.Color('#c4000e') },                     // dark red
];

// Color for a value (0-10) under the given metric (index into METRICS):
//   0 red    -> the temperature ranges above
//   1 green  -> very light green (0) to full green (10)
//   2 purple -> light purple (0) to full purple (10)
//   3 blue   -> red (0) to light red (5), then light blue (5) to full blue (10)
const tint = (hex, whiteMix) => new THREE.Color(hex).lerp(WHITE, whiteMix);
const VERY_LIGHT = 0.85; // white mixed in at the light end of the green / purple scales
const LIGHT = 0.6;       // white mixed in for "light red" / "light blue"

function valueToColor(v, metric = 0) {
  if (v == null || Number.isNaN(v)) return '#cccccc';
  const x = Math.min(10, Math.max(0, v));
  if (metric === 1 || metric === 2) {
    return `#${tint(METRICS[metric].color, (1 - x / 10) * VERY_LIGHT).getHexString()}`;
  }
  if (metric === 3) {
    const c =
      x <= 5
        ? tint(METRICS[0].color, (x / 5) * LIGHT)              // red -> light red
        : tint(METRICS[3].color, (1 - (x - 5) / 5) * LIGHT);   // light blue -> blue
    return `#${c.getHexString()}`;
  }
  const r = RANGES.find((rg) => x <= rg.hi) ?? RANGES[RANGES.length - 1];
  const t = (x - r.lo) / (r.hi - r.lo);
  const white = (r.solidAtBottom ? t : 1 - t) * MAX_WHITE;
  return `#${r.color.clone().lerp(WHITE, white).getHexString()}`;
}

// ---------------------------------------------------------------------------
// Country shapes -> unit-square SVG paths
//
// Each country is flattened (lng/lat -> planar x/y, with a cos(latitude)
// correction), then scaled uniformly so its longer side spans exactly 0..1 and
// the shorter side is centered inside the 1:1 box. Paths are stored in that
// unit space and scaled to pixels at draw time.
// ---------------------------------------------------------------------------

// Remote parts (Alaska for the USA, French Guiana for France, ...) would shrink
// the main shape. Keep only polygons whose center is within this many "main
// landmass diagonals" of the largest polygon. Raise it to include more islands.
const MAINLAND_RADIUS = 0.75;

const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const cosLat = (lat) => Math.max(0.05, Math.cos((lat * Math.PI) / 180));

function polygonsOf(feature) {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

function polygonInfo(poly) {
  const outer = poly[0];
  const lng0 = outer[0][0];
  const pts = outer.map(([lng, lat]) => [lng0 + wrap(lng - lng0), lat]); // unwrapped
  const clng = d3.mean(pts, (p) => p[0]);
  const clat = d3.mean(pts, (p) => p[1]);
  const k = cosLat(clat);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * k * y2 - x2 * k * y1;
  }
  const [minx, maxx] = d3.extent(pts, (p) => p[0]);
  const [miny, maxy] = d3.extent(pts, (p) => p[1]);
  return {
    poly,
    clng: wrap(clng),
    clat,
    area: Math.abs(a) / 2,
    extent: Math.hypot((maxx - minx) * k, maxy - miny),
    bcLng: wrap((minx + maxx) / 2), // center of the bounding box
    bcLat: (miny + maxy) / 2,
  };
}

function buildShape(feature) {
  const infos = polygonsOf(feature).map(polygonInfo);
  if (!infos.length) return { path: '', center: null, extent: 0 };
  const big = infos.reduce((m, i) => (i.area > m.area ? i : m));
  const kBig = cosLat(big.clat);
  const kept = infos.filter(
    (i) =>
      i === big ||
      Math.hypot(wrap(i.clng - big.clng) * kBig, i.clat - big.clat) <=
        MAINLAND_RADIUS * big.extent
  );

  // Project every ring around the main landmass's center
  const rings = [];
  kept.forEach(({ poly }) =>
    poly.forEach((ring) =>
      rings.push(ring.map(([lng, lat]) => [wrap(lng - big.clng) * kBig, -lat]))
    )
  );

  const all = rings.flat();
  const [minx, maxx] = d3.extent(all, (p) => p[0]);
  const [miny, maxy] = d3.extent(all, (p) => p[1]);
  const w = maxx - minx;
  const h = maxy - miny;
  const s = Math.max(w, h) || 1;
  const offX = (1 - w / s) / 2;
  const offY = (1 - h / s) / 2;
  const r4 = (n) => Math.round(n * 1e4) / 1e4;

  const line = d3.line();
  const path = rings
    .map((ring) => line(ring.map(([x, y]) => [r4((x - minx) / s + offX), r4((y - miny) / s + offY)])) + 'Z')
    .join('');
  return { path, center: { lat: big.bcLat, lng: big.bcLng }, extent: big.extent };
}

// ---------------------------------------------------------------------------
// Picking helpers: sphere point <-> lat/lng, and which country contains a point
// (same axes convention three-globe uses)
// ---------------------------------------------------------------------------

function latLngToVec(lat, lng, r) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function vecToLatLng(v) {
  const r = v.length();
  return {
    lat: (Math.asin(v.y / r) * 180) / Math.PI,
    lng: wrap(90 - (Math.atan2(v.z, v.x) * 180) / Math.PI),
  };
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function featureAt(features, lng, lat) {
  const pt = [lng, lat];
  for (const f of features) {
    for (const poly of polygonsOf(f)) {
      if (!pointInRing(pt, poly[0])) continue;
      if (poly.slice(1).some((hole) => pointInRing(pt, hole))) continue; // in a hole
      return f;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Comparison chart (d3): every country's flattened shape, centered on the
// average of the current index along a 10 -> 0 degC axis. Shapes are
// translucent; the selected country is opaque and has a tooltip lined up
// above it; hovering another country brightens it.
// ---------------------------------------------------------------------------

const TOOLTIP_W = 210;
const ROW_Y0 = 46;
const ROW_STEP = 17;
const TOOLTIP_H = ROW_Y0 + (INDEX_KEYS.length - 1) * ROW_STEP + 12;
const CONNECTOR_H = 26;
const AXIS_H = 38;
const AXIS_LEFT = 10;  // degrees C at the left end
const AXIS_RIGHT = 0;  // degrees C at the right end
const OPACITY_BASE = 0.28;
const OPACITY_HOVER = 0.8;
const OPACITY_SELECTED = 1;
const HOVER_SCALE = 1.6; // how much a hovered shape grows

function ComparisonChart({ world, activeKey, metric, selectedId, size, onSelect }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [width, setWidth] = useState(1000);

  // Fill the width of the element (no scrolling)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth || 1000);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = useMemo(
    () =>
      Object.entries(world.data)
        .map(([id, entry]) => ({ id, entry, name: entry.name, value: getValue(entry, activeKey, metric) }))
        .filter((d) => d.value != null)
        .sort((a, b) => a.value - b.value),
    [world, activeKey, metric]
  );

  const margin = size * 0.8 + 10; // room so shapes at 0 and 10 (and hover growth) aren't clipped
  const x = useMemo(
    () => d3.scaleLinear().domain([AXIS_LEFT, AXIS_RIGHT]).range([margin, width - margin]),
    [width, margin]
  );
  const shapesY = TOOLTIP_H + CONNECTOR_H;
  const height = shapesY + size + AXIS_H;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);
    const line = d3.line();
    const midY = shapesY + size / 2;

    // guide line through the shape centers
    svg
      .append('path')
      .attr('d', line([[margin, midY], [width - margin, midY]]))
      .attr('stroke', '#d5dae3')
      .attr('stroke-dasharray', '3 4')
      .attr('fill', 'none');

    // x axis: 10 degC on the left down to 0 on the right
    const axis = svg
      .append('g')
      .attr('transform', `translate(0,${shapesY + size + 8})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}\u00b0C`));
    axis.selectAll('.domain, line').attr('stroke', '#9aa3b2');
    axis.selectAll('text').attr('fill', '#6b7280').attr('font-size', 10);

    // country shapes, centered on their average (selected one drawn last = on top)
    const baseOpacity = (d) => (d.id === selectedId ? OPACITY_SELECTED : OPACITY_BASE);
    const strokeOf = (d) => (d.id === selectedId ? '#111' : 'rgba(40,40,40,0.8)');
    const widthOf = (d) => (d.id === selectedId ? 1.6 : 0.75);
    const half = size / 2;
    const restTransform = `scale(${size})`;
    const grownTransform = `translate(${half},${half}) scale(${HOVER_SCALE}) translate(${-half},${-half}) scale(${size})`;
    const ordered = [...items].sort((a, b) => (a.id === selectedId) - (b.id === selectedId));
    const shapesG = svg.append('g');

    const cell = shapesG
      .selectAll('g.cell')
      .data(ordered, (d) => d.id)
      .join('g')
      .attr('class', 'cell')
      .attr('transform', (d) => `translate(${x(d.value) - size / 2},${shapesY})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => onSelect(d.id))
      .on('mouseenter', function (event, d) {
        const p = d3.select(this).raise().select('path');
        p.interrupt()
          .attr('opacity', Math.max(OPACITY_HOVER, baseOpacity(d)))
          .attr('stroke', '#fff')
          .attr('stroke-width', 2.5)
          .style('filter', 'drop-shadow(0 0 1.5px rgba(0,0,0,0.6))') // halo so white shows on white
          .transition()
          .duration(120)
          .attr('transform', grownTransform);
      })
      .on('mouseleave', function (event, d) {
        d3.select(this)
          .select('path')
          .interrupt()
          .attr('opacity', baseOpacity(d))
          .attr('stroke', strokeOf(d))
          .attr('stroke-width', widthOf(d))
          .style('filter', null)
          .transition()
          .duration(120)
          .attr('transform', restTransform);
      });

    cell.append('title').text((d) => `${d.name}: ${d.value.toFixed(2)}\u00b0C`);

    cell
      .append('path')
      .attr('d', (d) => (metric === 1 ? radialPath(d.entry, activeKey) : world.shapes[d.id] || ''))
      .attr('transform', restTransform)
      .attr('fill', (d) => valueToColor(d.value, metric))
      .attr('fill-rule', 'evenodd')
      .attr('stroke', strokeOf)
      .attr('stroke-width', widthOf)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('opacity', baseOpacity);

    // selected country: connector line + tooltip with every index average, high -> low
    const sel = items.find((d) => d.id === selectedId);
    if (sel) {
      const cx = x(sel.value);
      const bx = Math.max(4, Math.min(cx - TOOLTIP_W / 2, width - TOOLTIP_W - 4));
      const g = svg.append('g');

      g.append('path')
        .attr('d', line([[cx, TOOLTIP_H], [cx, shapesY]]))
        .attr('stroke', '#111')
        .attr('stroke-width', 1.5);

      g.append('rect')
        .attr('x', bx)
        .attr('y', 1)
        .attr('width', TOOLTIP_W)
        .attr('height', TOOLTIP_H - 1)
        .attr('rx', 10)
        .attr('fill', '#fff')
        .attr('stroke', '#111')
        .attr('stroke-width', 1.25);

      g.append('text')
        .attr('x', bx + 12)
        .attr('y', 22)
        .attr('font-size', 12)
        .attr('font-family', 'system-ui, sans-serif')
        .attr('fill', '#111')
        .text(sel.name);

      g.append('path')
        .attr('d', line([[bx + 10, 31], [bx + TOOLTIP_W - 10, 31]]))
        .attr('stroke', '#e3e6ec');

      const rows = INDEX_KEYS.map((k) => [k, sel.entry.means[k][metric]]).sort((a, b) => b[1] - a[1]);

      g.selectAll('rect.cur')
        .data(rows.map((r, i) => ({ r, i })).filter(({ r }) => r[0] === activeKey))
        .join('rect')
        .attr('class', 'cur')
        .attr('x', bx + 6)
        .attr('y', ({ i }) => ROW_Y0 + i * ROW_STEP - 12)
        .attr('width', TOOLTIP_W - 12)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', '#eef2ff');

      const row = g
        .selectAll('g.row')
        .data(rows)
        .join('g')
        .attr('class', 'row')
        .attr('font-family', 'monospace')
        .attr('font-size', 11)
        .attr('fill', '#111')
        .attr('font-weight', (r) => (r[0] === activeKey ? 800 : 400));

      row
        .append('text')
        .attr('x', bx + 12)
        .attr('y', (r, i) => ROW_Y0 + i * ROW_STEP)
        .text((r) => r[0]);

      row
        .append('text')
        .attr('x', bx + TOOLTIP_W - 12)
        .attr('y', (r, i) => ROW_Y0 + i * ROW_STEP)
        .attr('text-anchor', 'end')
        .text((r) => r[1].toFixed(2));
    }
  }, [items, x, width, height, shapesY, margin, size, selectedId, activeKey, metric, world, onSelect]);

  return (
    <div
      ref={wrapRef}
      style={{
        overflow: 'hidden',
        background: '#fff',
        border: '1px solid #e3e6ec',
        borderRadius: 12,
      }}
    >
      <svg ref={svgRef} style={{ display: 'block' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// UI bits
// ---------------------------------------------------------------------------

const FILLER_ABOVE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Below, every country is flattened onto a square and placed on a temperature axis at the average of the current index.';

const FILLER_BELOW = [
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.',
  'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Phasellus ultrices nulla quis nibh. Quisque a lectus. Donec consectetuer ligula vulputate sem tristique cursus. Nam nulla quam, gravida non, commodo a, sodales sit amet, nisl.',
  'Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim.',
  'Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatis vitae, justo. Nullam dictum felis eu pede mollis pretium. Integer tincidunt. Cras dapibus.',
  'Vivamus elementum semper nisi. Aenean vulputate eleifend tellus. Aenean leo ligula, porttitor eu, consequat vitae, eleifend ac, enim. Aliquam lorem ante, dapibus in, viverra quis, feugiat a, tellus. Phasellus viverra nulla ut metus varius laoreet.',
  'Quisque rutrum. Aenean imperdiet. Etiam ultricies nisi vel augue. Curabitur ullamcorper ultricies nisi. Nam eget dui. Etiam rhoncus. Maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero, sit amet adipiscing sem neque sed ipsum.',
  'Nam quam nunc, blandit vel, luctus pulvinar, hendrerit id, lorem. Maecenas nec odio et ante tincidunt tempus. Donec vitae sapien ut libero venenatis faucibus. Nullam quis ante. Etiam sit amet orci eget eros faucibus tincidunt.',
  'Duis leo. Sed fringilla mauris sit amet nibh. Donec sodales sagittis magna. Sed consequat, leo eget bibendum sodales, augue velit cursus nunc, quis gravida magna mi a libero. Fusce vulputate eleifend sapien. Vestibulum purus quam, scelerisque ut.',
];

const BINS = [
  { label: '4\u201310\u00b0C', test: (v) => v >= 4, color: '#ff0a0a' },            // red
  { label: '2\u20134\u00b0C', test: (v) => v >= 2 && v < 4, color: '#ff6a00' },    // orange
  { label: '0\u20132\u00b0C', test: (v) => v < 2, color: '#1ec0ff' },              // baby blue
];

// "Portfolio list": every value of the current index from every country, pooled.
// Shows its average (colored by the map's color scale) and the share in each range.
// Widths of the four elements are 5 : 8 : 8 : 8.
function PortfolioStats({ world, activeKey, metric }) {
  const stats = useMemo(() => {
    const all = Object.values(world.data).flatMap(
      (e) => valuesOf(recOf(e, activeKey), metric)
    );
    const n = all.length;
    return {
      n,
      mean: d3.mean(all) ?? 0,
      pct: BINS.map((b) => (n ? (100 * all.filter(b.test).length) / n : 0)),
    };
  }, [world, activeKey, metric]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '5fr 8fr 8fr 8fr',
        gap: 16,
        alignItems: 'center',
        margin: '0 0 18px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 46,
            fontWeight: 800,
            lineHeight: 1,
            color: valueToColor(stats.mean, metric),
            textShadow: '0 0 1px rgba(0,0,0,0.3)',
          }}
        >
          {stats.mean.toFixed(2)}
          <span style={{ fontSize: 18, fontWeight: 600 }}>{'\u00b0C'}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
          average of all {stats.n.toLocaleString()} values &middot; {activeKey} &middot; {METRICS[metric].name}
        </div>
      </div>

      {BINS.map((b, i) => (
        <div key={b.label}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {stats.pct[i].toFixed(1)}%
          </div>
          <div style={{ height: 22, borderRadius: 11, background: '#d9dce2', overflow: 'hidden' }}>
            <div style={{ width: `${stats.pct[i]}%`, height: '100%', background: b.color }} />
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
            {b.label}
          </div>
        </div>
      ))}
    </div>
  );
}

const HEADER_H = 56;

// Circle fill: a gradient that is just barely lighter at the top than at the bottom
const lighten = (hex, amt) => `#${new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), amt).getHexString()}`;
const circleGradient = (hex) => `linear-gradient(to bottom, ${lighten(hex, 0.16)}, ${hex})`;

const roundBtn = {
  width: 30,
  height: 30,
  borderRadius: 999,
  border: 'none',
  background: 'rgba(255,255,255,0.16)',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
  lineHeight: '30px',
  padding: 0,
};

const paraStyle = { margin: '0 0 14px', color: '#4b5563', fontSize: 14, lineHeight: 1.6 };

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Metric sections shown in the pop-up (above the last three paragraphs)
// ---------------------------------------------------------------------------

const cardStyle = {
  background: '#fff',
  border: '1px solid #e3e6ec',
  borderRadius: 12,
  padding: '14px 16px',
  margin: '0 0 18px',
};
const cardTitle = { margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#111827' };
const SERIES_RED = '#ff1f1f';
const SERIES_BLUE = '#1e6bff';
const SERIES_GRAY = '#9aa0aa';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function useWidth(ref, initial = 800) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setW(el.clientWidth || initial);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, initial]);
  return w;
}

// Metric A: two prediction ranges that start from the data
function PredictionChart({ values }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const H = 260;
  const m = { l: 36, r: 16, t: 12, b: 30 };
  const x = d3.scaleLinear().domain([0, 50]).range([m.l, width - m.r]);
  const y = d3.scaleLinear().domain([0, 10.1]).range([H - m.b, m.t]);
  const cl = (v) => Math.min(10.1, Math.max(0, v));

  const sorted = [...values].sort(d3.ascending);
  const hi0 = [d3.quantile(sorted, 0.75), sorted[sorted.length - 1]]; // [bottom, top] of the high range
  const lo0 = [sorted[0], d3.quantile(sorted, 0.25)];                 // [bottom, top] of the low range
  const band = ([bot0, top0], drop, spread) =>
    d3.range(0, 51).map((yr) => {
      const t = yr / 50;
      const d = drop * t * t; // curves down
      return { yr, top: cl(top0 - d + spread * t), bot: cl(bot0 - d - spread * t) };
    });
  const hi = band(hi0, 0.9, 0.4); // mostly flat, curving down slightly
  const lo = band(lo0, 1.4, 0.3); // curving down a bit more
  const area = d3.area().x((d) => x(d.yr)).y0((d) => y(d.bot)).y1((d) => y(d.top));
  const mid = d3.line().x((d) => x(d.yr)).y((d) => y((d.top + d.bot) / 2));
  const HI = '#ff4500';
  const LO = '#1ec0ff';

  return (
    <div ref={ref}>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#4b5563', marginBottom: 6 }}>
        <span><span style={{ color: HI }}>&#9632;</span> High range</span>
        <span><span style={{ color: LO }}>&#9632;</span> Low range</span>
      </div>
      <svg width={width} height={H} style={{ display: 'block' }}>
        {[0, 2, 4, 6, 8, 10].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="#e8ebf1" />
            <text x={m.l - 6} y={y(t) + 3} fontSize={10} fill="#6b7280" textAnchor="end">{t}</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40, 50].map((t) => (
          <text key={t} x={x(t)} y={H - 10} fontSize={10} fill="#6b7280" textAnchor="middle">{2026 + t}</text>
        ))}
        <path d={area(hi)} fill={HI} fillOpacity={0.28} />
        <path d={area(lo)} fill={LO} fillOpacity={0.32} />
        <path d={mid(hi)} stroke={HI} strokeWidth={2} fill="none" />
        <path d={mid(lo)} stroke={LO} strokeWidth={2} fill="none" />
        {[[hi0[1], HI], [hi0[0], HI], [lo0[1], LO], [lo0[0], LO]].map(([v, c], i) => (
          <circle key={i} cx={x(0)} cy={y(v)} r={4} fill={c} stroke="#fff" strokeWidth={1.5} />
        ))}
      </svg>
    </div>
  );
}

// Metric B: big radial spline of the 7 values with the three sector labels
function RadialChart({ values, color }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const H = 340;
  const cx = width / 2;
  const cy = 172;
  const R = 118;
  const pt = (ang, r) => [cx + r * Math.sin((ang * Math.PI) / 180), cy - r * Math.cos((ang * Math.PI) / 180)];
  const pts = values
    .map((v, i) => ({ ang: B_ANGLES[i], v, name: B_ITEMS[i] }))
    .sort((a, b) => a.ang - b.ang);
  const path = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(pts.map((p) => pt(p.ang, (p.v / 10) * R)));
  const anchor = (ang) => {
    const sn = Math.sin((ang * Math.PI) / 180);
    return Math.abs(sn) < 0.3 ? 'middle' : sn > 0 ? 'start' : 'end';
  };

  return (
    <div ref={ref}>
      <svg width={width} height={H} style={{ display: 'block' }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e3e6ec" />
        <circle cx={cx} cy={cy} r={R / 2} fill="none" stroke="#eef0f4" />
        {[60, 180, 300].map((a) => {
          const [px, py] = pt(a, R);
          return <line key={a} x1={cx} y1={cy} x2={px} y2={py} stroke="#e3e6ec" strokeDasharray="3 4" />;
        })}
        <path d={path} fill={color} fillOpacity={0.45} stroke={color} strokeWidth={2} />
        {pts.map((p) => {
          const [px, py] = pt(p.ang, (p.v / 10) * R);
          const [lx, ly] = pt(p.ang, R + 14);
          return (
            <g key={p.name}>
              <circle cx={px} cy={py} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
              <text x={lx} y={ly + 3} fontSize={10} fill="#4b5563" textAnchor={anchor(p.ang)}>
                {p.name} {p.v.toFixed(1)}
              </text>
            </g>
          );
        })}
        {B_SECTORS.map((sc) => {
          const [lx, ly] = pt(sc.ang, R + 38);
          return (
            <text key={sc.label} x={lx} y={ly + 4} fontSize={13} fontWeight={700} fill="#111827" textAnchor={anchor(sc.ang)}>
              {sc.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// Metric C: every company with a grey bar filled purple on a 0-10 scale, then its value
function CompanyBars({ companies }) {
  const rows = [...companies].sort((a, b) => b.c - a.c);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((c, i) => (
        <div
          key={i}
          style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.2fr) 3fr 40px', gap: 12, alignItems: 'center', fontSize: 12 }}
        >
          <span style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          <div style={{ height: 12, borderRadius: 6, background: '#d9dce2', overflow: 'hidden' }}>
            <div style={{ width: `${(c.c / 10) * 100}%`, height: '100%', background: METRICS[2].color }} />
          </div>
          <span style={{ fontFamily: 'monospace', color: '#4b5563', textAlign: 'right' }}>{c.c.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

// Metric D: line chart Jan-Dec (data stops at the end of October) + a short +/- bar chart
function SeriesChart({ values }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const m = { l: 34, r: 12, t: 10 };
  const lineH = 200;
  const barTop = m.t + lineH + 28;
  const barH = 54;
  const H = barTop + barH + 8;
  const N = values.length;
  const x = d3.scaleLinear().domain([0, 12]).range([m.l, width - m.r]);
  const px = (i) => x((i / (N - 1)) * 10); // 10 months of data
  const y = d3.scaleLinear().domain([0, 10.1]).range([m.t + lineH, m.t]);
  const yb = d3.scaleLinear().domain([-5, 5.1]).range([barTop + barH, barTop]);
  const cls = (v) => (Math.abs(v - 5) <= 1 ? SERIES_GRAY : v < 5 ? SERIES_RED : SERIES_BLUE);
  const bw = Math.max(1, (px(1) - px(0)) * 0.7);

  return (
    <div ref={ref}>
      <svg width={width} height={H} style={{ display: 'block' }}>
        <rect x={m.l} y={y(6)} width={width - m.l - m.r} height={y(4) - y(6)} fill={SERIES_GRAY} fillOpacity={0.12} />
        {[0, 2, 4, 6, 8, 10].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="#eef0f4" />
            <text x={m.l - 6} y={y(t) + 3} fontSize={10} fill="#6b7280" textAnchor="end">{t}</text>
          </g>
        ))}
        <line x1={m.l} x2={width - m.r} y1={y(5)} y2={y(5)} stroke="#9aa3b2" strokeDasharray="4 4" />
        {MONTHS.map((mo, i) => (
          <g key={mo}>
            <line x1={x(i)} x2={x(i)} y1={m.t} y2={m.t + lineH} stroke="#f1f3f7" />
            <text x={x(i + 0.5)} y={m.t + lineH + 16} fontSize={10} fill="#6b7280" textAnchor="middle">{mo}</text>
          </g>
        ))}
        {values.slice(0, -1).map((v, i) => (
          <line
            key={i}
            x1={px(i)}
            y1={y(v)}
            x2={px(i + 1)}
            y2={y(values[i + 1])}
            stroke={cls((v + values[i + 1]) / 2)}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}
        {values.map((v, i) => (
          <circle key={i} cx={px(i)} cy={y(v)} r={2.2} fill={cls(v)} />
        ))}

        <line x1={m.l} x2={width - m.r} y1={yb(0)} y2={yb(0)} stroke="#9aa3b2" />
        <text x={m.l - 6} y={barTop + 8} fontSize={10} fill="#6b7280" textAnchor="end">+</text>
        <text x={m.l - 6} y={barTop + barH} fontSize={10} fill="#6b7280" textAnchor="end">&#8722;</text>
        {values.map((v, i) => (
          <rect
            key={i}
            x={px(i) - bw / 2}
            y={Math.min(yb(0), yb(v - 5))}
            width={bw}
            height={Math.abs(yb(v - 5) - yb(0))}
            fill={cls(v)}
          />
        ))}
      </svg>
    </div>
  );
}

function MetricSection({ entry, activeKey, metric }) {
  const rec = recOf(entry, activeKey);
  const titles = [
    `Prediction \u00b7 ${entry.name}`,
    `Profile \u00b7 ${entry.name}`,
    `All companies \u00b7 ${entry.name}`,
    `Jan\u2013Oct series \u00b7 ${entry.name}`,
  ];
  return (
    <div style={cardStyle}>
      <h4 style={cardTitle}>
        {METRICS[metric].name} &middot; {titles[metric]}
      </h4>
      {metric === 0 && <PredictionChart values={valuesOf(rec, 0)} />}
      {metric === 1 && <RadialChart values={rec.b} color={METRICS[1].color} />}
      {metric === 2 && <CompanyBars companies={rec.companies} />}
      {metric === 3 && <SeriesChart values={rec.d} />}
    </div>
  );
}

// Bottom of the pop-up: the selected metric's average for every index
function IndexComparison({ world, selectedId, activeKey, metric }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const entry = world.data[selectedId];
  const H = 250;
  const m = { l: 36, r: 16, t: 16, b: 30 };
  const x = d3.scaleBand().domain(INDEX_KEYS).range([m.l, width - m.r]).padding(0.3);
  const y = d3.scaleLinear().domain([0, 10]).range([H - m.b, m.t]);
  const bars = INDEX_KEYS.map((k) => ({
    k,
    v: entry.means[k][metric],
    avg: d3.mean(Object.values(world.data), (e) => e.means[k][metric]),
  }));

  return (
    <div style={cardStyle}>
      <h4 style={cardTitle}>
        Average {METRICS[metric].name} by index &middot; {entry.name}
      </h4>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
        Bars: {entry.name} &middot; dark ticks: average of all countries
      </div>
      <div ref={ref}>
        <svg width={width} height={H} style={{ display: 'block' }}>
          {[0, 2, 4, 6, 8, 10].map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="#e8ebf1" />
              <text x={m.l - 6} y={y(t) + 3} fontSize={10} fill="#6b7280" textAnchor="end">{t}</text>
            </g>
          ))}
          {bars.map((b) => (
            <g key={b.k}>
              <rect
                x={x(b.k)}
                y={y(b.v)}
                width={x.bandwidth()}
                height={y(0) - y(b.v)}
                rx={3}
                fill={valueToColor(b.v, metric)}
                stroke={b.k === activeKey ? '#111' : 'none'}
                strokeWidth={1.5}
              />
              <text x={x(b.k) + x.bandwidth() / 2} y={y(b.v) - 5} fontSize={10} fill="#111827" textAnchor="middle" fontFamily="monospace">
                {b.v.toFixed(2)}
              </text>
              <line x1={x(b.k) - 3} x2={x(b.k) + x.bandwidth() + 3} y1={y(b.avg)} y2={y(b.avg)} stroke="#111" strokeWidth={2} />
              <text
                x={x(b.k) + x.bandwidth() / 2}
                y={H - 10}
                fontSize={10}
                fill="#6b7280"
                textAnchor="middle"
                fontWeight={b.k === activeKey ? 700 : 400}
              >
                {b.k.replace('_warming', '')}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function GlobeView() {
  const containerRef = useRef(null);
  const sceneApiRef = useRef(null);
  const worldRef = useRef({ data: {}, shapes: {}, centers: {}, features: [] }); // read by the globe's color accessors
  const activeKeyRef = useRef(INDEX_KEYS[0]);
  const metricRef = useRef(0);
  const selectedIdRef = useRef(null);

  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const panelHRef = useRef(null);      // null = default height
  const panelOpenRef = useRef(true);

  const [world, setWorld] = useState(null); // { data, shapes } once loaded
  const [keyIdx, setKeyIdx] = useState(0);
  const [metric, setMetric] = useState(0); // index into METRICS
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelH, setPanelH] = useState(null);
  const [shapeSize, setShapeSize] = useState(48); // px, 20-100
  const [hover, setHover] = useState(null); // { id, x, y } of the country under the pointer

  const activeKey = INDEX_KEYS[keyIdx];
  const stepKey = (d) => setKeyIdx((i) => (i + d + INDEX_KEYS.length) % INDEX_KEYS.length);

  // Header info for the selected country
  const selectedEntry = world && selectedId ? world.data[selectedId] : null;
  const selectedValue = getValue(selectedEntry, activeKey, metric);
  const rank = useMemo(() => {
    if (!world || selectedValue == null) return null;
    const vals = Object.values(world.data).map((e) => getValue(e, activeKey, metric));
    return { n: vals.length, pos: vals.filter((v) => v > selectedValue).length + 1 };
  }, [world, activeKey, metric, selectedValue]);

  // Tooltip content: the 4 highest values of the current index for the hovered country
  const hoverId = hover?.id;
  const tip = useMemo(() => {
    if (!world || !hoverId) return null;
    const e = world.data[hoverId];
    if (!e) return null;
    const rec = recOf(e, activeKey);
    const items =
      metric === 0
        ? rec.companies.map((c) => ({ name: c.name, v: c.a }))
        : metric === 2
        ? rec.companies.map((c) => ({ name: c.name, v: c.c }))
        : metric === 1
        ? rec.b.map((v, i) => ({ name: B_ITEMS[i], v }))
        : rec.d.map((v, i) => ({ name: seriesLabel(i), v }));
    const top = items.sort((a, b) => b.v - a.v).slice(0, 4);
    return { name: e.name, top };
  }, [world, hoverId, activeKey, metric]);

  // Make the page itself light grey
  useEffect(() => {
    const prev = document.body.style.cssText;
    document.body.style.margin = '0';
    document.body.style.background = PAGE_BG;
    return () => {
      document.body.style.cssText = prev;
    };
  }, []);

  // ---- Three.js scene (created once) ----
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    let cancelled = false;

    const Globe = new ThreeGlobe().polygonsTransitionDuration(0);

    // --- Floating dots above each country's center ---
    const dots = new Map();
    const dotSprites = [];
    const drawDot = (d, color) => {
      const ctx = d.canvas.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(32, 32, 21, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      d.tex.needsUpdate = true;
    };
    const updateDots = () => {
      dots.forEach((d, id) => {
        const v = getValue(worldRef.current.data[id], activeKeyRef.current, metricRef.current);
        drawDot(d, valueToColor(v, metricRef.current));
        const k = id === selectedIdRef.current ? 1.5 : 1;
        d.sprite.scale.set(DOT_SIZE * k, DOT_SIZE * k, 1);
      });
    };
    const buildDots = () => {
      const { centers } = worldRef.current;
      Object.keys(centers).forEach((id) => {
        const c = centers[id];
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const tex = new THREE.CanvasTexture(canvas);
        if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        sprite.position.copy(latLngToVec(c.lat, c.lng, GLOBE_RADIUS * DOT_ALT));
        sprite.userData.id = id;
        Globe.add(sprite);
        dots.set(id, { sprite, canvas, tex });
        dotSprites.push(sprite);
      });
      updateDots();
    };

    // (Re)apply accessors so fills / highlight reflect the current index + selection
    const refresh = () => {
      const colorOf = (f) =>
        valueToColor(
          getValue(worldRef.current.data[countryId(f)], activeKeyRef.current, metricRef.current),
          metricRef.current
        );
      const isSel = (f) => countryId(f) === selectedIdRef.current;
      Globe.polygonCapColor((f) => colorOf(f))
        .polygonSideColor((f) => colorOf(f))
        .polygonAltitude((f) => (isSel(f) ? SELECTED_ALT : POLY_ALT))
        .polygonStrokeColor((f) => (isSel(f) ? '#000000' : OUTLINE_COLOR));
      updateDots();
    };
    refresh();
    sceneApiRef.current = { refresh };

    const globeMat = Globe.globeMaterial();
    globeMat.color.set(GLOBE_COLOR);
    globeMat.shininess = 0;
    globeMat.specular.set(0x000000);

    // Fetch countries, build data + shapes, then draw
    fetch(COUNTRIES_URL)
      .then((res) => res.json())
      .then((geo) => {
        if (cancelled) return;
        const data = buildCountryData(geo.features);
        const shapes = {};
        const centers = {};
        geo.features.forEach((f) => {
          const { path, center, extent } = buildShape(f);
          shapes[countryId(f)] = path;
          if (center) centers[countryId(f)] = { ...center, extent };
        });
        worldRef.current = { data, shapes, centers, features: geo.features };
        console.log('countryData', data);
        setWorld({ data, shapes });
        buildDots();
        Globe.polygonsData(geo.features);
      })
      .catch((err) => console.error('Failed to load country polygons:', err));

    // --- Scene / renderer / camera ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(PAGE_BG);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(Globe);
    const ambientIntensity = parseInt(THREE.REVISION, 10) >= 155 ? Math.PI : 1;
    scene.add(new THREE.AmbientLight(0xffffff, ambientIntensity));

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(-150, 120, 230);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 60;
    controls.maxDistance = 230;

    // --- Picking: ray -> invisible sphere -> lat/lng -> country polygon ---
    const pickSphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 48, 48),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    Globe.add(pickSphere); // child of Globe so it follows the spin

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const el = renderer.domElement;
    let downPos = null;
    let pointerIsDown = false; // true while the mouse is held down (dragging)
    let tween = null;          // camera fly-to animation

    // Which country is under the pointer: a dot first, otherwise the polygon on the sphere
    const pick = (e) => {
      const rect = el.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const sphereHit = raycaster.intersectObject(pickSphere, false)[0];
      const dotHit = raycaster.intersectObjects(dotSprites, false)[0];
      if (dotHit && (!sphereHit || dotHit.distance <= sphereHit.distance + 2)) {
        return dotHit.object.userData.id;
      }
      if (!sphereHit) return null;
      const { lat, lng } = vecToLatLng(Globe.worldToLocal(sphereHit.point.clone()));
      const f = featureAt(worldRef.current.features, lng, lat);
      return f ? countryId(f) : null;
    };

    const onPointerDown = (e) => {
      pointerIsDown = true;
      downPos = { x: e.clientX, y: e.clientY };
      tween = null; // the user grabbed the globe: cancel any fly-to
    };
    const onPointerRelease = () => {
      pointerIsDown = false;
    };
    const onPointerUp = (e) => {
      pointerIsDown = false;
      if (!downPos) return;
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      downPos = null;
      if (moved > 5) return; // it was a drag, not a click

      const id = pick(e);
      if (id) setSelectedId(id);
    };

    let lastMove = 0;
    const onPointerMove = (e) => {
      if (pointerIsDown) {
        setHover(null);
        return;
      }
      const now = performance.now();
      if (now - lastMove < 30) return;
      lastMove = now;
      const id = pick(e);
      el.style.cursor = id ? 'pointer' : '';
      const rect = el.getBoundingClientRect();
      setHover(id ? { id, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
    };
    const onPointerLeave = () => setHover(null);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerRelease);
    window.addEventListener('pointerup', onPointerRelease);
    window.addEventListener('blur', onPointerRelease);

    // --- Fly the camera to the center of a country ---
    const focus = (id) => {
      const c = worldRef.current.centers[id];
      if (!c) return;
      Globe.updateWorldMatrix(true, false);
      const toDir = Globe.localToWorld(latLngToVec(c.lat, c.lng, GLOBE_RADIUS)).normalize();
      const fromPos = camera.position.clone();
      const fromDir = fromPos.clone().normalize();

      // Frame the country: bigger countries -> further out, within the zoom limits
      const arc = (GLOBE_RADIUS * c.extent * Math.PI) / 180;
      const gap = THREE.MathUtils.clamp(arc / 0.52, 40, 130);
      const toDist = THREE.MathUtils.clamp(
        GLOBE_RADIUS + gap,
        controls.minDistance,
        controls.maxDistance
      );

      tween = {
        start: performance.now(),
        dur: 1100,
        fromDir,
        q: new THREE.Quaternion().setFromUnitVectors(fromDir, toDir),
        fromDist: fromPos.length(),
        toDist,
        fromTarget: controls.target.clone(),
      };
    };
    sceneApiRef.current = { refresh, focus };

    // --- Animation loop ---
    const ORIGIN = new THREE.Vector3();
    let animationFrameId;
    const animate = () => {
      // Camera fly-to (ease-out), rotating around the globe's center
      if (tween) {
        const t = Math.min(1, (performance.now() - tween.start) / tween.dur);
        const e = 1 - Math.pow(1 - t, 3);
        const qt = new THREE.Quaternion().slerp(tween.q, e);
        const dir = tween.fromDir.clone().applyQuaternion(qt);
        const dist = tween.fromDist + (tween.toDist - tween.fromDist) * e;
        camera.position.copy(dir.multiplyScalar(dist));
        controls.target.lerpVectors(tween.fromTarget, ORIGIN, e);
        if (t >= 1) tween = null;
      }

      // Make the point under the cursor follow the mouse at any zoom.
      // OrbitControls turns 2*PI*rotateSpeed radians per screen-height of drag. A pixel
      // at the globe's center spans 2*gap*tan(fov/2)/height units of surface (gap =
      // camera-to-surface distance), i.e. that / R radians of globe rotation. Solving:
      const gap = Math.max(1, camera.position.distanceTo(controls.target) - GLOBE_RADIUS);
      controls.rotateSpeed =
        (gap * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / (Math.PI * GLOBE_RADIUS);
      controls.update();

      // Spin only when idle: nothing selected, not being dragged, not flying
      if (!pointerIsDown && !selectedIdRef.current && !tween) Globe.rotation.y += 0.001;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // --- Resize ---
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      cancelled = true;
      sceneApiRef.current = null;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerRelease);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('blur', onPointerRelease);
      dots.forEach((d) => {
        d.tex.dispose();
        d.sprite.material.dispose();
      });
      pickSphere.geometry.dispose();
      pickSphere.material.dispose();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Recolor / re-highlight the globe when the index or selection changes
  useEffect(() => {
    activeKeyRef.current = activeKey;
    metricRef.current = metric;
    selectedIdRef.current = selectedId;
    sceneApiRef.current?.refresh();
  }, [activeKey, metric, selectedId]);

  // Zoom to the center of whichever country gets selected (map click or chart click)
  useEffect(() => {
    if (selectedId) sceneApiRef.current?.focus(selectedId);
  }, [selectedId]);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  // Scrolling the panel: first grow the window up to the top of the page, then let
  // the content scroll. Scrolling back at the top of the content shrinks it again.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return undefined;
    const minH = () => Math.min(window.innerHeight * 0.5, 476);
    const maxH = () => window.innerHeight;

    // dy > 0: content moving up (wheel down / swipe up). Returns true if it consumed the gesture.
    const apply = (dy) => {
      if (!selectedIdRef.current || !panelOpenRef.current) return false;
      const cur = panelHRef.current ?? minH();
      const scrollTop = bodyRef.current?.scrollTop ?? 0;
      let next = null;
      if (dy > 0 && cur < maxH()) next = Math.min(maxH(), cur + dy);
      else if (dy < 0 && scrollTop <= 0 && cur > minH()) next = Math.max(minH(), cur + dy);
      if (next == null) return false;
      panelHRef.current = next;
      setPanelH(next);
      return true;
    };

    const onWheel = (e) => {
      if (apply(e.deltaY)) e.preventDefault();
    };
    let lastY = 0;
    const onTouchStart = (e) => {
      lastY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      const y = e.touches[0].clientY;
      const dy = lastY - y;
      lastY = y;
      if (apply(dy)) e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const hidden = !selectedId;
  const panelY = hidden ? '110%' : panelOpen ? '0px' : `calc(100% - ${HEADER_H}px)`;

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: PAGE_BG,
        overflow: 'hidden',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Hover tooltip */}
      {tip && hover && (
        <div
          style={{
            position: 'absolute',
            left: hover.x,
            top: hover.y,
            transform: `translate(${hover.x > window.innerWidth - 260 ? 'calc(-100% - 14px)' : '14px'}, 14px)`,
            pointerEvents: 'none',
            zIndex: 5,
            minWidth: 190,
            padding: '10px 14px',
            background: 'rgba(20,24,32,0.94)',
            color: '#fff',
            borderRadius: 10,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>{tip.name}</div>
          <div style={{ margin: '6px 0 4px', opacity: 0.65 }}>Highest in Metric:</div>
          {tip.top.map((t, i) => (
            <div
              key={i}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontFamily: 'monospace' }}
            >
              <span>{t.name}</span>
              <span>{t.v.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top left: index switcher */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 8px',
          background: 'rgba(20,24,32,0.82)',
          color: '#fff',
          borderRadius: 999,
          font: '13px monospace',
        }}
      >
        <button style={roundBtn} onClick={() => stepKey(-1)} aria-label="Previous index">
          &#9664;
        </button>
        <div style={{ minWidth: 150, textAlign: 'center' }}>
          <div style={{ fontSize: 10, opacity: 0.6 }}>
            index {keyIdx + 1} / {INDEX_KEYS.length}
          </div>
          <strong>{activeKey}</strong>
        </div>
        <button style={roundBtn} onClick={() => stepKey(1)} aria-label="Next index">
          &#9654;
        </button>
      </div>

      {/* Left side: metric selector (top to bottom: red, green, purple, blue) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 16,
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '14px 16px',
          background: 'rgba(20,24,32,0.82)',
          color: '#fff',
          borderRadius: 16,
          font: '13px monospace',
        }}
      >
        {METRICS.map((m, i) => {
          const active = i === metric;
          return (
            <div
              key={m.key}
              onClick={() => setMetric(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                userSelect: 'none',
                opacity: active ? 1 : 0.6,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: circleGradient(m.color),
                  boxShadow: active ? '0 0 0 2px #fff' : 'none',
                }}
              />
              <span style={{ fontWeight: active ? 700 : 400 }}>{m.name}</span>
            </div>
          );
        })}
      </div>

      {/* Slide-up window */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          width: 'min(1500px, calc(100vw - 24px))',
          height: panelH ?? 'min(50vh, 476px)',
          transform: `translateX(-50%) translateY(${panelY})`,
          transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
          pointerEvents: hidden ? 'none' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: '#f8f9fc',
          borderRadius: '18px 18px 0 0',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header (stays visible when folded down) */}
        <div
          onClick={() => setPanelOpen((o) => !o)}
          style={{
            flex: `0 0 ${HEADER_H}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px 0 20px',
            background: '#1b2130',
            color: '#fff',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedEntry?.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'monospace' }}>
              {activeKey} &middot; {METRICS[metric].name}: {selectedValue?.toFixed(2)}
              {rank ? ` \u00b7 #${rank.pos} of ${rank.n} (high to low)` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{
                ...roundBtn,
                transform: panelOpen ? 'none' : 'rotate(180deg)',
                transition: 'transform 0.3s',
              }}
              aria-label={panelOpen ? 'Fold down' : 'Fold up'}
            >
              &#9662;
            </button>
            <button
              style={roundBtn}
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(null);
                setPanelOpen(true);
                panelHRef.current = null;
                setPanelH(null);
              }}
            >
              &#10005;
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 28px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#111827' }}>
            Comparing {selectedEntry?.name}
          </h3>
          {world && <PortfolioStats world={world} activeKey={activeKey} metric={metric} />}
          <p style={paraStyle}>{FILLER_ABOVE}</p>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '0 0 10px',
              fontSize: 12,
              color: '#4b5563',
            }}
          >
            Shape size
            <input
              type="range"
              min={20}
              max={100}
              step={1}
              value={shapeSize}
              onChange={(e) => setShapeSize(Number(e.target.value))}
            />
            <span style={{ fontFamily: 'monospace' }}>{shapeSize}px</span>
          </label>

          {world && selectedId && (
            <ComparisonChart
              world={world}
              activeKey={activeKey}
              metric={metric}
              selectedId={selectedId}
              size={shapeSize}
              onSelect={setSelectedId}
            />
          )}

          <div style={{ height: 18 }} />
          {FILLER_BELOW.slice(0, -3).map((t, i) => (
            <p key={i} style={paraStyle}>
              {t}
            </p>
          ))}

          {world && selectedEntry && (
            <MetricSection entry={selectedEntry} activeKey={activeKey} metric={metric} />
          )}

          {FILLER_BELOW.slice(-3).map((t, i) => (
            <p key={`last-${i}`} style={paraStyle}>
              {t}
            </p>
          ))}

          {world && selectedEntry && (
            <IndexComparison world={world} selectedId={selectedId} activeKey={activeKey} metric={metric} />
          )}
        </div>
      </div>
    </div>
  );
}
