import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RiPlayCircleLine } from "@remixicon/react";

interface OnboardingVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartSyncing: () => void;
}

const videoUrl = import.meta.env.VITE_ONBOARDING_VIDEO_URL as string | undefined;

export function OnboardingVideoModal({
  open,
  onOpenChange,
  onStartSyncing,
}: OnboardingVideoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Start with your call library</DialogTitle>
          <DialogDescription>
            Watch the quick walkthrough, then sync the calls you want from your connected source.
          </DialogDescription>
        </DialogHeader>

        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-muted">
          {videoUrl ? (
            <iframe
              src={videoUrl}
              title="CallVault onboarding video"
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
              <RiPlayCircleLine className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Video is not available yet. You can continue and start syncing calls now.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={onStartSyncing}>
            Start syncing calls
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
