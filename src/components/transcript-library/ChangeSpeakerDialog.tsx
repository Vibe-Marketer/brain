import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ChangeSpeakerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSpeaker: string;
  currentEmail?: string;
  availableSpeakers: Array<{ name: string; email?: string }>;
  onSave: (name: string, email?: string) => void;
}

export function ChangeSpeakerDialog({
  open,
  onOpenChange,
  currentSpeaker,
  currentEmail: _currentEmail,
  availableSpeakers,
  onSave,
}: ChangeSpeakerDialogProps) {
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(currentSpeaker);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const handleSave = () => {
    if (isCustom) {
      onSave(customName || currentSpeaker, customEmail || undefined);
    } else {
      const speaker = availableSpeakers.find(s => s.name === selectedSpeaker);
      onSave(speaker?.name || selectedSpeaker, speaker?.email);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Speaker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Speaker</Label>
            <Select
              value={isCustom ? "custom" : selectedSpeaker}
              onValueChange={(value) => {
                if (value === "custom") {
                  setIsCustom(true);
                } else {
                  setIsCustom(false);
                  setSelectedSpeaker(value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableSpeakers.map((speaker) => (
                  <SelectItem key={speaker.name} value={speaker.name}>
                    {speaker.name}
                    {speaker.email && (
                      <span className="text-muted-foreground ml-2">({speaker.email})</span>
                    )}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom speaker...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
            <>
              <div className="space-y-2">
                <Label htmlFor="custom-name">Speaker Name</Label>
                <Input
                  id="custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter speaker name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-email">Email (optional)</Label>
                <Input
                  id="custom-email"
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="speaker@example.com"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
