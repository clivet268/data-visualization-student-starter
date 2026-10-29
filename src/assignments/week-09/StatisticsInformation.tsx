import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import styles from './spillover.module.css';
import type { SiteData } from './Polygons';

interface StatsInfo {
  selectedSites: Map<string, SiteData>;
  compareMode: boolean;
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

interface Slice { label: string; value: number }
interface ContaminantRow { name: string; bySite: Record<string, number>; total: number }
interface SiteRef { id: string; label: string }
type Svg = d3.Selection<SVGSVGElement, unknown, null, undefined>;

const W = 640;
const H = 320;
const MAX_BARS = 12; // contaminants shown on the bar chart (largest total area first)
const truncate = (s: string, n = 14) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmt = d3.format(',.1f');
// assumes GIS_AREA is in acres for every site
const siteArea = (s: SiteData) =>
  typeof s.siteProperties.GIS_AREA === 'number' ? s.siteProperties.GIS_AREA : 0;

function drawBars(svg: Svg, rows: ContaminantRow[], sites: SiteRef[]) {
  if (rows.length === 0) return;
  const M = { top: 10, right: 150, bottom: 80, left: 55 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const ids = sites.map((s) => s.id);
  const labels = new Map(sites.map((s) => [s.id, s.label]));

  const x = d3.scaleBand<string>().domain(rows.map((r) => r.name)).range([0, innerW]).padding(0.2);
  const series = d3.stack<ContaminantRow>().keys(ids).value((d, k) => d.bySite[k] ?? 0)(rows);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.total) ?? 1]).nice().range([innerH, 0]);
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
      .append('title')
      .text((d) => `${labels.get(s.key)}\n${d.data.name}: ${fmt(d[1] - d[0])} acres`);
  });

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat((n) => truncate(n)))
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end');

  g.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('~s')));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .attr('fill', 'currentColor')
    .attr('font-size', 11)
    .text('Area (acres)');

  const legend = g.append('g').attr('transform', `translate(${innerW + 15},0)`);
  sites.slice(0, 16).forEach((s, i) => {
    const row = legend.append('g').attr('transform', `translate(0,${i * 18})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(s.id));
    row.append('text').attr('x', 18).attr('y', 10).attr('font-size', 11).attr('fill', 'currentColor').text(truncate(s.label, 18));
  });
}

function drawPie(svg: Svg, data: Slice[]) {
  const slices = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (slices.length === 0) return;
  const total = d3.sum(slices, (d) => d.value);
  const r = H / 2 - 10;
  const color = d3.scaleOrdinal<string, string>().domain(slices.map((s) => s.label)).range(d3.schemeTableau10);
  const arc = d3.arc<d3.PieArcDatum<Slice>>().innerRadius(0).outerRadius(r);

  svg.append('g')
    .attr('transform', `translate(${r + 10},${H / 2})`)
    .selectAll('path')
    .data(d3.pie<Slice>().value((d) => d.value).sort(null)(slices))
    .join('path')
    .attr('d', (d) => arc(d))
    .attr('fill', (d) => color(d.data.label))
    .attr('stroke', '#fff')
    .append('title')
    .text((d) => `${d.data.label}\n${fmt(d.data.value)} acres (${d3.format('.1%')(d.data.value / total)})`);

  const legend = svg.append('g').attr('transform', `translate(${2 * r + 40},10)`);
  slices.slice(0, 16).forEach((s, i) => {
    const row = legend.append('g').attr('transform', `translate(0,${i * 18})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(s.label));
    row.append('text')
      .attr('x', 18).attr('y', 10).attr('font-size', 11).attr('fill', 'currentColor')
      .text(`${truncate(s.label, 26)} (${d3.format('.0%')(s.value / total)})`);
  });
}

export function SitesStatistics({ selectedSites, compareMode }: StatsInfo) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tab, setTab] = useState<Tab>('contaminants');

  // rebuilt every render on purpose: contaminants are mutated into SiteData in place
  const sites = [...selectedSites.values()];
  const siteRefs: SiteRef[] = sites.map((s) => ({ id: s.siteProperties.EPA_ID, label: s.siteProperties.SITE_NAME }));

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
  const siteSlices: Slice[] = sites.map((s) => ({ label: s.siteProperties.SITE_NAME, value: siteArea(s) }));

  // tab 3: each site's area is split equally across its (contaminant, medium) pairs
  const mediaArea = new Map<string, number>();
  for (const site of sites) {
    const media = site.getContaminants().flatMap((c) => (c.media.length ? c.media : ['Unspecified']));
    if (media.length === 0) continue;
    const share = siteArea(site) / media.length;
    for (const m of media) mediaArea.set(m, (mediaArea.get(m) ?? 0) + share);
  }
  const mediaSlices: Slice[] = [...mediaArea].map(([label, value]) => ({ label, value }));

  const hasData =
    tab === 'contaminants' ? contaminantRows.length > 0
    : tab === 'areas' ? siteSlices.some((s) => s.value > 0)
    : mediaSlices.some((s) => s.value > 0);

  const signature = JSON.stringify({ tab, siteRefs, contaminantRows, siteSlices, mediaSlices });

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (tab === 'contaminants') drawBars(svg, contaminantRows, siteRefs);
    else drawPie(svg, tab === 'areas' ? siteSlices : mediaSlices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!compareMode) return null;

  const totalAcres = sites.reduce((sum, s) => sum + siteArea(s), 0);
  const uniqueContaminants = new Set(sites.flatMap((s) => s.getContaminants().map((c) => c.name))).size;
  const finalNpl = sites.filter((s) => s.siteProperties.NPL_STATUS === 'F').length;

  return (
    <div className={`${styles.panel} ${styles.statsPanel} ${styles.spilloverlay} ${styles.nicebox}`}>
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
      </div>

      <div className={styles.boxScroll}>
        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>Summary</div>
          <div className={styles.contentboxvalue}>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>Sites selected</span>
              <span className={styles.contentdata}>{sites.length}</span>
            </div>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>Final NPL sites</span>
              <span className={styles.contentdata}>{finalNpl}</span>
            </div>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>Combined area</span>
              <span className={styles.contentdata}>{totalAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres</span>
            </div>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>Unique contaminants</span>
              <span className={styles.contentdata}>{uniqueContaminants}</span>
            </div>
          </div>
        </div>

        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>{TAB_TITLES[tab]}</div>
          <div className={styles.contentboxvalue}>
            {sites.length === 0 && (
              <div className={styles.muted}>Click polygons on the map to add sites to the comparison.</div>
            )}
            {sites.length > 0 && !hasData && (
              <div className={styles.muted}>No data for the selected sites (yet).</div>
            )}
            {hasData && (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                style={{ width: '100%', height: 'auto', color: 'var(--jet-black)' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}