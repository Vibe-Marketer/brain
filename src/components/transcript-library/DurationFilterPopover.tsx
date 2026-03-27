import { useState } from "react";
import { RiTimeLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { FilterButton } from "./FilterButton";

interface DurationFilterPopoverProps {
  durationMin?: number;
  durationMax?: number;
  onDurationChange: (min?: number, max?: number) => void;
}

export function DurationFilterPopover({
  durationMin,
  durationMax,
  onDurationChange,
}: DurationFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Single-handle slider value (used for less-than / more-than)
  const [singleValue, setSingleValue] = useState<number>(durationMin || durationMax || 30);
  // Range mode: separate min and max inputs
  const [rangeMin, setRangeMin] = useState<number>(durationMin || 15);
  const [rangeMax, setRangeMax] = useState<number>(durationMax || 60);

  // Sync local state from props when popover opens so that clearing via pill
  // and re-opening shows the correct (empty) state rather than stale values.
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSingleValue(durationMin || durationMax || 30);
      setRangeMin(durationMin || 15);
      setRangeMax(durationMax || 60);
    }
    setIsOpen(open);
  };

  const handleLessThan = () => {
    onDurationChange(undefined, singleValue);
    setIsOpen(false);
  };

  const handleMoreThan = () => {
    onDurationChange(singleValue, undefined);
    setIsOpen(false);
  };

  const handleBetween = () => {
    const min = Math.min(rangeMin, rangeMax);
    const max = Math.max(rangeMin, rangeMax);
    onDurationChange(min, max);
    setIsOpen(false);
  };

  const handleClear = () => {
    onDurationChange(undefined, undefined);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiTimeLine className="h-3.5 w-3.5" />}
          label="Duration"
          active={!!(durationMin || durationMax)}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-white dark:bg-card" align="start">
        <div className="space-y-5">
          <div className="text-sm font-medium">Call Duration (minutes)</div>

          {/* Single-value slider for less-than / more-than */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Threshold: <span className="font-medium text-foreground">{singleValue} min</span>
            </div>
            <Slider
              value={[singleValue]}
              onValueChange={(value) => setSingleValue(value[0])}
              max={180}
              min={5}
              step={5}
              className="w-full"
            />
            <div className="flex gap-2 pt-1">
              <Button
                variant="hollow"
                size="sm"
                className="flex-1"
                onClick={handleLessThan}
              >
                Less than {singleValue} min
              </Button>
              <Button
                variant="hollow"
                size="sm"
                className="flex-1"
                onClick={handleMoreThan}
              >
                More than {singleValue} min
              </Button>
            </div>
          </div>

          {/* Range mode: between X and Y min */}
          <div className="space-y-2 border-t pt-4">
            <div className="text-xs text-muted-foreground">Between (min &ndash; max)</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={180}
                value={rangeMin}
                onChange={(e) => setRangeMin(Math.max(1, Number(e.target.value)))}
                className="h-8 text-xs w-20"
                placeholder="Min"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="number"
                min={1}
                max={600}
                value={rangeMax}
                onChange={(e) => setRangeMax(Math.max(1, Number(e.target.value)))}
                className="h-8 text-xs w-20"
                placeholder="Max"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            <Button
              variant="hollow"
              size="sm"
              className="w-full"
              onClick={handleBetween}
            >
              Between {Math.min(rangeMin, rangeMax)}–{Math.max(rangeMin, rangeMax)} min
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t">
            <Button variant="hollow" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
