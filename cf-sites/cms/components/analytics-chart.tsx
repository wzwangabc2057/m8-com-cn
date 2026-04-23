'use client';

import { useMemo, useState } from 'react';

interface DataPoint {
  date: string;
  visits: number;
  views: number;
}

interface AnalyticsChartProps {
  data: DataPoint[];
  loading?: boolean;
}

export function AnalyticsChart({ data, loading }: AnalyticsChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    if (!data || !data.length) return 100;
    return Math.max(...data.map((d) => Math.max(Number(d.visits), Number(d.views)))) * 1.1 || 100;
  }, [data]);

  const points = useMemo(() => {
    if (!data || !data.length) return [];
    
    // SVG Dimensions
    const width = 1000;
    const height = 300;
    const paddingX = 40;
    const paddingY = 40;
    const graphWidth = width - paddingX * 2;
    const graphHeight = height - paddingY * 2;

    return data.map((point, i) => {
      const x = paddingX + (i / (data.length - 1 || 1)) * graphWidth;
      const visits = Number(point.visits) || 0;
      const views = Number(point.views) || 0;
      
      const yVisits = height - paddingY - (visits / maxVal) * graphHeight;
      const yViews = height - paddingY - (views / maxVal) * graphHeight;
      
      return { 
        x, 
        yVisits, 
        yViews, 
        visits, 
        views, 
        date: point.date,
        label: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
    });
  }, [data, maxVal]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <span className="text-gray-400">Loading analytics...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-gray-400">No data available</span>
      </div>
    );
  }

  // Construct Paths
  const visitsPath = points.map((p, i) => (i === 0 ? `M ${p.x},${p.yVisits}` : `L ${p.x},${p.yVisits}`)).join(' ');
  const viewsPath = points.map((p, i) => (i === 0 ? `M ${p.x},${p.yViews}` : `L ${p.x},${p.yViews}`)).join(' ');
  
  // Fill areas (optional, for aesthetics)
  const visitsFill = `${visitsPath} L ${points[points.length-1].x},${300-40} L ${points[0].x},${300-40} Z`;
  const viewsFill = `${viewsPath} L ${points[points.length-1].x},${300-40} L ${points[0].x},${300-40} Z`;

  return (
    <div className="w-full bg-white rounded-lg p-2">
      <div className="relative w-full aspect-[3/1] min-h-[250px]">
        <svg 
          className="w-full h-full overflow-visible" 
          viewBox="0 0 1000 300" 
          preserveAspectRatio="none"
        >
          {/* Grid Lines */}
          <line x1="40" y1="260" x2="960" y2="260" stroke="#e5e7eb" strokeWidth="1" />
          <line x1="40" y1="40" x2="960" y2="40" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="40" y1="150" x2="960" y2="150" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />

          {/* Area Fills (with gradient opacity) */}
          <path d={viewsFill} fill="rgba(191, 219, 254, 0.2)" stroke="none" />
          <path d={visitsFill} fill="rgba(59, 130, 246, 0.1)" stroke="none" />

          {/* Lines */}
          <path d={viewsPath} fill="none" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={visitsPath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive Points */}
          {points.map((p, i) => (
            <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
              {/* Invisible touch target column */}
              <rect x={p.x - 20} y="0" width="40" height="300" fill="transparent" className="cursor-pointer" />
              
              {/* Views Point */}
              <circle cx={p.x} cy={p.yViews} r="4" fill="#fff" stroke="#93c5fd" strokeWidth="2" 
                className={`transition-all duration-200 ${hoveredIndex === i ? 'r-6 stroke-4' : ''}`} 
              />
              
              {/* Visits Point */}
              <circle cx={p.x} cy={p.yVisits} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="2" 
                className={`transition-all duration-200 ${hoveredIndex === i ? 'r-6 stroke-4' : ''}`}
              />

              {/* X Axis Label */}
              <text x={p.x} y="285" textAnchor="middle" fontSize="12" fill="#6b7280">
                {p.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Floating Tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div 
            className="absolute z-10 bg-white border shadow-lg rounded-lg p-2 text-xs pointer-events-none transform -translate-x-1/2 -translate-y-full"
            style={{ 
              left: `${(points[hoveredIndex].x / 1000) * 100}%`, 
              top: `${(points[hoveredIndex].yViews / 300) * 100}%`,
              marginTop: '-12px'
            }}
          >
            <div className="font-bold text-gray-700 mb-1">{points[hoveredIndex].label}</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="font-medium text-gray-900">{points[hoveredIndex].visits}</span>
              <span className="text-gray-500">Visits</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-300"></div>
              <span className="font-medium text-gray-900">{points[hoveredIndex].views}</span>
              <span className="text-gray-500">Page Views</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-6 text-xs text-gray-500 mt-4 border-t pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-blue-500 rounded-full" />
          <span>Visits</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-blue-300 rounded-full" />
          <span>Page Views</span>
        </div>
      </div>
    </div>
  );
}
