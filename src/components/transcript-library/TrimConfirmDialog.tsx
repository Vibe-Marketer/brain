import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RiInformationLine } from "@remixicon/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TrimConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "this" | "before";
  onConfirm: () => void;
}

export function TrimConfirmDialog({
  open,
  onOpenChange,
  type,
  onConfirm,
}: TrimConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {type === "this" ? "Trim This Section?" : "Trim All Before This?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {type === "this"
                  ? "This will hide this section from the transcript."
                  : "This will hide all sections before this one from the transcript."}
              </p>
              <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
                <RiInformationLine className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  You can restore the original transcript anytime by clicking{" "}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="font-medium text-foreground underline decoration-dotted cursor-help">
                        "Resync from Fathom"
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          The Resync button is located at the top of the call detail dialog.
                          It will re-download the original transcript from Fathom.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {" "}at the top of this dialog.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, trim {type === "this" ? "this section" : "all before"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
