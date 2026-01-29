import { Button } from "@/components/ui/button";
import { RiCalendarLine } from "@remixicon/react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";

type PresetKey = "today" | "last7" | "last30" | "custom";

interface DatePresetBarProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  disabled?: boolean;
}

/**
 * DatePresetBar - Inline date preset buttons for sync flow
 * 
 * Shows Today | Last 7 days | Last 30 days | Custom as a horizontal row
 * Custom opens a calendar popover for manual date selection
 * 
 * @brand-version v4.2
 */
export function DatePresetBar({
  dateRange,
  onDateRangeChange,
  disabled = false,
}: DatePresetBarProps) {
  const [customOpen, setCustomOpen] = useState(false);

  const getQuickSelectRange = (preset: PresetKey): DateRange => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    switch (preset) {
      case "today": {
        return { from: startOfToday, to: today };
      }
      case "last7": {
        const last7 = new Date(startOfToday);
        last7.setDate(last7.getDate() - 6);
        return { from: last7, to: today };
      }
      case "last30": {
        const last30 = new Date(startOfToday);
        last30.setDate(last30.getDate() - 29);
        return { from: last30, to: today };
      }
      default:
        return { from: startOfToday, to: today };
    }
  };

  const handlePresetClick = (preset: PresetKey) => {
    if (preset === "custom") {
      setCustomOpen(true);
      return;
    }
    const range = getQuickSelectRange(preset);
    onDateRangeChange(range);
  };

  // Determine which preset is currently active based on dateRange
  const getActivePreset = (): PresetKey | null => {
    if (!dateRange?.from || !dateRange?.to) return null;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Check if it's "today"
    if (
      dateRange.from.toDateString() === startOfToday.toDateString() &&
      dateRange.to.toDateString() === today.toDateString()
    ) {
      return "today";
    }

    // Check if it's "last 7 days"
    const last7 = new Date(startOfToday);
    last7.setDate(last7.getDate() - 6);
    if (
      dateRange.from.toDateString() === last7.toDateString() &&
      dateRange.to.toDateString() === today.toDateString()
    ) {
      return "last7";
    }

    // Check if it's "last 30 days"
    const last30 = new Date(startOfToday);
    last30.setDate(last30.getDate() - 29);
    if (
      dateRange.from.toDateString() === last30.toDateString() &&
      dateRange.to.toDateString() === today.toDateString()
    ) {
      return "last30";
    }

    // Otherwise it's custom
    return "custom";
  };

  const activePreset = getActivePreset();
  const hasCustomRange = activePreset === "custom";

  const formatCustomRange = () => {
    if (!dateRange?.from) return "Custom";
    if (!dateRange?.to) return format(dateRange.from, "MMM d");
    if (dateRange.from.toDateString() === dateRange.to.toDateString()) {
      return format(dateRange.from, "MMM d");
    }
    return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant={activePreset === "today" ? "default" : "outline"}
        size="sm"
        onClick={() => handlePresetClick("today")}
        disabled={disabled}
        className="h-8 px-3 text-xs"
      >
        Today
      </Button>
      <Button
        variant={activePreset === "last7" ? "default" : "outline"}
        size="sm"
        onClick={() => handlePresetClick("last7")}
        disabled={disabled}
        className="h-8 px-3 text-xs"
      >
        Last 7 days
      </Button>
      <Button
        variant={activePreset === "last30" ? "default" : "outline"}
        size="sm"
        onClick={() => handlePresetClick("last30")}
        disabled={disabled}
        className="h-8 px-3 text-xs"
      >
        Last 30 days
      </Button>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasCustomRange ? "default" : "outline"}
            size="sm"
            disabled={disabled}
            className={cn(
              "h-8 px-3 text-xs gap-1.5",
              hasCustomRange && "min-w-[100px]"
            )}
          >
            <RiCalendarLine className="h-3.5 w-3.5" />
            {hasCustomRange ? formatCustomRange() : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange(range);
              // Close popover when both dates are selected
              if (range?.from && range?.to) {
                setTimeout(() => setCustomOpen(false), 150);
              }
            }}
            numberOfMonths={1}
            disabled={(date) => date > new Date()}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
