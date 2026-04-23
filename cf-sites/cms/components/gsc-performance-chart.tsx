'use client';

import { useMemo, useState } from 'react';

interface DailyPoint {
  date: string;
  clicks: number;
  impressions: number;
}

interface GscPerformanceChartProps {
  data: DailyPoint[];
  loading?: boolean;
}

export function GscPerformanceChart({ data, loading }: GscPerformanceChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    if (!data?.length) return 100;
    return Math.max(...data.map((d) => Math.max(d.clicks, d.impressions))) * 1.1 || 100;
  }, [data]);

  const points = useMemo(() => {
    if (!data?.length) return [];
    const width = 1000;
    const height = 300;
    const paddingX = 40;
    const paddingY = 40;
    const graphWidth = width - paddingX * 2;
    const graphHeight = height - paddingY * 2;

    return data.map((point, i) => {
      const x = paddingX + (i / (data.length - 1 || 1)) * graphWidth;
      const clicks = point.clicks ?? 0;
      const impressions = point.impressions ?? 0;
      const yClicks = height - paddingY - (clicks / maxVal) * graphHeight;
      const yImpr = height - paddingY - (impressions / maxVal) * graphHeight;
      return {
        x,
        yClicks,
        yImpr,
        clicks,
        impressions,
        date: point.date,
        label: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });
  }, [data, maxVal]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg animate-pulse">
        <span className="text-muted-foreground">Loading performance…</span>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
        <span className="text-muted-foreground">No daily data</span>
      </div>
    );
  }

  const clicksPath = points.map((p, i) => (i === 0 ? `M ${p.x},${p.yClicks}` : `L ${p.x},${p.yClicks}`)).join(' ');
  const imprPath = points.map((p, i) => (i === 0 ? `M ${p.x},${p.yImpr}` : `L ${p.x},${p.yImpr}`)).join(' ');

  return (
    <div className="w-full rounded-lg p-2">
      <div className="relative w-full aspect-[3/1] min-h-[220px]">
        <svg
          className="w-full h-full overflow-visible text-muted-foreground"
          viewBox="0 0 1000 300"
          preserveAspectRatio="none"
        >
          <line x1="40" y1="260" x2="960" y2="260" stroke="currentColor" strokeOpacity={0.15} strokeWidth="1" />
          <line x1="40" y1="40" x2="960" y2="40" stroke="currentColor" strokeOpacity={0.15} strokeWidth="1" strokeDasharray="4 4" />
          <path d={clicksPath} fill="none" stroke="var(--chart-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={imprPath} fill="none" stroke="var(--chart-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
              <rect x={p.x - 18} y={0} width={36} height={300} fill="transparent" className="cursor-pointer" />
              <circle cx={p.x} cy={p.yClicks} r={3.5} fill="var(--background)" stroke="var(--chart-1)" strokeWidth={2} />
              <circle cx={p.x} cy={p.yImpr} r={3.5} fill="var(--background)" stroke="var(--chart-2)" strokeWidth={2} />
              <text x={p.x} y={285} textAnchor="middle" fontSize={11} fill="currentColor">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div
            className="absolute z-10 bg-popover border shadow-md rounded-md px-2.5 py-2 text-xs pointer-events-none"
            style={{
              left: `${(points[hoveredIndex].x / 1000) * 100}%`,
              top: '8%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-medium text-foreground mb-1">{points[hoveredIndex].label}</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--chart-1)]" />
              <span>Clicks: {points[hoveredIndex].clicks}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--chart-2)]" />
              <span>Impressions: {points[hoveredIndex].impressions}</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-center gap-6 text-xs text-muted-foreground mt-3 pt-2 border-t">
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded-full bg-[var(--chart-1)]" />
          <span>Clicks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded-full bg-[var(--chart-2)]" />
          <span>Impressions</span>
        </div>
      </div>
    </div>
  );
}
