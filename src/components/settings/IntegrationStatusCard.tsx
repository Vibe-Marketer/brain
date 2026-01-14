import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiCheckboxCircleLine, RiCloseCircleLine, RiTimeLine } from "@remixicon/react";

type IntegrationStatus = "connected" | "disconnected" | "coming-soon";

interface IntegrationStatusCardProps {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  status: IntegrationStatus;
  onConnect?: () => void;
  description?: string;
}

export default function IntegrationStatusCard({
  name,
  icon: Icon,
  status,
  onConnect,
  description,
}: IntegrationStatusCardProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <RiCheckboxCircleLine className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="secondary">
            <RiCloseCircleLine className="mr-1 h-3 w-3" />
            Not Connected
          </Badge>
        );
      case "coming-soon":
        return (
          <Badge variant="outline">
            <RiTimeLine className="mr-1 h-3 w-3" />
            Coming Soon
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-cb-border dark:border-cb-border-dark">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="h-5 w-5 text-ink-muted" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{name}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {getStatusBadge()}
        {status === "disconnected" && onConnect && (
          <Button onClick={onConnect} size="sm">
            Connect
          </Button>
        )}
        {status === "connected" && onConnect && (
          <Button onClick={onConnect} variant="hollow" size="sm">
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}
