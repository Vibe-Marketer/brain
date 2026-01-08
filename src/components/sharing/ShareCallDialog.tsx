import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSharing } from "@/hooks/useSharing";
import { getSafeUser } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import {
  RiShareLine,
  RiFileCopyLine,
  RiCloseLine,
  RiLinkM,
  RiDeleteBinLine,
  RiMailLine,
  RiTimeLine,
  RiCheckLine,
} from "@remixicon/react";
import type { ShareLink } from "@/types/sharing";

interface ShareCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: number | string | null;
  callTitle?: string;
}

export function ShareCallDialog({
  open,
  onOpenChange,
  callId,
  callTitle,
}: ShareCallDialogProps) {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Get current user ID on mount
  useEffect(() => {
    async function loadUser() {
      const { user } = await getSafeUser();
      setUserId(user?.id);
    }
    if (open) {
      loadUser();
    }
  }, [open]);

  const {
    shareLinks,
    isLoadingLinks,
    createShareLink,
    revokeShareLink,
    isCreating,
    isRevoking,
  } = useSharing({
    callId,
    userId,
    enabled: open && !!callId && !!userId,
  });

  // Filter to show only active links
  const activeLinks = shareLinks.filter((link) => link.status === "active");

  // Generate the share URL from a token
  const getShareUrl = (token: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/s/${token}`;
  };

  // Copy link to clipboard
  const handleCopyLink = async (link: ShareLink) => {
    const url = getShareUrl(link.share_token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(link.id);
      toast.success("Link copied to clipboard");
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // Create a new share link
  const handleCreateLink = async () => {
    if (!callId) return;

    try {
      const numericCallId = typeof callId === "string" ? parseInt(callId, 10) : callId;
      const newLink = await createShareLink({
        call_recording_id: numericCallId,
        recipient_email: recipientEmail.trim() || undefined,
      });

      // Automatically copy the new link to clipboard
      const url = getShareUrl(newLink.share_token);
      await navigator.clipboard.writeText(url);
      toast.success("Share link created and copied to clipboard");
      setRecipientEmail("");
    } catch {
      toast.error("Failed to create share link");
    }
  };

  // Revoke a share link
  const handleRevokeLink = async (linkId: string) => {
    try {
      await revokeShareLink(linkId);
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke share link");
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiShareLine className="h-5 w-5" />
            Share Call
          </DialogTitle>
          <DialogDescription>
            {callTitle ? (
              <>Share &quot;{callTitle}&quot; with others via a secure link.</>
            ) : (
              <>Share this call with others via a secure link.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create New Link Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Create New Share Link</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Recipient email (optional)"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="pl-9"
                  disabled={isCreating}
                />
              </div>
              <Button
                onClick={handleCreateLink}
                disabled={isCreating || !callId}
                className="shrink-0"
              >
                {isCreating ? (
                  "Creating..."
                ) : (
                  <>
                    <RiLinkM className="h-4 w-4 mr-2" />
                    CREATE
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with the link can view this call (account required).
            </p>
          </div>

          {/* Existing Links Section */}
          {isLoadingLinks ? (
            <div className="py-4 text-center text-muted-foreground text-sm">
              Loading share links...
            </div>
          ) : activeLinks.length > 0 ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Active Share Links ({activeLinks.length})
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeLinks.map((link) => (
                  <div
                    key={link.id}
                    className={cn(
                      "flex items-center justify-between gap-2 p-3 rounded-md border bg-muted/30",
                      "transition-colors hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <RiLinkM className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-mono truncate">
                          {link.share_token.slice(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {link.recipient_email && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <RiMailLine className="h-3 w-3" />
                            {link.recipient_email}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <RiTimeLine className="h-3 w-3" />
                          {formatDate(link.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyLink(link)}
                        className="h-8 w-8 p-0"
                        title="Copy link"
                      >
                        {copiedLinkId === link.id ? (
                          <RiCheckLine className="h-4 w-4 text-green-500" />
                        ) : (
                          <RiFileCopyLine className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeLink(link.id)}
                        disabled={isRevoking}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Revoke link"
                      >
                        <RiDeleteBinLine className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground text-sm border rounded-md bg-muted/20">
              <RiLinkM className="h-6 w-6 mx-auto mb-2 opacity-50" />
              No share links yet. Create one above to share this call.
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Revoked links will no longer work.
          </p>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            <RiCloseLine className="h-4 w-4 mr-2" />
            CLOSE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ShareCallDialog;
