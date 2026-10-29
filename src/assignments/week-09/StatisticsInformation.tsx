import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import styles from './spillover.module.css';
import type { SiteData } from './Polygons';

interface StatsInfo {
  selectedSites: Map<string, SiteData>;
  compareMode: boolean;
}

type Contaminant = SiteData['siteContaminantList'][number];
interface SiteRow {
  id: string;
  label: string;
  counts: Record<string, number>;
}

// what the bars are sliced by. Swap to c.preferred_contaminant_name for per-contaminant slices.
const stackKey = (c: Contaminant): string => c.media_name ?? 'Unspecified';

const W = 600;
const H = 280;
const M = { top: 10, right: 130, bottom: 70, left: 40 };
const truncate = (s: string, n = 14) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function SitesStatistics({ selectedSites, compareMode }: StatsInfo) {
  const svgRef = useRef<SVGSVGElement>(null);

  // built every render on purpose: contaminants are mutated into SiteData in place
  const sites = [...selectedSites.values()];
  const keySet = new Set<string>();
  const rows: SiteRow[] = sites.map((site) => {
    const seen = new Set<string>();
    const counts: Record<string, number> = {};
    for (const c of site.siteContaminantList) {
      if (!c.preferred_contaminant_name) continue;
      const key = stackKey(c);
      const dedupe = `${c.preferred_contaminant_name}|${key}`;
      if (seen.has(dedupe)) continue; // same contaminant repeated per operable unit/action
      seen.add(dedupe);
      keySet.add(key);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return { id: site.siteProperties.EPA_ID, label: site.siteProperties.SITE_NAME, counts };
  });
  const keys = [...keySet].sort();
  const signature = JSON.stringify({ rows, keys });

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (rows.length === 0 || keys.length === 0) return;

    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;

    const x = d3
      .scaleBand<string>()
      .domain(rows.map((r) => r.id))
      .range([0, innerW])
      .padding(0.25);
    const series = d3
      .stack<SiteRow>()
      .keys(keys)
      .value((d, k) => d.counts[k] ?? 0)(rows);
    const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);
    const color = d3.scaleOrdinal<string, string>().domain(keys).range(d3.schemeTableau10);
    const labels = new Map(rows.map((r) => [r.id, r.label]));

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    series.forEach((s) => {
      g.append('g')
        .attr('fill', color(s.key))
        .selectAll('rect')
        .data(s)
        .join('rect')
        .attr('x', (d) => x(d.data.id)!)
        .attr('y', (d) => y(d[1]))
        .attr('height', (d) => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth())
        .append('title')
        .text((d) => `${d.data.label}\n${s.key}: ${d[1] - d[0]}`);
    });

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((id) => truncate(labels.get(id) ?? id)))
      .selectAll('text')
      .attr('transform', 'rotate(-30)')
      .style('text-anchor', 'end');

    g.append('g').call(d3.axisLeft(y).ticks(Math.min(yMax, 6)).tickFormat(d3.format('d')));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -30)
      .attr('text-anchor', 'middle')
      .attr('fill', 'currentColor')
      .attr('font-size', 11)
      .text('Contaminants');

    const legend = g.append('g').attr('transform', `translate(${innerW + 15},0)`);
    keys.forEach((k, i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 18})`);
      row.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(k));
      row
        .append('text')
        .attr('x', 18)
        .attr('y', 10)
        .attr('font-size', 11)
        .attr('fill', 'currentColor')
        .text(truncate(k, 16));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!compareMode) return null;

  const totalAcres = sites.reduce(
    (sum, s) => sum + (s.siteProperties.GIS_AREA_U === 'Acres' ? s.siteProperties.GIS_AREA : 0),
    0,
  );
  const uniqueContaminants = new Set(
    sites.flatMap((s) =>
      s.siteContaminantList.map((c) => c.preferred_contaminant_name).filter(Boolean),
    ),
  ).size;
  const finalNpl = sites.filter((s) => s.siteProperties.NPL_STATUS === 'F').length;

  return (
    <div
      className={`${styles.panel} ${styles.statsPanel} ${styles.spilloverlay} ${styles.nicebox}`}
    >
      <div className={styles.boxTitle}>Compare Sites</div>
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
              <span className={styles.contentdata}>
                {totalAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres
              </span>
            </div>
            <div className={styles.contentrow}>
              <span className={styles.contentlabel}>Unique contaminants</span>
              <span className={styles.contentdata}>{uniqueContaminants}</span>
            </div>
          </div>
        </div>

        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>Contaminants by site and medium</div>
          <div className={styles.contentboxvalue}>
            {sites.length === 0 && (
              <div className={styles.muted}>
                Click polygons on the map to add sites to the comparison.
              </div>
            )}
            {sites.length > 0 && keys.length === 0 && (
              <div className={styles.muted}>No contaminant data for the selected sites (yet).</div>
            )}
            {keys.length > 0 && (
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
