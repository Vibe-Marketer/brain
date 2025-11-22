import { useState } from "react";
import { RiTimeLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
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
  const [durationRange, setDurationRange] = useState<number[]>([durationMin || durationMax || 60]);

  const handleLessThan = () => {
    onDurationChange(undefined, durationRange[0]);
    setIsOpen(false);
  };

  const handleMoreThan = () => {
    onDurationChange(durationRange[0], undefined);
    setIsOpen(false);
  };

  const handleClear = () => {
    onDurationChange(undefined, undefined);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiTimeLine className="h-3.5 w-3.5" />}
          label="Duration"
          active={!!(durationMin || durationMax)}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-white dark:bg-card" align="start">
        <div className="space-y-4">
          <div className="text-sm font-medium">Call Duration (minutes)</div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Up to {durationRange[0]} minutes
            </div>
            <Slider
              value={durationRange}
              onValueChange={(value) => setDurationRange(value as [number])}
              max={180}
              min={5}
              step={5}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="hollow"
              size="sm"
              className="flex-1"
              onClick={handleLessThan}
            >
              Less than
            </Button>
            <Button
              variant="hollow"
              size="sm"
              className="flex-1"
              onClick={handleMoreThan}
            >
              More than
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="hollow" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
