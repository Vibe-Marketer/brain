import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIntegrationModalStore } from "@/stores/integrationModalStore";
import { useIntegrationSync } from "@/hooks/useIntegrationSync";
import { InlineConnectionWizard } from "@/components/sync/InlineConnectionWizard";
import { ConnectedContent } from "./ConnectedContent";
import { toast } from "sonner";

interface IntegrationConnectModalProps {
  onConnectionChange?: () => void;
}

export function IntegrationConnectModal({
  onConnectionChange,
}: IntegrationConnectModalProps) {
  const { isOpen, platform, closeModal } = useIntegrationModalStore();
  const { integrations } = useIntegrationSync();

  if (!platform) return null;

  const integration = integrations.find((i) => i.platform === platform);
  const isConnected = integration?.connected ?? false;

  const handleDisconnect = () => {
    // TODO: Implement actual disconnect API call
    toast.info("Disconnect not implemented yet");
    closeModal();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-md">
        {isConnected ? (
          <ConnectedContent
            platform={platform}
            email={integration?.email}
            lastSyncAt={integration?.lastSyncAt}
            onDisconnect={handleDisconnect}
            onClose={closeModal}
          />
        ) : (
          <InlineConnectionWizard
            platform={platform}
            onComplete={() => {
              onConnectionChange?.();
              closeModal();
            }}
            onCancel={closeModal}
            currentEmail={integration?.email}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
