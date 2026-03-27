import { useState } from "react";
import { RiUserLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterButton } from "./FilterButton";

interface ContactsFilterPopoverProps {
  selectedParticipants?: string[];
  allParticipants: Array<{ email: string; name: string | null }>;
  onParticipantsChange: (participants: string[]) => void;
}

export function ContactsFilterPopover({
  selectedParticipants = [],
  allParticipants,
  onParticipantsChange,
}: ContactsFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Staged selections — only committed on Apply (mirrors TagFilterPopover pattern)
  const [stagedParticipants, setStagedParticipants] = useState<string[]>(selectedParticipants);

  // Sync staged state when popover opens so re-opening after a partial clear
  // reflects the current committed filter state, not stale local state.
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStagedParticipants(selectedParticipants);
    }
    setIsOpen(open);
  };

  const filteredParticipants = allParticipants.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.email.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q);
  });

  const handleToggle = (email: string, checked: boolean) => {
    if (checked) {
      setStagedParticipants([...stagedParticipants, email]);
    } else {
      setStagedParticipants(stagedParticipants.filter((p) => p !== email));
    }
  };

  const handleClear = () => {
    setStagedParticipants([]);
    onParticipantsChange([]);
    setIsOpen(false);
  };

  const handleApply = () => {
    onParticipantsChange(stagedParticipants);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiUserLine className="h-3.5 w-3.5" />}
          label="Contacts"
          count={selectedParticipants.length}
          active={selectedParticipants.length > 0}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white dark:bg-card" align="start">
        <div className="flex flex-col">
          <div className="p-3 border-b">
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
            {filteredParticipants.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                {searchQuery ? "No matching contacts" : "No contacts found"}
              </div>
            ) : (
              filteredParticipants.map((participant) => (
                <div key={participant.email} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={participant.email}
                    checked={stagedParticipants.includes(participant.email)}
                    onCheckedChange={(checked) => handleToggle(participant.email, !!checked)}
                  />
                  <label htmlFor={participant.email} className="text-sm cursor-pointer flex-1 py-0.5">
                    {participant.name ? (
                      <div>
                        <div className="font-medium truncate">{participant.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{participant.email}</div>
                      </div>
                    ) : (
                      <span className="truncate">{participant.email}</span>
                    )}
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
