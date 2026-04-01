/**
 * RoutingRulesList — Simple list container for RoutingRuleCard components.
 */

import { RoutingRuleCard } from './RoutingRuleCard';
import type { RoutingRule } from '@/types/routing';

interface RoutingRulesListProps {
  rules: RoutingRule[];
  onEdit: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (ruleId: string) => void;
  workspaceNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  orgNames?: Record<string, string>;
}

export function RoutingRulesList({
  rules,
  onEdit,
  onToggle,
  onDelete,
  workspaceNames,
  folderNames,
  orgNames,
}: RoutingRulesListProps) {
  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <RoutingRuleCard
          key={rule.id}
          rule={rule}
          workspaceName={workspaceNames?.[rule.target_workspace_id]}
          folderName={rule.target_folder_id ? folderNames?.[rule.target_folder_id] : undefined}
          targetOrgName={rule.target_organization_id ? orgNames?.[rule.target_organization_id] : undefined}
          onEdit={onEdit}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
