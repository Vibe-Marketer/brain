import { Dispatch, SetStateAction, useState } from "react";
import {
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RiSaveLine,
  RiCloseLine,
  RiVidiconLine,
  RiFileCopyLine,
  RiEditLine,
  RiShareLine,
  RiLinkM,
  RiRefreshLine,
  RiLoader4Line,
} from "@remixicon/react";
import { Meeting } from "@/types";
import { ShareCallDialog } from "@/components/sharing/ShareCallDialog";
import { CopyToOrganizationDialog } from "@/components/dialogs/CopyToOrganizationDialog";
import { RefreshFromFathomDialog } from "@/components/dialogs/RefreshFromFathomDialog";
import { useFathomRefresh, type FathomRefreshResult } from "@/hooks/useFathomRefresh";
import { resolveShareUrl } from "@/lib/recording-source-url";

interface CallDetailHeaderProps {
  call: Meeting | null;
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  editedTitle: string;
  setEditedTitle: Dispatch<SetStateAction<string>>;
  setEditedSummary: Dispatch<SetStateAction<string>>;
  onSave: () => void;
  isSaving: boolean;
  onRefreshSuccess?: (result: FathomRefreshResult) => void;
  suggestedTitle?: string | null;
  suggestedTitleSource?: string | null;
  onApplySuggestedTitle?: (title: string) => void;
  onEditSuggestedTitle?: (title: string) => void;
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
  onRefreshSuccess,
  suggestedTitle,
  suggestedTitleSource,
  onApplySuggestedTitle,
  onEditSuggestedTitle,
}: CallDetailHeaderProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copyToOrgOpen, setCopyToOrgOpen] = useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [suggestedTitleDialogOpen, setSuggestedTitleDialogOpen] = useState(false);
  const refreshMutation = useFathomRefresh({
    onSuccess: onRefreshSuccess,
    onSettled: () => setRefreshDialogOpen(false),
  });

  // Early return if call is null to prevent white screen crashes
  if (!call) {
    return null;
  }

  const canRefreshFromFathom = call?.source_platform === "fathom";
  const recordingUuid = call?.canonical_uuid;

  return (
    <>
      <DialogHeader className="flex-shrink-0">
        <div className="flex flex-col gap-3">
          <DialogTitle className="min-w-0 pr-8">
            <div className="flex min-w-0 items-center gap-2">
              {isEditing ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSaving) {
                      onSave();
                    }
                  }}
                  className="h-auto min-h-10 w-full text-xl font-semibold leading-tight"
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => setIsEditing(true)}
                  className="line-clamp-2 cursor-pointer overflow-hidden text-xl font-semibold leading-tight transition-colors hover:text-primary"
                  title="Click to edit title"
                >
                  {editedTitle}
                </span>
              )}
            </div>
          </DialogTitle>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const openUrl = resolveShareUrl(call);
              if (!openUrl) return null;
              const isFathom =
                call?.source_platform === 'fathom-paste' ||
                call?.source_app === 'fathom-paste' ||
                /fathom\.video/i.test(openUrl);
              const isZoom =
                call?.source_app === 'zoom' || /zoom\.us/i.test(openUrl);
              const label = isFathom
                ? 'VIEW ON FATHOM'
                : isZoom
                  ? 'OPEN ZOOM RECORDING'
                  : 'OPEN SOURCE';
              return (
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => window.open(openUrl, '_blank', 'noopener,noreferrer')}
                >
                  {isFathom ? (
                    <RiLinkM className="h-4 w-4 mr-2" />
                  ) : (
                    <RiVidiconLine className="h-4 w-4 mr-2" />
                  )}
                  {label}
                </Button>
              );
            })()}
            {isEditing ? (
              <>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedTitle(call?.title || "");
                    setEditedSummary(call?.summary || "");
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
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => setCopyToOrgOpen(true)}
                >
                  <RiFileCopyLine className="h-4 w-4 mr-2" />
                  COPY
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => setShareDialogOpen(true)}
                >
                  <RiShareLine className="h-4 w-4 mr-2" />
                  SHARE
                </Button>
                {canRefreshFromFathom && (
                  <Button
                    variant="hollow"
                    size="sm"
                    disabled={refreshMutation.isPending}
                    onClick={() => setRefreshDialogOpen(true)}
                    data-testid="refresh-from-fathom-button"
                  >
                    {refreshMutation.isPending ? (
                      <RiLoader4Line className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RiRefreshLine className="h-4 w-4 mr-2" />
                    )}
                    REFRESH
                  </Button>
                )}
                {suggestedTitle && (
                  <Button
                    variant="hollow"
                    size="sm"
                    onClick={() => setSuggestedTitleDialogOpen(true)}
                  >
                    <RiFileCopyLine className="h-4 w-4 mr-2" />
                    SUGGESTED TITLE
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

      <ShareCallDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        callId={String(call.recording_id)}
        callTitle={call.title}
      />

      <CopyToOrganizationDialog
        open={copyToOrgOpen}
        onOpenChange={setCopyToOrgOpen}
        recordingIds={[call.canonical_uuid || String(call.recording_id)]}
      />

      <RefreshFromFathomDialog
        open={refreshDialogOpen}
        onOpenChange={setRefreshDialogOpen}
        isPending={refreshMutation.isPending}
        callTitle={call?.title ?? undefined}
        onConfirm={() => {
          if (recordingUuid) {
            refreshMutation.mutate(recordingUuid);
          }
        }}
      />

      <AlertDialog
        open={suggestedTitleDialogOpen}
        onOpenChange={setSuggestedTitleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply suggested title</AlertDialogTitle>
            <AlertDialogDescription>
              Replace the current meeting title in one click, or use the
              suggestion as a starting point and edit it before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Current title</p>
              <p className="font-medium">{call.title}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {suggestedTitleSource ?? "Suggested title"}
              </p>
              <p className="font-medium">{suggestedTitle}</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Keep current title</AlertDialogCancel>
            <Button
              variant="hollow"
              size="sm"
              disabled={!suggestedTitle || isSaving}
              onClick={() => {
                if (!suggestedTitle || !onEditSuggestedTitle) return;
                onEditSuggestedTitle(suggestedTitle);
                setSuggestedTitleDialogOpen(false);
              }}
            >
              <RiEditLine className="h-4 w-4 mr-2" />
              EDIT FIRST
            </Button>
            <AlertDialogAction
              disabled={!suggestedTitle || isSaving}
              onClick={(event) => {
                event.preventDefault();
                if (!suggestedTitle || !onApplySuggestedTitle) return;
                onApplySuggestedTitle(suggestedTitle);
                setSuggestedTitleDialogOpen(false);
              }}
            >
              <RiSaveLine className="h-4 w-4 mr-2" />
              APPLY TITLE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
