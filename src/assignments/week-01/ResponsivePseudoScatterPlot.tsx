import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { useDimensions } from './useDimensions';
import { axisBottom, axisLeft } from 'd3-axis';
//import { max } from 'd3';

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
const PADDING = 50;
const AXIS_STROKE = '4px';

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

    // <g> (group) elements for each data point
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

    //const maxX = max(data, (d) => d.x);
    //const maxY = max(data, (d) => d.y);
    //const indexTickValues = data.map((_, index) => index);

    const xAxis = axisBottom(xScale).ticks(data.length).tickSizeOuter(0).tickSizeInner(-10);

    const xAxiselem = svgSelection
      .select<SVGGElement>('.x-axis')
      .attr('transform', `translate(0, ${dimensions.height - PADDING})`)
      .call(xAxis);

    xAxiselem.selectAll('text').style('font-size', '18px').style('color', '#3848dd');

    xAxiselem.selectAll('line').style('stroke-width', AXIS_STROKE).style('color', '#121234');

    xAxiselem.selectAll('.domain').style('stroke-width', AXIS_STROKE).style('color', '#121234');

    const yAxis = axisLeft(yScale)
      .ticks(10)
      .tickSizeOuter(0)
      .tickSizeInner(-(dimensions.width - 2 * PADDING));

    const yAxiselem = svgSelection
      .select<SVGGElement>('.y-axis')
      .attr('transform', `translate(${PADDING}, 0)`)
      .call(yAxis);

    yAxiselem.selectAll('text').style('font-size', '18px').style('color', '#3848dd');

    yAxiselem
      .selectAll('line')
      .style('stroke-width', AXIS_STROKE)
      .style('color', '#121234')
      .style('opacity', '0.5');

    yAxiselem.selectAll('.domain').style('stroke-width', AXIS_STROKE).style('color', '#121234');

    // Error Bars
    points
      .select<SVGLineElement>('.stem-line')
      .attr('x1', (d) => xScale(d.x))
      .attr('y1', (d) => yScale(d.y - d.error)) // Baseline / X-axis position
      .attr('x2', (d) => xScale(d.x))
      .attr('y2', (d) => yScale(d.y + d.error))
      .attr('stroke', '#ff0000')
      .attr('stroke-width', 2);

    // Points
    points
      .select<SVGCircleElement>('circle')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y));

    xAxiselem.raise();

    //yAxiselem.raise();
  }, [dimensions]);

  return (
    <div ref={divRef} className="relative w-full h-full rounded-lg shadow-sm">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        role="img"
        aria-label="Responsive scatter plot showing 6 data points"
      >
        <defs>
          {/* Background */}
          <radialGradient id="bgGradient" cx="50%" cy="50%" r="60%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#000268" />
            <stop offset="80%" stopColor="#000268" />
            <stop offset="100%" stopColor="#000012" />
          </radialGradient>
          <filter id="glow-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ff11aa" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Background */}
        <rect width="100%" height="100%" fill="url(#bgGradient)" />

        <g className="x-axis" color="#ffffff" />
        <g className="y-axis" color="#ffffff" />
      </svg>
    </div>
  );
}
