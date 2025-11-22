import { RiCalendarLine } from "@remixicon/react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRange } from "react-day-picker";
import { Category } from "@/hooks/useCategorySync";

interface SyncFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  preSyncCategoryId: string;
  onPreSyncCategoryChange: (categoryId: string) => void;
  categories: Category[];
  onCreateCategory: () => void;
}

export function SyncFilters({
  dateRange,
  onDateRangeChange,
  preSyncCategoryId,
  onPreSyncCategoryChange,
  categories,
  onCreateCategory,
}: SyncFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Date Range Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Date Range</label>
        <div className="flex items-center gap-2">
          <RiCalendarLine className="h-4 w-4 text-muted-foreground" />
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            placeholder="Select date range"
          />
        </div>
      </div>

      {/* Pre-Sync Category Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Auto-assign category on sync (optional)
        </label>
        <div className="flex gap-2">
          <Select value={preSyncCategoryId} onValueChange={onPreSyncCategoryChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="No category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={onCreateCategory}
            className="px-3 py-2 text-sm font-medium text-primary hover:text-primary/80 border border-input rounded-md hover:bg-accent"
          >
            + New
          </button>
        </div>
      </div>
    </div>
  );
}
