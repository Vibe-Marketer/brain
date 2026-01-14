import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FathomIcon, GoogleMeetIcon } from "@/components/transcript-library/SourcePlatformIcons";

export type SourcePlatform = "fathom" | "google_meet";

interface SourceFilterCheckboxesProps {
  selectedSources: SourcePlatform[];
  onChange: (sources: SourcePlatform[]) => void;
  className?: string;
}

const sourceOptions: Array<{
  platform: SourcePlatform;
  label: string;
  Icon: typeof FathomIcon;
}> = [
  {
    platform: "fathom",
    label: "Fathom",
    Icon: FathomIcon,
  },
  {
    platform: "google_meet",
    label: "Google Meet",
    Icon: GoogleMeetIcon,
  },
];

export function SourceFilterCheckboxes({
  selectedSources,
  onChange,
  className,
}: SourceFilterCheckboxesProps) {
  const handleToggle = (platform: SourcePlatform) => {
    if (selectedSources.includes(platform)) {
      // Remove platform
      onChange(selectedSources.filter((p) => p !== platform));
    } else {
      // Add platform
      onChange([...selectedSources, platform]);
    }
  };

  // If no sources selected, show all (treat as no filter)
  const allSelected = selectedSources.length === 0 || selectedSources.length === sourceOptions.length;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="text-xs text-muted-foreground">Filter:</span>
      {sourceOptions.map((option) => {
        const Icon = option.Icon;
        const isChecked = allSelected || selectedSources.includes(option.platform);

        return (
          <div key={option.platform} className="flex items-center gap-1.5">
            <Checkbox
              id={`source-filter-${option.platform}`}
              checked={isChecked}
              onCheckedChange={() => handleToggle(option.platform)}
              className="h-3.5 w-3.5"
            />
            <Label
              htmlFor={`source-filter-${option.platform}`}
              className="flex items-center gap-1 text-xs cursor-pointer"
            >
              <Icon className="h-3 w-3" />
              {option.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
