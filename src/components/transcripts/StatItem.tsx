interface StatItemProps {
  label: string;
  value: string | number;
  current?: string | number;
}

export function StatItem({ label, value, current }: StatItemProps) {
  return (
    <div className="relative py-2 px-4 bg-white dark:bg-card border border-border dark:border-cb-border-dark rounded-lg">
      {/* Vibe orange wedge accent - trapezoid shape */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-vibe-orange cv-vertical-marker" />
      
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium text-cb-gray-dark dark:text-cb-gray-light">
          {label}
        </div>
        {current && (
          <div className="text-[10px] text-cb-gray-dark dark:text-cb-gray-light">
            current
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="font-display text-2xl font-extrabold text-cb-black dark:text-cb-white">
          {value}
        </div>
        {current && (
          <div className="text-lg font-semibold text-cb-gray-dark dark:text-cb-gray-light">
            {current}
          </div>
        )}
      </div>
    </div>
  );
}
