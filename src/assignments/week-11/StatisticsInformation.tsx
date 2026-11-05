import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import styles from './spillover.module.css';
import type { SiteData } from './Polygons';
import { SlidePanel } from './SlidePanel';
import { NPL_STATUS_LABELS } from './filters';

interface StatsInfo {
  selectedSites: Map<string, SiteData>;
  compareMode: boolean;
  onSiteClick: (id: string) => void;
  pinsActive: boolean;
  outlinedAcres: number | null;
}

type Tab = 'contaminants' | 'areas' | 'media' | 'timeline';
const TABS: { id: Tab; label: string }[] = [
  { id: 'contaminants', label: 'Contaminants' },
  { id: 'areas', label: 'Site areas' },
  { id: 'media', label: 'Media' },
  { id: 'timeline', label: 'Timeline' },
];
const TAB_TITLES: Record<Tab, string> = {
  contaminants: 'Area affected per contaminant, by site',
  areas: 'Area of selected sites',
  media: 'Contaminant area by medium',
  timeline: 'Sites per time bucket (last updated)',
};

interface Slice { id?: string; label: string; value: number; sites?: { name: string; value: number }[] }
interface ContaminantRow { name: string; bySite: Record<string, number>; total: number }
interface SiteRef { id: string; label: string }
type Svg = d3.Selection<SVGSVGElement, unknown, null, undefined>;
type G = d3.Selection<SVGGElement, unknown, null, undefined>;

type TipTarget =
  | { kind: 'site'; siteId: string; contaminant?: string }
  | { kind: 'contaminant'; name: string }
  | { kind: 'medium'; label: string; sites: { name: string; value: number }[] }
  | { kind: 'bucket'; label: string; sites: { name: string; date: number }[] };

// identity of a chart shape; used to pin it, highlight it and find it again after a redraw
const keyOf = (t: TipTarget): string =>
  t.kind === 'site' ? `site:${t.siteId}|${t.contaminant ?? ''}`
  : t.kind === 'contaminant' ? `col:${t.name}`
  : t.kind === 'bucket' ? `bucket:${t.label}`
  : `slice:${t.label}`;

interface Target { els: Element[]; dx: number; dy: number }
interface Geom { x: number; yT: number; yB: number; w: number } // shapes to clone + how far they move
interface Drawn { overlay: G; targets: Map<string, Target>; geom?: Map<string, Geom> }

interface HoverApi {
  enter: (t: TipTarget, e: MouseEvent) => void;
  move: (e: MouseEvent) => void;
  leave: () => void;
  click: (t: TipTarget) => void;
}

const HIST_DATE_FIELD = 'LAST_CHANG' as const; // or 'ORIGINAL_C'
const HIST_MS = 450;
const BUCKET_MAX = 60;
type Unit = 'months' | 'years';
const fmtDate = d3.timeFormat('%b %-d, %Y');
const UNIT_FMT = { months: d3.timeFormat('%b %Y'), years: d3.timeFormat('%Y') };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Bucket { key: string; label: string; sites: { id: string; name: string; date: number }[] }

function makeBuckets(sites: SiteData[], size: number, unit: Unit): Bucket[] {
  const dated = sites.flatMap((s) => {
    const t = s.siteProperties[HIST_DATE_FIELD];
    return typeof t === 'number' && Number.isFinite(t)
      ? [{ id: s.siteProperties.EPA_ID, name: s.siteProperties.SITE_NAME, date: t }]
      : [];
  });
  if (dated.length === 0) return [];
  const interval = unit === 'years' ? d3.timeYear : d3.timeMonth;
  const f = UNIT_FMT[unit];
  const start = interval.floor(new Date(d3.min(dated, (d) => d.date)!));
  const count = Math.floor(interval.count(start, new Date(d3.max(dated, (d) => d.date)!)) / size) + 1;
  const buckets: Bucket[] = d3.range(count).map((i) => {
    const from = interval.offset(start, i * size);
    const last = interval.offset(start, (i + 1) * size - 1);
    return { key: String(i), label: size === 1 ? f(from) : `${f(from)}–${f(last)}`, sites: [] };
  });
  for (const d of dated) buckets[Math.floor(interval.count(start, new Date(d.date)) / size)].sites.push(d);
  buckets.forEach((b) => b.sites.sort((a, c) => a.name.localeCompare(c.name)));
  return buckets;
}

