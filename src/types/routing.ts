/**
 * Routing Rule Types — Phase 18 Import Routing Rules
 *
 * These types mirror the import_routing_rules and import_routing_defaults
 * DB tables: organizations (formerly banks) and workspaces (formerly vaults).
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
  /** Non-null when this rule routes to a different organization (cross-org). */
  target_organization_id: string | null;
  /**
   * Per-rule copy preference for cross-org rules.
   * false = keep source recording (default), true = delete source after copy.
   */
  delete_after_copy: boolean;
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
  /** Non-null = cross-org rule; the target workspace belongs to this org. */
  targetOrganizationId?: string | null;
}

/** Single match result from bulk apply dry run / execution. */
export interface BulkApplyMatch {
  recording_id: string;
  title: string;
  rule_name: string;
  rule_id: string;
  target_workspace_id: string;
  target_workspace_name: string | null;
  target_folder_id: string | null;
}

/** Response from the apply-routing-rules edge function. */
export interface BulkApplyResult {
  total_evaluated: number;
  matched: number;
  moved: number;
  skipped: number;
  dry_run: boolean;
  matches: BulkApplyMatch[];
}
