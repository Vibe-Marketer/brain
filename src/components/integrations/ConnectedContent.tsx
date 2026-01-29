import { Button } from "@/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RiCheckboxCircleLine,
  RiTimeLine,
  RiSettings3Line,
} from "@remixicon/react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { IntegrationPlatform } from "@/hooks/useIntegrationSync";

interface ConnectedContentProps {
  platform: IntegrationPlatform;
  email?: string;
  lastSyncAt?: string | null;
  onDisconnect: () => void;
  onClose: () => void;
}

const platformNames = {
  fathom: "Fathom",
  google_meet: "Google Meet",
  zoom: "Zoom",
};

export function ConnectedContent({
  platform,
  email,
  lastSyncAt,
  onDisconnect,
  onClose,
}: ConnectedContentProps) {
  const navigate = useNavigate();
  const name = platformNames[platform];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <RiCheckboxCircleLine className="h-5 w-5 text-success" />
          {name} Connected
        </DialogTitle>
        <DialogDescription>
          Your {name} account is connected and syncing.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Connected account email */}
        {email && (
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-ink-muted">Connected as</span>
            <span className="text-sm font-medium">{email}</span>
          </div>
        )}

        {/* Last synced */}
        {lastSyncAt && (
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-ink-muted flex items-center gap-1">
              <RiTimeLine className="h-4 w-4" />
              Last synced
            </span>
            <span className="text-sm">
              {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button
          variant="hollow"
          onClick={() => {
            onClose();
            navigate("/settings/integrations");
          }}
          className="flex-1"
        >
          <RiSettings3Line className="mr-2 h-4 w-4" />
          Manage in Settings
        </Button>
        <Button variant="destructive" onClick={onDisconnect} className="flex-1">
          Disconnect
        </Button>
      </DialogFooter>
    </>
  );
}