// Each site is one equal-height segment. `prev` holds last draw's segment geometry by site, so
// existing sites slide to their new bucket and new ones grow up from the baseline.
function drawHistogram(
  svg: Svg, buckets: Bucket[], sites: SiteRef[], W: number, H: number, hv: HoverApi, prev: Map<string, Geom>
): Drawn | null {
  if (buckets.length === 0) return null;
  const legendW = Math.min(150, Math.round(W * 0.35));
  const M = { top: 10 + BAR_DEPTH, right: legendW + 15, bottom: 62, left: 56 };
  const innerW = Math.max(20, W - M.left - M.right);
  const innerH = Math.max(40, H - M.top - M.bottom);
  const maxCount = d3.max(buckets, (b) => b.sites.length) ?? 1;

  const x = d3.scaleBand<string>().domain(buckets.map((b) => b.key)).range([0, innerW]).padding(0.15);
  const dep = Math.min(BAR_DEPTH, x.bandwidth() * 0.3);
  const barW = x.bandwidth() - dep;
  const y = d3.scaleLinear().domain([0, maxCount]).range([innerH, 0]);
  const color = palette(sites.map((s) => s.id));

  const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
  const barsG = g.append('g');
  const overlay = g.append('g').style('pointer-events', 'none');
  const targets = new Map<string, Target>();
  const geom = new Map<string, Geom>();
  const columns = new Map<string, Element[]>();

  for (const b of buckets) {
    const els: Element[] = [];
    columns.set(b.key, els);
    b.sites.forEach((s, i) => {
      const tip: TipTarget = { kind: 'site', siteId: s.id };
      const key = keyOf(tip);
      const fill = color(s.id);
      const to: Geom = { x: x(b.key)!, yT: y(i + 1), yB: y(i), w: barW };
      const from = prev.get(key) ?? { x: to.x, yT: y(0), yB: y(0), w: to.w };
      geom.set(key, to);

      const grp = barsG.append('g').attr('class', styles.seg);
      const rect = grp.append('rect').attr('fill', fill).style('stroke', 'var(--chart-slice-stroke)').style('stroke-width', 0.5);
      const side = grp.append('path').attr('fill', shade(fill));
      const top = grp.append('path').attr('fill', tint(fill)).style('display', i === b.sites.length - 1 ? null : 'none');
      const apply = (gm: Geom) => {
        rect.attr('x', gm.x).attr('y', gm.yT).attr('width', gm.w).attr('height', Math.max(0, gm.yB - gm.yT));
        side.attr('d', `M${gm.x + gm.w},${gm.yT} l${dep},${-dep} V${gm.yB - dep} L${gm.x + gm.w},${gm.yB} Z`);
        top.attr('d', `M${gm.x},${gm.yT} l${dep},${-dep} h${gm.w} l${-dep},${dep} Z`);
      };
      apply(from);
      grp.transition().duration(HIST_MS).ease(d3.easeCubicOut).tween('geom', () => (t: number) =>
        apply({ x: lerp(from.x, to.x, t), yT: lerp(from.yT, to.yT, t), yB: lerp(from.yB, to.yB, t), w: lerp(from.w, to.w, t) })
      );

      grp
        .on('mouseenter', (ev: MouseEvent) => hv.enter(tip, ev))
        .on('mousemove', (ev: MouseEvent) => hv.move(ev))
        .on('mouseleave', () => hv.leave())
        .on('click', () => hv.click(tip));

      targets.set(key, { els: [grp.node()!], dx: 0, dy: -LIFT });
      els.push(grp.node()!);
    });
  }

  const labels = new Map(buckets.map((b) => [b.key, b.label]));
  const every = Math.max(1, Math.ceil(19 / x.step()));
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3.axisBottom(x)
        .tickValues(buckets.map((b) => b.key).filter((_, i) => i % every === 0))
        .tickFormat((k) => truncate(labels.get(k) ?? k, 16))
    )
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end');

  // strip under each non-empty bucket: hover/click it for the whole bucket
  const bucketTarget = (b: Bucket): TipTarget => ({
    kind: 'bucket', label: b.label, sites: b.sites.map((s) => ({ name: s.name, date: s.date })),
  });
  for (const b of buckets) {
    if (b.sites.length === 0) continue;
    targets.set(keyOf({ kind: 'bucket', label: b.label, sites: [] }), { els: columns.get(b.key)!, dx: 0, dy: -LIFT });
  }
  g.append('g')
    .selectAll('rect')
    .data(buckets.filter((b) => b.sites.length > 0))
    .join('rect')
    .attr('x', (b) => x(b.key)!)
    .attr('y', innerH)
    .attr('width', x.bandwidth())
    .attr('height', Math.min(M.bottom - 4, 28))
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .on('mouseenter', (ev: MouseEvent, b: Bucket) => hv.enter(bucketTarget(b), ev))
    .on('mousemove', (ev: MouseEvent) => hv.move(ev))
    .on('mouseleave', () => hv.leave())
    .on('click', (_: MouseEvent, b: Bucket) => hv.click(bucketTarget(b)));

  g.append('g').call(
    d3.axisLeft(y).ticks(Math.min(maxCount, Math.max(2, Math.floor(innerH / 30)))).tickFormat(d3.format('d'))
  );
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -44)
    .attr('text-anchor', 'middle')
    .attr('fill', 'currentColor')
    .attr('font-size', 11)
    .text('Sites');

  drawLegend(
    g.append('g').attr('transform', `translate(${innerW + 15},0)`),
    sites.map((s) => ({ label: s.label, color: color(s.id) })),
    legendW,
    innerH
  );

  return { overlay, targets, geom };
}

