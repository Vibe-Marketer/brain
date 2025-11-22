import { DonutChart } from '@tremor/react';

interface DonutChartMetricProps {
  title: string;
  value: number | string;
  percentage: number;
  category: string;
}

export function DonutChartMetric({ title, value, percentage, category }: DonutChartMetricProps) {
  const data = [
    { name: category, value: percentage },
    { name: 'Remaining', value: Math.max(0, 100 - percentage) }
  ];

  return (
    <div className="p-6 bg-white dark:bg-card">
      <h3 className="font-display text-sm font-bold text-cb-gray-dark dark:text-cb-gray-light mb-4">
        {title}
      </h3>
      <div className="relative bg-white dark:bg-card">
        <DonutChart
          data={data}
          category="value"
          index="name"
          colors={["#D9FC67", "#64748b"]}
          className="h-[200px]"
          showLabel={false}
          showAnimation={true}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="font-display text-3xl font-extrabold text-cb-black dark:text-cb-white">
            {typeof value === 'number' ? value.toFixed(0) : value}
          </div>
          <div className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
            {percentage}%
          </div>
        </div>
      </div>
    </div>
  );
}
