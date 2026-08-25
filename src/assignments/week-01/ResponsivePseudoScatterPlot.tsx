import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { useDimensions } from './useDimensions';

interface DataPoint {
  x: number;
  y: number;
}

const data: DataPoint[] = [
  { x: 132, y: 391 },
  { x: 330, y: 349 },
  { x: 410, y: 192 },
  { x: 527, y: 257 },
  { x: 688, y: 119 },
  { x: 878, y: 55 },
];

const ORIGINAL_WIDTH = 960;
const ORIGINAL_HEIGHT = 500;
const RADIUS = 34;

export function ResponsivePseudoScatterPlot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: divRef, dimensions } = useDimensions();

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || dimensions.width === 0 || dimensions.height === 0) return;

    // Use viewBox scaling or explicit scales mapped to container dimensions
    const xScale = scaleLinear()
      .domain([0, ORIGINAL_WIDTH])
      .range([50, dimensions.width - 50]); // add some padding

    const yScale = scaleLinear()
      .domain([0, ORIGINAL_HEIGHT])
      .range([dimensions.height - 50, 50]); // Inverted for standard Cartesian Y-axis

    const selection = select(svg);

    selection
      .selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', (d: DataPoint) => xScale(d.x))
      .attr('cy', (d: DataPoint) => yScale(d.y))
      .attr('r', RADIUS)
      .attr('fill', '#4f46e5'); // Added color so they are visible!
  }, [dimensions])

  return (
    <div ref={divRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        role="img"
        aria-label="Responsive scatter plot showing 6 data points"
      ></svg>
    </div>
  );
}
