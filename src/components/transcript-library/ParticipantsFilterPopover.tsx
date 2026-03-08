import { useState } from "react";
import { RiUserLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterButton } from "./FilterButton";

interface ParticipantsFilterPopoverProps {
  selectedParticipants?: string[];
  allParticipants: string[];
  onParticipantsChange: (participants: string[]) => void;
}

export function ParticipantsFilterPopover({
  selectedParticipants = [],
  allParticipants,
  onParticipantsChange,
}: ParticipantsFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredParticipants = allParticipants.filter(p =>
    p.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (participant: string, checked: boolean) => {
    if (checked) {
      onParticipantsChange([...selectedParticipants, participant]);
    } else {
      onParticipantsChange(selectedParticipants.filter((p) => p !== participant));
    }
  };

  const handleClear = () => {
    onParticipantsChange([]);
    setIsOpen(false);
  };

  const handleApply = () => {
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiUserLine className="h-3.5 w-3.5" />}
          label="Participants"
          count={selectedParticipants.length}
          active={selectedParticipants.length > 0}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white dark:bg-card" align="start">
        <div className="flex flex-col">
          <div className="p-3 border-b">
            <Input
              placeholder="Search participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
            {filteredParticipants.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                {searchQuery ? "No matching participants" : "No participants found"}
              </div>
            ) : (
              filteredParticipants.map((participant) => (
                <div key={participant} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={participant}
                    checked={selectedParticipants.includes(participant)}
                    onCheckedChange={(checked) => handleToggle(participant, !!checked)}
                  />
                  <label htmlFor={participant} className="text-sm cursor-pointer flex-1 py-0.5 truncate">
                    {participant}
                  </label>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="hollow" size="sm" onClick={handleClear}>
              Clear
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
