import { DonutChart } from '@tremor/react';

interface DonutChartCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  colors?: string[];
}

const COLOR_MAP: Record<string, string> = {
  'orange': '#FF8800',     // Vibe orange
  'amber': '#FFEB00',      // Vibe orange light
  'green': '#FF8800',      // Legacy alias → vibe orange
  'emerald': '#FFEB00',    // Legacy alias → vibe orange light
  'lime': '#FFFFFF',       // White
  'teal': '#9ca3af',       // Gray
  'slate': '#64748b',      // Slate gray
  'gray': '#94a3b8'        // Light gray
};

export function DonutChartCard({ 
  title, 
  data,
  colors = ["green", "emerald", "teal", "lime", "slate", "gray"]
}: DonutChartCardProps) {
  // Convert color names to hex values
  const hexColors = colors.map(color => COLOR_MAP[color] || color);
  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-card">
        <h3 className="font-display text-sm font-bold text-cb-gray-dark dark:text-cb-gray-light mb-4">
          {title}
        </h3>
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">No data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-card">
      <h3 className="font-display text-sm font-bold text-cb-gray-dark dark:text-cb-gray-light mb-4">
        {title}
      </h3>
      <div className="bg-white dark:bg-card">
        <DonutChart
          data={data}
          category="value"
          index="name"
          colors={hexColors}
          className="h-[200px]"
          showAnimation={true}
        />
      </div>
    </div>
  );
}
