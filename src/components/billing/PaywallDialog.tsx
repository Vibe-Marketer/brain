import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "@/components/billing/UpgradeButton";

interface PaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  upgradeProductId: string;
  upgradeLabel: string;
  successPath?: string;
}

export function PaywallDialog({
  open,
  onOpenChange,
  description,
  upgradeProductId,
  upgradeLabel,
  successPath,
}: PaywallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to keep going</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <UpgradeButton productId={upgradeProductId} successPath={successPath}>
            {upgradeLabel}
          </UpgradeButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
