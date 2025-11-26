import { Dispatch, SetStateAction } from "react";
import {
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RiSaveLine, RiCloseLine, RiVidiconLine, RiFileCopyLine, RiEditLine, RiRobotLine } from "@remixicon/react";

interface CallDetailHeaderProps {
  call: any;
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  editedTitle: string;
  setEditedTitle: Dispatch<SetStateAction<string>>;
  setEditedSummary: Dispatch<SetStateAction<string>>;
  onSave: () => void;
  isSaving: boolean;
  onChatWithAI?: () => void;
}

export function CallDetailHeader({
  call,
  isEditing,
  setIsEditing,
  editedTitle,
  setEditedTitle,
  setEditedSummary,
  onSave,
  isSaving,
  onChatWithAI,
}: CallDetailHeaderProps) {
  return (
    <DialogHeader className="flex-shrink-0">
      <span id="call-detail-description" className="sr-only">
        Detailed view of the meeting including transcript, participants, and speakers
      </span>
      <div className="flex items-center justify-between">
        <DialogTitle>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSaving) {
                    onSave();
                  }
                }}
                className="text-xl font-semibold"
                autoFocus
              />
            ) : (
              <span
                onClick={() => setIsEditing(true)}
                className="cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                title="Click to edit title"
              >
                {editedTitle}
              </span>
            )}
          </div>
        </DialogTitle>
        <div className="flex gap-2">
          {call.share_url && (
            <>
              <Button
                variant="hollow"
                size="sm"
                onClick={() => window.open(call.share_url, "_blank")}
              >
                <RiVidiconLine className="h-4 w-4 mr-2" />
                VIEW
              </Button>
              <Button
                variant="hollow"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(call.share_url);
                  toast.success("Link copied to clipboard");
                }}
              >
                <RiFileCopyLine className="h-4 w-4 mr-2" />
                COPY
              </Button>
            </>
          )}
          {isEditing ? (
            <>
              <Button
                variant="hollow"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditedTitle(call.title);
                  setEditedSummary(call.summary || "");
                }}
              >
                <RiCloseLine className="h-4 w-4 mr-2" />
                CANCEL
              </Button>
              <Button variant="default" size="sm" onClick={onSave}>
                <RiSaveLine className="h-4 w-4 mr-2" />
                SAVE
              </Button>
            </>
          ) : (
            <>
              {onChatWithAI && (
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={onChatWithAI}
                >
                  <RiRobotLine className="h-4 w-4 mr-2" />
                  AI CHAT
                </Button>
              )}
              <Button
                variant="hollow"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <RiEditLine className="h-4 w-4 mr-2" />
                EDIT
              </Button>
            </>
          )}
        </div>
      </div>
    </DialogHeader>
  );
}
