import { RiLoader2Line } from "@remixicon/react";

import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { RecordingAccessLevel } from "@/types/access-policy";

export interface AccessLevelOption {
  value: RecordingAccessLevel;
  label: string;
  description: string;
}

export const ACCESS_LEVEL_OPTIONS: readonly AccessLevelOption[] = [
  {
    value: "private",
    label: "Private",
    description: "Only you and people you explicitly grant access to.",
  },
  {
    value: "attendees",
    label: "Attendees",
    description: "Confirmed meeting attendees can view the recording.",
  },
  {
    value: "invitees",
    label: "Invitees",
    description: "People invited to the meeting can view the recording.",
  },
  {
    value: "organization",
    label: "Organization",
    description: "People in your organization can view the recording.",
  },
  {
    value: "link",
    label: "Anyone with link",
    description: "People with an active CallVault share link can view the recording.",
  },
  {
    value: "public",
    label: "Public",
    description: "Anyone can view the recording without an invitation or share link.",
  },
] as const;

interface AccessLevelPickerProps {
  value: RecordingAccessLevel;
  onValueChange: (value: RecordingAccessLevel) => void;
  disabled?: boolean;
  pendingValue?: RecordingAccessLevel;
  label?: string;
  id?: string;
  className?: string;
}

export function AccessLevelPicker({
  value,
  onValueChange,
  disabled = false,
  pendingValue,
  label = "Access level",
  id = "access-level",
  className,
}: AccessLevelPickerProps) {
  const labelId = `${id}-label`;

  return (
    <div className={cn("space-y-3", className)}>
      <p id={labelId} className="text-sm font-semibold text-foreground">
        {label}
      </p>
      <RadioGroup
        value={value}
        onValueChange={(nextValue) =>
          onValueChange(nextValue as RecordingAccessLevel)
        }
        disabled={disabled}
        aria-labelledby={labelId}
        className="gap-2"
      >
        {ACCESS_LEVEL_OPTIONS.map((option) => {
          const optionId = `${id}-${option.value}`;
          const isSelected = option.value === value;
          const isPending = option.value === pendingValue;

          return (
            <Label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-border p-4 leading-normal transition-colors",
                "hover:bg-muted/60 focus-within:ring-2 focus-within:ring-vibe-orange focus-within:ring-offset-2",
                isSelected && "bg-muted/60 font-semibold",
                disabled && "cursor-not-allowed opacity-70",
              )}
            >
              <RadioGroupItem
                id={optionId}
                value={option.value}
                className="mt-0.5 shrink-0"
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {option.label}
                  {isPending ? (
                    <RiLoader2Line
                      className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                      aria-label={`Saving ${option.label}`}
                    />
                  ) : null}
                </span>
                <span className="block text-sm font-normal text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

export default AccessLevelPicker;
