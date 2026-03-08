import { RiVideoLine } from "@remixicon/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterButton } from "./FilterButton";
import { FathomIcon, ZoomIcon, YouTubeIcon, UploadIcon } from "./SourcePlatformIcons";

interface SourceFilterPopoverProps {
  selectedSources?: string[];
  onSourcesChange: (sources: string[]) => void;
}

const sourceOptions = [
  { value: "fathom", label: "Fathom", Icon: FathomIcon },
  { value: "zoom", label: "Zoom", Icon: ZoomIcon },
  { value: "youtube", label: "YouTube", Icon: YouTubeIcon },
  { value: "file-upload", label: "Upload", Icon: UploadIcon },
] as const;

export function SourceFilterPopover({
  selectedSources = [],
  onSourcesChange,
}: SourceFilterPopoverProps) {
  const handleSourceToggle = (source: string, checked: boolean) => {
    if (checked) {
      onSourcesChange([...selectedSources, source]);
    } else {
      onSourcesChange(selectedSources.filter((s) => s !== source));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiVideoLine className="h-3.5 w-3.5" />}
          label="Source"
          count={selectedSources.length}
          active={selectedSources.length > 0}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 bg-white dark:bg-card" align="start">
        <div className="p-4 pb-3">
          <div className="text-sm font-medium">Filter by Source</div>
        </div>
        <div className="px-4 pb-4 space-y-3">
          {sourceOptions.map((option) => {
            const Icon = option.Icon;
            return (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`source-filter-${option.value}`}
                  checked={selectedSources.includes(option.value)}
                  onCheckedChange={(checked) => handleSourceToggle(option.value, !!checked)}
                />
                <label
                  htmlFor={`source-filter-${option.value}`}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </label>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
