import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { useQueryClient } from "@tanstack/react-query";
import { useIntegrationModalStore } from "@/stores/integrationModalStore";
import { useIntegrationSync } from "@/hooks/useIntegrationSync";
import { InlineConnectionWizard } from "@/components/sync/InlineConnectionWizard";
import { ConnectedContent } from "./ConnectedContent";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-config";
import { getIntegrationPlatformConfig } from "@/lib/integration-platforms";
import { getConnectorAdapter } from "@/components/connectors/registry/connectorRegistry";
import { invalidateConnectorQueries } from "@/components/connectors/hooks/useConnector";

interface IntegrationConnectModalProps {
  onConnectionChange?: () => void;
}

export function IntegrationConnectModal({
  onConnectionChange,
}: IntegrationConnectModalProps) {
  const { isOpen, platform, closeModal } = useIntegrationModalStore();
  const { integrations } = useIntegrationSync();
  const queryClient = useQueryClient();

  if (!platform) return null;

  const integration = integrations.find((i) => i.platform === platform);
  const isConnected = integration?.connected ?? false;
  const platformName = getIntegrationPlatformConfig(platform).label;

  const handleDisconnect = async () => {
    try {
      await getConnectorAdapter(platform).disconnect?.(
        integration?.sourceId ?? null,
      );
      toast.success(`${platformName} disconnected`);
      await invalidateConnectorQueries(queryClient, platform);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all(),
      });
      onConnectionChange?.();
      closeModal();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to disconnect ${platformName}`,
      );
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg"
          )}
        >
          {/* Hidden title for screen readers - fixes accessibility warning */}
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>
              {isConnected ? `${platformName} Connected` : `Connect ${platformName}`}
            </DialogPrimitive.Title>
          </VisuallyHidden.Root>
          
          {/* No built-in close button - InlineConnectionWizard and ConnectedContent have their own */}
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
