/**
 * DisconnectConfirmDialog — Radix AlertDialog reused by ConnectorCardFull
 * and any other consumer that needs a "Disconnect <vendor>?" confirmation.
 */
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DisconnectConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorLabel: string;
  onConfirm: () => void;
}

export function DisconnectConfirmDialog({
  open,
  onOpenChange,
  vendorLabel,
  onConfirm,
}: DisconnectConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in-0" />
        <AlertDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl p-6",
            "animate-in zoom-in-95 duration-200 focus:outline-none",
          )}
        >
          <AlertDialog.Title className="font-montserrat font-extrabold text-base uppercase tracking-wide text-foreground mb-2">
            Disconnect {vendorLabel}?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground leading-relaxed mb-5">
            Future syncs will stop. Your imported calls will be kept.
          </AlertDialog.Description>
          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="hollow" size="sm">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                Disconnect
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
