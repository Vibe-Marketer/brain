import type * as React from 'react';
import { ConnectorAccountHeader } from '@/components/connectors/ConnectorAccountHeader';
import { cn } from '@/lib/utils';

interface ManualImportSourceCardProps {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  statusText?: string;
  children: React.ReactNode;
  className?: string;
}

export function ManualImportSourceCard({
  label,
  description,
  icon,
  statusText,
  children,
  className,
}: ManualImportSourceCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 space-y-4', className)}>
      <ConnectorAccountHeader
        label={label}
        description={description}
        icon={icon}
        connected
        accountEmail={statusText}
      />
      {children}
    </div>
  );
}
