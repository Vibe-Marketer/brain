/**
 * Routing Rule Types — Phase 18 Import Routing Rules
 *
 * These types mirror the import_routing_rules and import_routing_defaults
 * DB tables.
 *
 * Note: bank_id in the DB = activeOrgId in orgContextStore (banks = organizations).
 */

export interface RoutingCondition {
  field: 'title' | 'participant' | 'source' | 'duration' | 'tag' | 'date';
  operator: string; // varies by field: contains, equals, greater_than, after, before, etc.
  value: string | number;
}

export interface RoutingRule {
  id: string;
  bank_id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: RoutingCondition[];
  logic_operator: 'AND' | 'OR';
  target_vault_id: string;
  target_folder_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoutingDefault {
  bank_id: string;
  target_vault_id: string;
  target_folder_id: string | null;
  updated_by: string;
  updated_at: string;
}

export interface RoutingDestination {
  vaultId: string;
  folderId: string | null;
}
