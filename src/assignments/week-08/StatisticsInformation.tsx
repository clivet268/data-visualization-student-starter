import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import styles from './spillover.module.css';
import type { SiteData } from './Polygons';
import { SlidePanel } from './SlidePanel';

interface StatsInfo {
  selectedSites: Map<string, SiteData>;
  compareMode: boolean;
  onSiteClick: (id: string) => void;
}

type Tab = 'contaminants' | 'areas' | 'media';
const TABS: { id: Tab; label: string }[] = [
  { id: 'contaminants', label: 'Contaminants' },
  { id: 'areas', label: 'Site areas' },
  { id: 'media', label: 'Media' },
];
const TAB_TITLES: Record<Tab, string> = {
  contaminants: 'Area affected per contaminant, by site',
  areas: 'Area of selected sites',
  media: 'Contaminant area by medium',
};

interface Slice {
  id?: string;
  label: string;
  value: number;
}
interface ContaminantRow {
  name: string;
  bySite: Record<string, number>;
  total: number;
}
interface SiteRef {
  id: string;
  label: string;
}
type Svg = d3.Selection<SVGSVGElement, unknown, null, undefined>;
type G = d3.Selection<SVGGElement, unknown, null, undefined>;

const MAX_BARS = 12; // contaminants shown on the bar chart (largest total area first)
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const LEGEND_ROW = 18;
const truncate = (s: string, n = 14) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmt = d3.format(',.1f');
// assumes GIS_AREA is in acres for every site
const siteArea = (s: SiteData) =>
  typeof s.siteProperties.GIS_AREA === 'number' ? s.siteProperties.GIS_AREA : 0;

