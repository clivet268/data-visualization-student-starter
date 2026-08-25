import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { useDimensions } from './useDimensions';

interface DataPoint {
  x: number;
  y: number;
  error: number;
}

const data: DataPoint[] = [
  { x: 132, y: 391, error: 5.5 },
  { x: 330, y: 349, error: 13.5 },
  { x: 410, y: 192, error: 20.5 },
  { x: 527, y: 257, error: 10.1 },
  { x: 688, y: 119, error: 14.5 },
  { x: 878, y: 55, error: 11.5 },
];

const ORIGINAL_WIDTH = 960;
const ORIGINAL_HEIGHT = 500;
const RADIUS = 10;

export function ResponsivePseudoScatterPlot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: divRef, dimensions } = useDimensions();

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || dimensions.width === 0 || dimensions.height === 0) return;

    const xScale = scaleLinear()
      .domain([0, ORIGINAL_WIDTH])
      .range([50, dimensions.width - 50]);

    const yScale = scaleLinear()
      .domain([0, ORIGINAL_HEIGHT])
      .range([dimensions.height - 50, 50]);

    const svgSelection = select(svg);

    // 1. Bind data to <g> (group) elements representing each data point
    const points = svgSelection
      .selectAll<SVGGElement, DataPoint>('.data-point')
      .data(data)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', 'data-point')
            .attr('filter', 'url(#glow-shadow)');

          // Append line inside the new group
          g.append('line').attr('class', 'stem-line');

          // Append circle inside the new group
          g.append('circle').attr('r', RADIUS).attr('fill', '#ff11aa');

          return g;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    // 2. Update positions for both lines and circles
    // Line: from the bottom baseline (dimensions.height - 50) up to the data point's Y position
    points
      .select<SVGLineElement>('.stem-line')
      .attr('x1', (d) => xScale(d.x))
      .attr('y1', (d) => yScale(d.y - RADIUS * d.error)) // Baseline / X-axis position
      .attr('x2', (d) => xScale(d.x))
      .attr('y2', (d) => yScale(d.y + RADIUS * d.error))
      .attr('stroke', '#ff0000')
      .attr('stroke-width', 2);

    // Circle: positioned at the data point coordinates
    points
      .select<SVGCircleElement>('circle')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y));
  }, [dimensions]);

  return (
    <div ref={divRef} className="relative w-full h-full bg-gradient-to-br from-[#000268] via-indigo-950 to-[#00022] border border-[#000268] rounded-lg shadow-sm relative">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        role="img"
        aria-label="Responsive scatter plot showing 6 data points"
      >
        <defs>
          <filter id="glow-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="6"
              flood-color="#ff11aa"
              flood-opacity="0.8"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