const MAX_PINNED = 2;
const TIP_GAP = 14;
const TIP_MARGIN = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
const overlapArea = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const MAX_BARS = 12; // contaminants shown on the bar chart (largest total area first)
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const LEGEND_ROW = 18;
const BAR_DEPTH = 7;
const PIE_DEPTH = 8;
const EXPLODE = 8; // how far a hovered pie slice moves out
const LIFT = 4; // how far a hovered bar segment moves up
const truncate = (s: string, n = 14) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmt = d3.format(',.1f');
// assumes GIS_AREA is in acres for every site
const siteArea = (s: SiteData) =>
  typeof s.siteProperties.GIS_AREA === 'number' ? s.siteProperties.GIS_AREA : 0;

const palette = (domain: string[]) =>
  d3.scaleOrdinal<string, string>().domain(domain).range(d3.schemeTableau10);
const shade = (c: string) => d3.color(c)!.darker(0.7).formatHex(); // side faces
const tint = (c: string) => d3.color(c)!.brighter(0.5).formatHex(); // top faces



// legend that shows as many rows as fit, then "+N more"
function drawLegend(g: G, items: { label: string; color: string }[], width: number, height: number) {
  const chars = Math.max(4, Math.floor((width - 18) / 6.2));
  const rowsFit = Math.max(1, Math.floor(height / LEGEND_ROW));
  const shown = items.length > rowsFit ? items.slice(0, rowsFit - 1) : items;
  shown.forEach((it, i) => {
    const row = g.append('g').attr('transform', `translate(0,${i * LEGEND_ROW})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('fill', it.color);
    row.append('text').attr('x', 18).attr('y', 10).attr('font-size', 11).attr('fill', 'currentColor').text(truncate(it.label, chars));
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
  svg: Svg, rows: ContaminantRow[], sites: SiteRef[], W: number, H: number, hv: HoverApi
): Drawn | null {
  if (rows.length === 0) return null;
  const legendW = Math.min(150, Math.round(W * 0.35));
  const M = { top: 10 + BAR_DEPTH, right: legendW + 15, bottom: 62, left: 56 };
  const innerW = Math.max(20, W - M.left - M.right);
  const innerH = Math.max(40, H - M.top - M.bottom);
  const ids = sites.map((s) => s.id);

  const x = d3.scaleBand<string>().domain(rows.map((r) => r.name)).range([0, innerW]).padding(0.2);
  const dep = Math.min(BAR_DEPTH, x.bandwidth() * 0.3);
  const barW = x.bandwidth() - dep;
  const series = d3.stack<ContaminantRow>().keys(ids).value((d, k) => d.bySite[k] ?? 0)(rows);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.total) ?? 1]).nice().range([innerH, 0]);
  const color = palette(ids);

  const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
  const barsG = g.append('g');
  const overlay = g.append('g').style('pointer-events', 'none');
  const targets = new Map<string, Target>();
  const columns = new Map<string, Element[]>();

  series.forEach((s) => {
    const fill = color(s.key);
    const segTarget = (d: d3.SeriesPoint<ContaminantRow>): TipTarget =>
      ({ kind: 'site', siteId: s.key, contaminant: d.data.name });

    barsG
      .append('g')
      .selectAll<SVGGElement, d3.SeriesPoint<ContaminantRow>>('g')
      .data(s.filter((d) => d[1] > d[0]))
      .join('g')
      .attr('class', styles.seg)
      .each(function (d) {
        const grp = d3.select(this);
        const x0 = x(d.data.name)!;
        const yT = y(d[1]);
        const yB = y(d[0]);
        grp.append('rect').attr('x', x0).attr('y', yT).attr('width', barW).attr('height', yB - yT).attr('fill', fill);
        grp.append('path').attr('d', `M${x0 + barW},${yT} l${dep},${-dep} V${yB - dep} L${x0 + barW},${yB} Z`).attr('fill', shade(fill));
        if (Math.abs(d[1] - d.data.total) < 1e-6) {
          grp.append('path').attr('d', `M${x0},${yT} l${dep},${-dep} h${barW} l${-dep},${dep} Z`).attr('fill', tint(fill));
        }
        targets.set(keyOf(segTarget(d)), { els: [this], dx: 0, dy: -LIFT });
        const col = columns.get(d.data.name) ?? [];
        col.push(this);
        columns.set(d.data.name, col);
      })
      .on('mouseenter', (ev: MouseEvent, d) => hv.enter(segTarget(d), ev))
      .on('mousemove', (ev: MouseEvent) => hv.move(ev))
      .on('mouseleave', () => hv.leave())
      .on('click', (_: MouseEvent, d) => hv.click(segTarget(d)));
  });

  // a whole column is its own target (the contaminant), reached from the strip under the bar
  for (const [name, els] of columns) targets.set(keyOf({ kind: 'contaminant', name }), { els, dx: 0, dy: -LIFT });

  const every = Math.max(1, Math.ceil(19 / x.step()));
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3.axisBottom(x)
        .tickValues(rows.map((r) => r.name).filter((_, i) => i % every === 0))
        .tickFormat((n) => truncate(n, 12))
    )
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end');

  g.append('g')
    .selectAll('rect')
    .data(rows)
    .join('rect')
    .attr('x', (r) => x(r.name)!)
    .attr('y', innerH)
    .attr('width', x.bandwidth())
    .attr('height', Math.min(M.bottom - 4, 28))
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .on('mouseenter', (ev: MouseEvent, r: ContaminantRow) => hv.enter({ kind: 'contaminant', name: r.name }, ev))
    .on('mousemove', (ev: MouseEvent) => hv.move(ev))
    .on('mouseleave', () => hv.leave())
    .on('click', (_: MouseEvent, r: ContaminantRow) => hv.click({ kind: 'contaminant', name: r.name }));

  g.append('g').call(d3.axisLeft(y).ticks(Math.max(2, Math.floor(innerH / 30))).tickFormat(d3.format('~s')));

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
    innerH
  );

  return { overlay, targets };
}


function drawPie(svg: Svg, data: Slice[], W: number, H: number, hv: HoverApi): Drawn | null {
  const slices = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (slices.length === 0) return null;
  const total = d3.sum(slices, (d) => d.value);
  const legendW = Math.min(170, Math.round(W * 0.4));
  const pad = EXPLODE + 4;
  const r = Math.max(20, Math.min((W - legendW - 25) / 2 - pad, (H - PIE_DEPTH) / 2 - pad));
  const color = palette(slices.map((s) => s.label));
  const arc = d3.arc<d3.PieArcDatum<Slice>>().innerRadius(0).outerRadius(r);
  const arcs = d3.pie<Slice>().value((d) => d.value).sort(null)(slices);

  const pieG = svg.append('g').attr('transform', `translate(${r + pad},${r + pad})`);

  // side wall: 1px steps and no stroke, so it is exactly PIE_DEPTH tall and exactly as wide as the face
  const depthEls: SVGGElement[] = [];
  const depthG = pieG.append('g').style('pointer-events', 'none');
  arcs.forEach((a) => {
    const c = shade(color(a.data.label));
    const grp = depthG.append('g').attr('class', styles.seg);
    for (let k = PIE_DEPTH; k >= 1; k--) {
      grp.append('path').attr('d', arc(a)).attr('transform', `translate(0,${k})`).attr('fill', c).attr('stroke', 'none');
    }
    depthEls.push(grp.node()!);
  });

  const faceG = pieG.append('g');
  const overlay = pieG.append('g').style('pointer-events', 'none');
  const targets = new Map<string, Target>();

  const targetOf = (s: Slice): TipTarget | null =>
    s.id ? { kind: 'site', siteId: s.id }
    : s.sites ? { kind: 'medium', label: s.label, sites: s.sites }
    : null;

  faceG
    .selectAll<SVGPathElement, d3.PieArcDatum<Slice>>('path')
    .data(arcs)
    .join('path')
    .attr('class', styles.seg)
    .attr('d', (a) => arc(a))
    .attr('fill', (a) => color(a.data.label))
    .style('stroke', 'var(--chart-slice-stroke)')
    .each(function (a, i) {
      const t = targetOf(a.data);
      if (!t) return;
      const [cx, cy] = arc.centroid(a);
      const len = Math.hypot(cx, cy) || 1;
      targets.set(keyOf(t), { els: [depthEls[i], this], dx: (cx / len) * EXPLODE, dy: (cy / len) * EXPLODE });
    })
    .on('mouseenter', (ev: MouseEvent, a) => { const t = targetOf(a.data); if (t) hv.enter(t, ev); })
    .on('mousemove', (ev: MouseEvent) => hv.move(ev))
    .on('mouseleave', () => hv.leave())
    .on('click', (_: MouseEvent, a) => { const t = targetOf(a.data); if (t) hv.click(t); });

  const legendX = 2 * (r + pad) + 20;
  drawLegend(
    svg.append('g').attr('transform', `translate(${legendX},10)`),
    slices.map((s) => ({ label: `${s.label} (${d3.format('.0%')(s.value / total)})`, color: color(s.label) })),
    Math.max(60, W - legendX),
    H - 20
  );

  return { overlay, targets };
}

// area of each medium for one contaminant, across the selected sites that have it
function contaminantMediaSlices(sites: SiteData[], name: string): Slice[] {
  const area = new Map<string, number>();
  for (const site of sites) {
    const c = site.getContaminants().find((x) => x.name === name);
    if (!c) continue;
    const media = c.media.length ? c.media : ['Unspecified'];
    const share = siteArea(site) / media.length;
    for (const m of media) area.set(m, (area.get(m) ?? 0) + share);
  }
  return [...area].map(([label, value]) => ({ label, value }));
}

function TipRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.contentrow}>
      <span className={styles.contentlabel}>{label}</span>
      <span className={styles.contentdata}>{value}</span>
    </div>
  );
}

function MiniPie({ data }: { data: Slice[] }) {
  const slices = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (slices.length === 0) return <div className={styles.muted}>No medium data.</div>;
  const total = d3.sum(slices, (d) => d.value);
  const r = 46;
  const color = palette(slices.map((s) => s.label));
  const arc = d3.arc<d3.PieArcDatum<Slice>>().innerRadius(0).outerRadius(r);
  const arcs = d3.pie<Slice>().value((d) => d.value).sort(null)(slices);
  return (
    <div className={styles.miniPie}>
      <svg width={r * 2} height={r * 2} viewBox={`${-r} ${-r} ${r * 2} ${r * 2}`}>
        {arcs.map((a) => (
          <path key={a.data.label} d={arc(a) ?? undefined} fill={color(a.data.label)} style={{ stroke: 'var(--chart-slice-stroke)' }} />
        ))}
      </svg>
      <ul>
        {slices.slice(0, 6).map((s) => (
          <li key={s.label}>
            <span className={styles.miniPieSwatch} style={{ background: color(s.label) }} />
            {truncate(s.label, 18)} {d3.format('.0%')(s.value / total)}
          </li>
        ))}
        {slices.length > 6 && <li>+{slices.length - 6} more</li>}
      </ul>
    </div>
  );
}

export function SitesStatistics({ selectedSites, compareMode, onSiteClick, pinsActive, outlinedAcres }: StatsInfo) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tab, setTab] = useState<Tab>('contaminants');
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [bucketSize, setBucketSize] = useState(1);
const [bucketUnit, setBucketUnit] = useState<Unit>('years');
const geomRef = useRef(new Map<string, Geom>()); // last histogram segment geometry, for the transitions
  const mouse = useRef({ x: 0, y: 0 });
const [pinned, setPinned] = useState<TipTarget[]>([]); // at most MAX_PINNED, oldest first
const [hover, setHover] = useState<TipTarget | null>(null);
const pinnedRef = useRef(pinned); pinnedRef.current = pinned;
const hoverRef = useRef(hover); hoverRef.current = hover;
const onSiteClickRef = useRef(onSiteClick); onSiteClickRef.current = onSiteClick;
const chartRef = useRef<(Drawn & { svg: Svg }) | null>(null);
const tipEls = useRef(new Map<string, HTMLDivElement>());
const lineEls = useRef(new Map<string, SVGLineElement>());
const dotEls = useRef(new Map<string, SVGCircleElement>());

// screen position of a chart shape (centre of its bounding box), or null if it no longer exists
const anchorOf = (key: string) => {
  const t = chartRef.current?.targets.get(key);
  if (!t) return null;
  let l = Infinity, tp = Infinity, r = -Infinity, b = -Infinity;
  for (const el of t.els) {
    const rc = el.getBoundingClientRect();
    l = Math.min(l, rc.left); tp = Math.min(tp, rc.top); r = Math.max(r, rc.right); b = Math.max(b, rc.bottom);
  }
  return Number.isFinite(l) ? { x: (l + r) / 2, y: (tp + b) / 2 } : null;
};

// clones the pinned + hovered shapes onto the top layer and dims everything else
const applyHighlight = () => {
  const c = chartRef.current;
  if (!c) return;
  c.overlay.selectAll('*').remove();
  const keys = pinnedRef.current.map(keyOf);
  if (hoverRef.current) keys.push(keyOf(hoverRef.current));
  c.svg.classed(styles.chartFocus, keys.length > 0);
  for (const k of keys) {
    const t = c.targets.get(k);
    if (!t) continue;
    for (const el of t.els) {
      c.overlay
        .append(() => el.cloneNode(true) as SVGElement)
        .classed(styles.spot, true)
        .style('transform', `translate(${t.dx}px, ${t.dy}px)`);
    }
  }
};

// Places every visible tooltip: pinned ones first (stable), then the hover one around the cursor.
// Each tooltip tries 8 spots around its anchor and takes the one that is fully on screen and
// overlaps the already-placed tooltips the least. Connector lines are updated here too.
const layoutTips = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vp = viewport?.getBoundingClientRect();
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const order = [
    ...pinnedRef.current.map((t) => ({ key: keyOf(t), a: anchorOf(keyOf(t)), line: true })),
    ...(hoverRef.current ? [{ key: 'hover', a: { ...mouse.current } as { x: number; y: number } | null, line: false }] : []),
  ];

  for (const o of order) {
    const el = tipEls.current.get(o.key);
    const ln = lineEls.current.get(o.key);
    const dot = dotEls.current.get(o.key);
    if (!el) continue;
    const a = o.a;
    const visible =
      !!a && a.x > 0 && a.x < vw && a.y > 0 && a.y < vh &&
      (!o.line || !vp || (a.x >= vp.left && a.x <= vp.right && a.y >= vp.top && a.y <= vp.bottom));
    el.style.visibility = visible ? 'visible' : 'hidden';
    if (ln) ln.style.display = visible ? '' : 'none';
    if (dot) dot.style.display = visible ? '' : 'none';
    if (!visible || !a) continue;

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const G = TIP_GAP;
    const cands: [number, number][] = [
      [a.x + G, a.y + G], [a.x - w - G, a.y + G], [a.x + G, a.y - h - G], [a.x - w - G, a.y - h - G],
      [a.x + G, a.y - h / 2], [a.x - w - G, a.y - h / 2], [a.x - w / 2, a.y + G], [a.x - w / 2, a.y - h - G],
    ];
    let best = { x: 0, y: 0 };
    let bestScore = Infinity;
    for (const [cx, cy] of cands) {
      const x = clamp(cx, TIP_MARGIN, vw - w - TIP_MARGIN);
      const y = clamp(cy, TIP_MARGIN, vh - h - TIP_MARGIN);
      let score = Math.abs(x - cx) + Math.abs(y - cy);
      for (const p of placed) {
        score += 10 * overlapArea(
          { x, y, w, h },
          { x: p.x - TIP_MARGIN, y: p.y - TIP_MARGIN, w: p.w + 2 * TIP_MARGIN, h: p.h + 2 * TIP_MARGIN }
        );
      }
      if (score < bestScore) { bestScore = score; best = { x, y }; }
    }
    el.style.left = `${best.x}px`;
    el.style.top = `${best.y}px`;
    placed.push({ x: best.x, y: best.y, w, h });

    if (o.line && ln && dot) {
      ln.setAttribute('x1', String(clamp(a.x, best.x, best.x + w)));
      ln.setAttribute('y1', String(clamp(a.y, best.y, best.y + h)));
      ln.setAttribute('x2', String(a.x));
      ln.setAttribute('y2', String(a.y));
      dot.setAttribute('cx', String(a.x));
      dot.setAttribute('cy', String(a.y));
    }
  }
};

// refs only, so the chart's d3 handlers can hold a stable object
const hvImpl: HoverApi = {
  enter: (t, e) => {
    mouse.current = { x: e.clientX, y: e.clientY };
    const k = keyOf(t);
    // already pinned, or two are pinned: no extra tooltip
    if (pinnedRef.current.length >= MAX_PINNED || pinnedRef.current.some((p) => keyOf(p) === k)) return;
    setHover(t);
  },
  move: (e) => { mouse.current = { x: e.clientX, y: e.clientY }; layoutTips(); },
  leave: () => setHover(null),
  click: (t) => {
    const k = keyOf(t);
    const has = pinnedRef.current.some((p) => keyOf(p) === k);
    setPinned((p) => (has ? p.filter((x) => keyOf(x) !== k) : [...p, t].slice(-MAX_PINNED)));
    setHover(has ? t : null); // unpinning while still over it shows it as a normal hover
    if (!has && t.kind === 'site') onSiteClickRef.current(t.siteId); // still zooms the map to the site
  },
};
const hvRef = useRef(hvImpl); hvRef.current = hvImpl;
const hvProxy = useRef<HoverApi>({
  enter: (t, e) => hvRef.current.enter(t, e),
  move: (e) => hvRef.current.move(e),
  leave: () => hvRef.current.leave(),
  click: (t) => hvRef.current.click(t),
}).current;

useLayoutEffect(() => { applyHighlight(); layoutTips(); }); // every render: sizes and data can change

// pinned tooltips follow their shapes while the panel slides, the chart scrolls or the window resizes
useEffect(() => {
  if (pinned.length === 0) return;
  let raf = requestAnimationFrame(function loop() { layoutTips(); raf = requestAnimationFrame(loop); });
  return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pinned.length, viewport]);

useEffect(() => { setPinned([]); setHover(null); }, [tab, compareMode]);
  // measure the chart area; callback ref because the panel isn't mounted outside compare mode
  useEffect(() => {
    if (!viewport) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) })
    );
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [viewport]);

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
  const siteSlices: Slice[] = sites.map((s) => ({ id: s.siteProperties.EPA_ID, label: s.siteProperties.SITE_NAME, value: siteArea(s) }));

  // tab 3: each site's area is split equally across its (contaminant, medium) pairs
  const mediaArea = new Map<string, Map<string, number>>(); // medium -> site name -> area share
  for (const site of sites) {
    const media = site.getContaminants().flatMap((c) => (c.media.length ? c.media : ['Unspecified']));
    if (media.length === 0) continue;
    const share = siteArea(site) / media.length;
    const name = site.siteProperties.SITE_NAME;
    for (const m of media) {
      const per = mediaArea.get(m) ?? new Map<string, number>();
      per.set(name, (per.get(name) ?? 0) + share);
      mediaArea.set(m, per);
    }
  }
  const mediaSlices: Slice[] = [...mediaArea].map(([label, per]) => ({
    label,
    value: d3.sum(per.values()),
    sites: [...per].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  }));
  const histBuckets = makeBuckets(sites, bucketSize, bucketUnit);

  const hasData =
  tab === 'contaminants' ? contaminantRows.length > 0
  : tab === 'areas' ? siteSlices.some((s) => s.value > 0)
  : tab === 'timeline' ? histBuckets.length > 0
  : mediaSlices.some((s) => s.value > 0);

  // at zoom 1 the chart is exactly the viewport height, so nothing scrolls
  const chartH = size.h * zoom;
  const ready = size.w > 40 && size.h > 40;
  const signature = JSON.stringify({ tab, siteRefs, contaminantRows, siteSlices, mediaSlices, histBuckets, size, zoom });

  useEffect(() => {
  if (!svgRef.current || !ready) {
    chartRef.current = null;
    geomRef.current = new Map();
    setPinned((p) => (p.length ? [] : p));
    return;
  }
  const svg = d3.select(svgRef.current);
  svg.selectAll('*').interrupt().remove();
  svg.classed(styles.chartFocus, false);
  const drawn =
    tab === 'contaminants'
      ? drawBars(svg, contaminantRows, siteRefs, size.w, chartH, hvProxy)
      : tab === 'timeline'
      ? drawHistogram(svg, histBuckets, siteRefs, size.w, chartH, hvProxy, geomRef.current)
      : drawPie(svg, tab === 'areas' ? siteSlices : mediaSlices, size.w, chartH, hvProxy);
  geomRef.current = drawn?.geom ?? new Map(); // leaving the timeline tab resets it, so it grows in fresh
  chartRef.current = drawn ? { ...drawn, svg } : null;
  const alive = (t: TipTarget) => !!drawn?.targets.has(keyOf(t));
  setHover(null);
  setPinned((p) => (p.every(alive) ? p : p.filter(alive)));
  applyHighlight();
  layoutTips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [signature]);

  if (!compareMode) return null;

  const totalAcres = sites.reduce((sum, s) => sum + siteArea(s), 0);
  const uniqueContaminants = new Set(sites.flatMap((s) => s.getContaminants().map((c) => c.name))).size;
  const finalNpl = sites.filter((s) => s.siteProperties.NPL_STATUS === 'F').length;

  const tipBody = (tip: TipTarget): ReactNode => {
  if (tip.kind === 'site') {
    const site = selectedSites.get(tip.siteId);
    if (!site) return null;
    const p = site.siteProperties;
    const cons = site.siteContaminantList === undefined ? null : site.getContaminants();
    const hit = tip.contaminant ? cons?.find((c) => c.name === tip.contaminant) : undefined;
    return (
      <>
        <div className={styles.tipTitle}>{p.SITE_NAME}</div>
        <div className={styles.contentbox}>
          <div className={styles.contentboxvalue}>
            <TipRow label="Status" value={NPL_STATUS_LABELS[p.NPL_STATUS] ?? p.NPL_STATUS} />
            <TipRow label="Location" value={`${p.CITY_NAME}, ${p.STATE_CODE}`} />
            <TipRow label="Area" value={`${fmt(siteArea(site))} acres`} />
            <TipRow label="Updated" value={typeof p.LAST_CHANG === 'number' ? fmtDate(new Date(p.LAST_CHANG)) : '—'} />
            {/*<TipRow label="Contaminants" value={cons ? cons.length : '—'} />*/}
            {tip.contaminant && <TipRow label="Contaminant" value={tip.contaminant} />}
            {tip.contaminant && <TipRow label="Media" value={hit?.media.join(', ') || '—'} />}
          </div>
        </div>
      </>
    );
  }
  if (tip.kind === 'contaminant') {
    return (
      <>
        <div className={styles.tipTitle}>{tip.name}</div>
        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>Area by medium</div>
          <div className={styles.contentboxvalue}>
            <MiniPie data={contaminantMediaSlices(sites, tip.name)} />
          </div>
        </div>
      </>
    );
  }
  if (tip.kind === 'bucket') {
  return (
    <>
      <div className={styles.tipTitle}>{tip.label}</div>
      <div className={styles.contentbox}>
        <div className={styles.contentboxname}>Sites ({tip.sites.length})</div>
        <div className={styles.contentboxvalue}>
          {tip.sites.slice(0, 6).map((s) => (
            <TipRow key={s.name} label={truncate(s.name, 22)} value={fmtDate(new Date(s.date))} />
          ))}
          {tip.sites.length > 6 && <div className={styles.muted}>+{tip.sites.length - 6} more</div>}
        </div>
      </div>
    </>
  );
}
  return (
    <>
      <div className={styles.tipTitle}>{tip.label}</div>
      <div className={styles.contentbox}>
        <div className={styles.contentboxname}>Contributing sites</div>
        <div className={styles.contentboxvalue}>
          {tip.sites.slice(0, 6).map((s) => (
            <TipRow key={s.name} label={truncate(s.name, 22)} value={`${fmt(s.value)} acres`} />
          ))}
          {tip.sites.length > 6 && <div className={styles.muted}>+{tip.sites.length - 6} more</div>}
        </div>
      </div>
    </>
  );
};

const renderTips = () => {
  const shown = [
    ...pinned.map((t) => ({ key: keyOf(t), t, isPinned: true })),
    ...(hover ? [{ key: 'hover', t: hover, isPinned: false }] : []),
  ]
    .map((s) => ({ ...s, body: tipBody(s.t) }))
    .filter((s) => s.body);
  if (shown.length === 0) return null;

  return createPortal(
    <>
      <svg className={styles.tipLines}>
        {shown.filter((s) => s.isPinned).map((s) => (
          <g key={s.key}>
            <line
              className={styles.tipLine}
              ref={(el) => { if (el) lineEls.current.set(s.key, el); else lineEls.current.delete(s.key); }}
            />
            <circle
              className={styles.tipDot}
              r={4}
              ref={(el) => { if (el) dotEls.current.set(s.key, el); else dotEls.current.delete(s.key); }}
            />
          </g>
        ))}
      </svg>
      {shown.map((s) => (
        <div
          key={s.key}
          ref={(el) => { if (el) tipEls.current.set(s.key, el); else tipEls.current.delete(s.key); }}
          className={`${styles.chartTip} ${styles.nicebox} ${s.isPinned ? styles.chartTipPinned : ''}`}
          onClick={s.isPinned ? () => setPinned((p) => p.filter((x) => keyOf(x) !== s.key)) : undefined}
        >
          {s.isPinned && <span className={styles.tipClose}>×</span>}
          {s.body}
        </div>
      ))}
    </>,
    document.body
  );
};

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
{tab === 'timeline' && (
  <div className={styles.zoomControls}>
    <span className={styles.zoomLevel}>Bucket</span>
    <button type="button" className={styles.zoomButton} aria-label="Smaller buckets"
      onClick={() => setBucketSize((s) => Math.max(1, s - 1))} disabled={bucketSize <= 1}>−</button>
    <span className={styles.zoomLevel}>{bucketSize}</span>
    <button type="button" className={styles.zoomButton} aria-label="Larger buckets"
      onClick={() => setBucketSize((s) => Math.min(BUCKET_MAX, s + 1))} disabled={bucketSize >= BUCKET_MAX}>+</button>
    <button type="button" className={`${styles.zoomButton} ${styles.unitButton}`}
      onClick={() => setBucketUnit((u) => (u === 'years' ? 'months' : 'years'))}>{bucketUnit}</button>
  </div>
)}
        <div className={`${styles.contentbox} ${styles.contentboxhorizontal}`}>
          <div className={styles.contentboxname}>Summary</div>
          <div className={styles.contentboxvalue}>
            <span className={styles.contentinline}><span className={styles.contentlabel}>Sites:</span> {sites.length}</span>
            <span className={styles.contentinline}><span className={styles.contentlabel}>Final NPL:</span> {finalNpl}</span>
            <span className={styles.contentinline}><span className={styles.contentlabel}>Area:</span> {totalAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres</span>
            <span className={styles.contentinline}><span className={styles.contentlabel}>Contaminants:</span> {uniqueContaminants}</span>
            {pinsActive && (
              <span className={styles.contentinline}>
                <span className={styles.contentlabel}>Outlined Area:</span>{' '}
                {outlinedAcres == null ? '-' : `${outlinedAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`${styles.boxScroll} ${styles.boxFill}`}>
        <div className={`${styles.contentbox} ${styles.contentboxfill}`}>
          <div className={styles.contentboxname}>{TAB_TITLES[tab]}</div>
          <div ref={setViewport} className={`${styles.contentboxvalue} ${styles.chartViewport}`}>
            {sites.length === 0 && (
              <div className={styles.muted}>Click polygons on the map to add sites to the comparison.</div>
            )}
            {sites.length > 0 && !hasData && (
              <div className={styles.muted}>No data for the selected sites (yet).</div>
            )}
            {hasData && (
              <svg ref={svgRef} className={styles.chartSvg} width={size.w} height={chartH} style={{ color: 'var(--jet-black)' }} />
            )}
          </div>
        </div>
      </div>

      {renderTips()}
    </SlidePanel>
  );
}