// legend that shows as many rows as fit, then "+N more"
function drawLegend(
  g: G,
  items: { label: string; color: string }[],
  width: number,
  height: number,
) {
  const chars = Math.max(4, Math.floor((width - 18) / 6.2));
  const rowsFit = Math.max(1, Math.floor(height / LEGEND_ROW));
  const shown = items.length > rowsFit ? items.slice(0, rowsFit - 1) : items;
  shown.forEach((it, i) => {
    const row = g.append('g').attr('transform', `translate(0,${i * LEGEND_ROW})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('fill', it.color);
    row
      .append('text')
      .attr('x', 18)
      .attr('y', 10)
      .attr('font-size', 11)
      .attr('fill', 'currentColor')
      .text(truncate(it.label, chars));
  });
  if (shown.length < items.length) {
    g.append('text')
      .attr('y', shown.length * LEGEND_ROW + 10)
      .attr('font-size', 11)
      .attr('fill', 'currentColor')
      .text(`+${items.length - shown.length} more`);
  }
}

function drawBars(
  svg: Svg,
  rows: ContaminantRow[],
  sites: SiteRef[],
  W: number,
  H: number,
  onSiteClick: (id: string) => void,
) {
  if (rows.length === 0) return;
  const legendW = Math.min(150, Math.round(W * 0.35));
  const M = { top: 10, right: legendW + 15, bottom: 62, left: 56 };
  const innerW = Math.max(20, W - M.left - M.right);
  const innerH = Math.max(40, H - M.top - M.bottom);
  const ids = sites.map((s) => s.id);
  const labels = new Map(sites.map((s) => [s.id, s.label]));

  const x = d3
    .scaleBand<string>()
    .domain(rows.map((r) => r.name))
    .range([0, innerW])
    .padding(0.2);
  const series = d3
    .stack<ContaminantRow>()
    .keys(ids)
    .value((d, k) => d.bySite[k] ?? 0)(rows);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(rows, (r) => r.total) ?? 1])
    .nice()
    .range([innerH, 0]);
  const color = d3.scaleOrdinal<string, string>().domain(ids).range(d3.schemeTableau10);

  const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

  series.forEach((s) => {
    g.append('g')
      .attr('fill', color(s.key))
      .selectAll('rect')
      .data(s)
      .join('rect')
      .attr('x', (d) => x(d.data.name)!)
      .attr('y', (d) => y(d[1]))
      .attr('height', (d) => y(d[0]) - y(d[1]))
      .attr('width', x.bandwidth())
      .style('cursor', 'pointer')
      .on('click', () => onSiteClick(s.key))
      .append('title')
      .text((d) => `${labels.get(s.key)}\n${d.data.name}: ${fmt(d[1] - d[0])} acres`);
  });

  // skip tick labels when bars get too narrow for them; the tooltip still has the full name
  const every = Math.max(1, Math.ceil(19 / x.step()));
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(rows.map((r) => r.name).filter((_, i) => i % every === 0))
        .tickFormat((n) => truncate(n, 12)),
    )
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end');

  g.append('g').call(
    d3
      .axisLeft(y)
      .ticks(Math.max(2, Math.floor(innerH / 30)))
      .tickFormat(d3.format('~s')),
  );

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -44)
    .attr('text-anchor', 'middle')
    .attr('fill', 'currentColor')
    .attr('font-size', 11)
    .text('Area (acres)');

  drawLegend(
    g.append('g').attr('transform', `translate(${innerW + 15},0)`),
    sites.map((s) => ({ label: s.label, color: color(s.id) })),
    legendW,
    innerH,
  );
}

function drawPie(svg: Svg, data: Slice[], W: number, H: number, onSiteClick: (id: string) => void) {
  const slices = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (slices.length === 0) return;
  const total = d3.sum(slices, (d) => d.value);
  const legendW = Math.min(170, Math.round(W * 0.4));
  const r = Math.max(20, Math.min((W - legendW - 25) / 2, H / 2 - 10));
  const color = d3
    .scaleOrdinal<string, string>()
    .domain(slices.map((s) => s.label))
    .range(d3.schemeTableau10);
  const arc = d3.arc<d3.PieArcDatum<Slice>>().innerRadius(0).outerRadius(r);

  svg
    .append('g')
    .attr('transform', `translate(${r + 10},${r + 10})`)
    .selectAll('path')
    .data(
      d3
        .pie<Slice>()
        .value((d) => d.value)
        .sort(null)(slices),
    )
    .join('path')
    .attr('d', (d) => arc(d))
    .attr('fill', (d) => color(d.data.label))
    .style('stroke', 'var(--chart-slice-stroke)')
    .style('cursor', (d) => (d.data.id ? 'pointer' : 'default'))
    .on('click', (_, d) => {
      if (d.data.id) onSiteClick(d.data.id);
    })
    .append('title')
    .text(
      (d) =>
        `${d.data.label}\n${fmt(d.data.value)} acres (${d3.format('.1%')(d.data.value / total)})`,
    );

  const legendX = 2 * r + 30;
  drawLegend(
    svg.append('g').attr('transform', `translate(${legendX},10)`),
    slices.map((s) => ({
      label: `${s.label} (${d3.format('.0%')(s.value / total)})`,
      color: color(s.label),
    })),
    Math.max(60, W - legendX),
    H - 20,
  );
}

export function SitesStatistics({ selectedSites, compareMode, onSiteClick }: StatsInfo) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tab, setTab] = useState<Tab>('contaminants');
  const [zoom, setZoom] = useState(ZOOM_MIN);

  // measure the chart area; callback ref because the panel isn't mounted outside compare mode
  useEffect(() => {
    if (!viewport) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) }),
    );
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [viewport]);

  // rebuilt every render on purpose: contaminants are mutated into SiteData in place
  const sites = [...selectedSites.values()];
  const siteRefs: SiteRef[] = sites.map((s) => ({
    id: s.siteProperties.EPA_ID,
    label: s.siteProperties.SITE_NAME,
  }));

  // tab 1: contaminant name -> { siteId: site area } for every site that has it
  const byName = new Map<string, Record<string, number>>();
  for (const site of sites) {
    const id = site.siteProperties.EPA_ID;
    for (const c of site.getContaminants()) {
      const rec = byName.get(c.name) ?? {};
      rec[id] = siteArea(site);
      byName.set(c.name, rec);
    }
  }
  const contaminantRows: ContaminantRow[] = [...byName]
    .map(([name, bySite]) => ({ name, bySite, total: d3.sum(Object.values(bySite)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_BARS);

  // tab 2: one slice per site
  const siteSlices: Slice[] = sites.map((s) => ({
    id: s.siteProperties.EPA_ID,
    label: s.siteProperties.SITE_NAME,
    value: siteArea(s),
  }));

  // tab 3: each site's area is split equally across its (contaminant, medium) pairs
  const mediaArea = new Map<string, number>();
  for (const site of sites) {
    const media = site
      .getContaminants()
      .flatMap((c) => (c.media.length ? c.media : ['Unspecified']));
    if (media.length === 0) continue;
    const share = siteArea(site) / media.length;
    for (const m of media) mediaArea.set(m, (mediaArea.get(m) ?? 0) + share);
  }
  const mediaSlices: Slice[] = [...mediaArea].map(([label, value]) => ({ label, value }));

  const hasData =
    tab === 'contaminants'
      ? contaminantRows.length > 0
      : tab === 'areas'
        ? siteSlices.some((s) => s.value > 0)
        : mediaSlices.some((s) => s.value > 0);

  // at zoom 1 the chart is exactly the viewport height, so nothing scrolls
  const chartH = size.h * zoom;
  const ready = size.w > 40 && size.h > 40;
  const signature = JSON.stringify({
    tab,
    siteRefs,
    contaminantRows,
    siteSlices,
    mediaSlices,
    size,
    zoom,
  });

  useEffect(() => {
    if (!svgRef.current || !ready) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (tab === 'contaminants')
      drawBars(svg, contaminantRows, siteRefs, size.w, chartH, onSiteClick);
    else drawPie(svg, tab === 'areas' ? siteSlices : mediaSlices, size.w, chartH, onSiteClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!compareMode) return null;

  const totalAcres = sites.reduce((sum, s) => sum + siteArea(s), 0);
  const uniqueContaminants = new Set(sites.flatMap((s) => s.getContaminants().map((c) => c.name)))
    .size;
  const finalNpl = sites.filter((s) => s.siteProperties.NPL_STATUS === 'F').length;

  return (
    <SlidePanel side="left" placement={styles.statsPanel}>
      <div className={styles.boxTitle}>Compare Sites</div>

      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`${styles.titleButton} ${tab === t.id ? styles.titleButtonActive : ''}`}
          >
            {t.label}
          </button>
        ))}

        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.zoomButton}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 1))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className={styles.zoomLevel}>{zoom}×</span>
          <button
            type="button"
            className={styles.zoomButton}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 1))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <div className={`${styles.contentbox} ${styles.contentboxhorizontal}`}>
          <div className={styles.contentboxname}>Summary</div>
          <div className={styles.contentboxvalue}>
            <span className={styles.contentinline}>
              <span className={styles.contentlabel}>Sites:</span> {sites.length}
            </span>
            <span className={styles.contentinline}>
              <span className={styles.contentlabel}>Final NPL:</span> {finalNpl}
            </span>
            <span className={styles.contentinline}>
              <span className={styles.contentlabel}>Area:</span>{' '}
              {totalAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres
            </span>
            <span className={styles.contentinline}>
              <span className={styles.contentlabel}>Contaminants:</span> {uniqueContaminants}
            </span>
          </div>
        </div>
      </div>

      <div className={`${styles.boxScroll} ${styles.boxFill}`}>
        <div className={`${styles.contentbox} ${styles.contentboxfill}`}>
          <div className={styles.contentboxname}>{TAB_TITLES[tab]}</div>
          <div ref={setViewport} className={`${styles.contentboxvalue} ${styles.chartViewport}`}>
            {sites.length === 0 && (
              <div className={styles.muted}>
                Click polygons on the map to add sites to the comparison.
              </div>
            )}
            {sites.length > 0 && !hasData && (
              <div className={styles.muted}>No data for the selected sites (yet).</div>
            )}
            {hasData && (
              <svg
                ref={svgRef}
                width={size.w}
                height={chartH}
                style={{ color: 'var(--jet-black)' }}
              />
            )}
          </div>
        </div>
      </div>
    </SlidePanel>
  );
}
