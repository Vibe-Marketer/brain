import * as React from "react";
import { format } from "date-fns";
import { RiCalendarLine, RiCloseLine, RiRefreshLine } from "@remixicon/react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

interface DateRangePickerProps {
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void;
  showQuickSelect?: boolean;
  numberOfMonths?: number;
  disableFuture?: boolean;
  placeholder?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
  disabled?: boolean;
  triggerClassName?: string;
  onFetch?: () => void;
  fetchButtonText?: string;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  showQuickSelect = true,
  numberOfMonths = 2,
  disableFuture = false,
  placeholder = "Pick a date range",
  align = "start",
  className,
  disabled = false,
  triggerClassName,
  onFetch,
  fetchButtonText = "Fetch",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  
  // Use 1 month on mobile, otherwise use the prop value
  const displayMonths = isMobile ? 1 : numberOfMonths;

  const getQuickSelectRange = (preset: string): { from: Date; to: Date } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    switch (preset) {
      case 'today':
        return { from: today, to: today };
      case 'yesterday':
        return { from: yesterday, to: yesterday };
      case 'last7': {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        return { from: last7, to: today };
      }
      case 'thisMonth': {
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: thisMonthStart, to: today };
      }
      case 'lastMonth': {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: lastMonthStart, to: lastMonthEnd };
      }
      case 'last30': {
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        return { from: last30, to: today };
      }
      default:
        return { from: today, to: today };
    }
  };

  const handleQuickSelect = (preset: string) => {
    const range = getQuickSelectRange(preset);
    onDateRangeChange(range);
    // Don't close automatically - let user see the selection
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateRangeChange({});
  };

  const hasSelection = dateRange?.from || dateRange?.to;

  // Calculate the default month to display
  // When disableFuture is true and showing multiple months, offset backward
  // so the current month appears on the right side
  const getDefaultMonth = () => {
    if (disableFuture && displayMonths > 1) {
      const today = new Date();
      const defaultMonth = new Date(today.getFullYear(), today.getMonth() - (displayMonths - 1), 1);
      return defaultMonth;
    }
    return undefined; // Let react-day-picker use default behavior
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="sm"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !hasSelection && "text-muted-foreground",
            triggerClassName
          )}
        >
          <RiCalendarLine className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "MMM d, yyyy")} -{" "}
                {format(dateRange.to, "MMM d, yyyy")}
              </>
            ) : (
              format(dateRange.from, "MMM d, yyyy")
            )
          ) : (
            <span>{placeholder}</span>
          )}
          {hasSelection && (
            <RiCloseLine
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0 max-h-[90vh]", className)} align={align}>
        <div className="p-4 space-y-4 pointer-events-auto overflow-y-auto max-h-[calc(90vh-2rem)]">
          {showQuickSelect && (
            <div>
              <Label className="text-xs font-medium mb-2 block">Quick Select</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('today')}
                  className="h-7 text-xs"
                >
                  Today
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('yesterday')}
                  className="h-7 text-xs"
                >
                  Yesterday
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('last7')}
                  className="h-7 text-xs"
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('thisMonth')}
                  className="h-7 text-xs"
                >
                  This Month
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('lastMonth')}
                  className="h-7 text-xs"
                >
                  Last Month
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('last30')}
                  className="h-7 text-xs"
                >
                  Last 30 Days
                </Button>
              </div>
            </div>
          )}
          <div>
            {showQuickSelect && (
              <Label className="text-xs font-medium mb-2 block">Select Date Range</Label>
            )}
            <Calendar
              mode="range"
              selected={dateRange as DateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={displayMonths}
              defaultMonth={getDefaultMonth()}
              disabled={disableFuture ? (date) => date > new Date() : undefined}
              endMonth={disableFuture ? new Date() : undefined}
              autoFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
          {onFetch && (
            <div className="px-4 pb-4 pt-2 flex justify-center">
              <Button
                onClick={() => {
                  onFetch();
                  setOpen(false);
                }}
                disabled={!dateRange?.from || !dateRange?.to || disabled}
                size="sm"
                className="uppercase"
              >
                <RiRefreshLine className="mr-2 h-4 w-4" />
                {fetchButtonText}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
