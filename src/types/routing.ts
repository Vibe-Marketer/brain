/**
 * Routing Rule Types — Phase 18 Import Routing Rules
 *
 * These types mirror the import_routing_rules and import_routing_defaults
 * DB tables (post Phase 16 rename: banks→organizations, vaults→workspaces).
 */

export interface RoutingCondition {
  field: 'title' | 'participant' | 'source' | 'duration' | 'tag' | 'date';
  operator: string; // varies by field: contains, equals, greater_than, after, before, etc.
  value: string | number;
}

export interface RoutingRule {
  id: string;
  organization_id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: RoutingCondition[];
  logic_operator: 'AND' | 'OR';
  target_workspace_id: string;
  target_folder_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoutingDefault {
  organization_id: string;
  target_workspace_id: string;
  target_folder_id: string | null;
  updated_by: string;
  updated_at: string;
}

export interface RoutingDestination {
  workspaceId: string;
  folderId: string | null;
}
