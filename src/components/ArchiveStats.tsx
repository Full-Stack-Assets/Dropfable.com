import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface ArchiveStatsProps {
  items: any[];
}

export function ArchiveStats({ items }: ArchiveStatsProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!items || items.length === 0 || !chartRef.current) {
      if (chartRef.current) chartRef.current.innerHTML = '';
      return;
    }

    // Calculate stats
    let totalWords = 0;
    const complexityCounts: Record<string, number> = { Beginner: 0, Advanced: 0, Expert: 0 };

    items.forEach(item => {
      const text = item.productContent || '';
      const words = text.split(/\s+/).filter((w: string) => w.length > 0).length;
      totalWords += words;

      let complexity = "Beginner";
      const sample = text.substring(0, 2000).toLowerCase();
      if (words > 1500 || sample.includes("expert") || sample.includes("advanced") || sample.includes("comprehensive")) {
        complexity = "Expert";
      } else if (words > 800 || sample.includes("intermediate") || sample.includes("detailed") || sample.includes("pro")) {
        complexity = "Advanced";
      }
      complexityCounts[complexity] = (complexityCounts[complexity] || 0) + 1;
    });

    const readingTime = Math.ceil(totalWords / 200);

    // D3 Chart
    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2;

    chartRef.current.innerHTML = '';

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const data = Object.entries(complexityCounts).map(([key, value]) => ({ key, value }));
    const color = d3.scaleOrdinal()
      .domain(['Beginner', 'Advanced', 'Expert'])
      .range(['#10b981', '#3b82f6', '#f59e0b']);

    const pie = d3.pie<any>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3.arc<any>()
      .innerRadius(radius * 0.5)
      .outerRadius(radius * 0.8);

    const arcs = svg.selectAll('arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d) => color(d.data.key) as string)
      .attr('stroke', 'white')
      .style('stroke-width', '2px')
      .style('opacity', 0.8)
      .on('mouseover', function() { d3.select(this).style('opacity', 1); })
      .on('mouseout', function() { d3.select(this).style('opacity', 0.8); });

    // Labels
    arcs.append('text')
      .attr('transform', (d) => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .text((d) => d.data.value > 0 ? d.data.key : '');

  }, [items]);

  if (!items || items.length === 0) return null;

  const words = items.reduce((acc, item) => acc + (item.productContent?.split(/\s+/).filter((w: string) => w.length > 0).length || 0), 0);
  const readingTime = Math.ceil(words / 200);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 mb-12 shadow-sm flex flex-col md:flex-row gap-8 items-center">
      <div className="flex-1">
        <h3 className="text-sm uppercase tracking-widest text-gray-400 font-semibold mb-6">Archive Statistics</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-3xl font-light text-gray-900">{items.length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Total Assets</p>
          </div>
          <div>
            <p className="text-3xl font-light text-gray-900">{words.toLocaleString()}</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Words Generated</p>
          </div>
          <div>
            <p className="text-3xl font-light text-gray-900">{readingTime} min</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Reading Time</p>
          </div>
        </div>
      </div>
      <div className="w-full md:w-1/2 flex flex-col items-center">
        <h4 className="text-xs text-gray-500 uppercase tracking-widest mb-4">Complexity Distribution</h4>
        <div ref={chartRef} className="w-full h-48 flex justify-center items-center"></div>
      </div>
    </div>
  );
}
