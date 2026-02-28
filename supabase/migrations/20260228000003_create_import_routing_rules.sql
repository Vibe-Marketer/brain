-- Migration: Create import routing rules tables
-- Purpose: Stores org-wide import routing rules and org-level default destination.
--   import_routing_rules: per-org rule list with conditions JSONB, priority, enabled toggle, target vault/folder.
--   import_routing_defaults: org-level fallback destination when no rule matches.
--   update_routing_rule_priorities: RPC to batch-update rule order after drag-to-reorder.
-- Note: File named 000003 because 000001/000002 are taken by workspace_redesign and import_sources.
-- Date: 2026-02-28

-- ============================================================================
-- TABLE: import_routing_rules
-- ============================================================================
-- Organization-scoped routing rules. Each rule has conditions (JSONB array of
-- {field, operator, value} objects) evaluated against an incoming ConnectorRecord.
-- Rules are evaluated in priority order (ascending). First match wins.
-- Scoped to bank_id (org) not user — the whole org shares one rule list.

CREATE TABLE IF NOT EXISTS import_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]',
  logic_operator TEXT NOT NULL DEFAULT 'AND',
  target_vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE RESTRICT,
  target_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup: active rules for a bank ordered by priority (used by routing engine)
CREATE INDEX idx_routing_rules_bank_priority
  ON import_routing_rules(bank_id, priority)
  WHERE enabled = true;

-- ============================================================================
-- ROW LEVEL SECURITY: import_routing_rules
-- ============================================================================

ALTER TABLE import_routing_rules ENABLE ROW LEVEL SECURITY;

-- Bank members can view their org's routing rules
CREATE POLICY "Bank members can view routing rules"
  ON import_routing_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_rules.bank_id
        AND user_id = auth.uid()
    )
  );

-- Bank members can insert routing rules (must set themselves as creator)
CREATE POLICY "Bank members can insert routing rules"
  ON import_routing_rules FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_rules.bank_id
        AND user_id = auth.uid()
    )
  );

-- Bank members can update their org's routing rules
CREATE POLICY "Bank members can update routing rules"
  ON import_routing_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_rules.bank_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_rules.bank_id
        AND user_id = auth.uid()
    )
  );

-- Bank members can delete their org's routing rules
CREATE POLICY "Bank members can delete routing rules"
  ON import_routing_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_rules.bank_id
        AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLE: import_routing_defaults
-- ============================================================================
-- Org-level fallback destination. One row per bank.
-- When no routing rule matches an incoming call, it lands here instead of
-- the personal vault. Managed via upsert — no delete needed.

CREATE TABLE IF NOT EXISTS import_routing_defaults (
  bank_id UUID PRIMARY KEY REFERENCES banks(id) ON DELETE CASCADE,
  target_vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE RESTRICT,
  target_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY: import_routing_defaults
-- ============================================================================

ALTER TABLE import_routing_defaults ENABLE ROW LEVEL SECURITY;

-- Bank members can view their org's default destination
CREATE POLICY "Bank members can view routing defaults"
  ON import_routing_defaults FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_defaults.bank_id
        AND user_id = auth.uid()
    )
  );

-- Bank members can insert their org's default destination
CREATE POLICY "Bank members can insert routing defaults"
  ON import_routing_defaults FOR INSERT
  WITH CHECK (
    auth.uid() = updated_by
    AND EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_defaults.bank_id
        AND user_id = auth.uid()
    )
  );

-- Bank members can update their org's default destination
CREATE POLICY "Bank members can update routing defaults"
  ON import_routing_defaults FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_defaults.bank_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = updated_by
    AND EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_id = import_routing_defaults.bank_id
        AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- RPC: update_routing_rule_priorities
-- ============================================================================
-- Batch-updates priority order after drag-to-reorder. Caller must be a bank member.
-- Priority is assigned as 1-based array index position.
-- SECURITY DEFINER to bypass RLS for the priority update loop.

CREATE OR REPLACE FUNCTION update_routing_rule_priorities(
  p_bank_id UUID,
  p_rule_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule_id UUID;
  v_priority INTEGER := 1;
BEGIN
  -- Verify caller is a member of this bank
  IF NOT EXISTS (
    SELECT 1 FROM bank_memberships
    WHERE bank_id = p_bank_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized: caller is not a member of bank %', p_bank_id;
  END IF;

  -- Update each rule's priority to its 1-based array position
  FOREACH v_rule_id IN ARRAY p_rule_ids LOOP
    UPDATE import_routing_rules
    SET priority = v_priority,
        updated_at = now()
    WHERE id = v_rule_id
      AND bank_id = p_bank_id;

    v_priority := v_priority + 1;
  END LOOP;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE import_routing_rules IS 'Org-wide import routing rules. First-match-wins evaluation. Scoped per bank (org). Shared by all org members.';
COMMENT ON COLUMN import_routing_rules.bank_id IS 'Organization owning this rule. Rules are org-scoped, not user-scoped.';
COMMENT ON COLUMN import_routing_rules.name IS 'Human-readable rule name, e.g. "Q1 Reviews" or "Acme Meetings". Required for scannability.';
COMMENT ON COLUMN import_routing_rules.priority IS 'Sort order for rule evaluation. Lower value = evaluated first. Set via update_routing_rule_priorities RPC.';
COMMENT ON COLUMN import_routing_rules.enabled IS 'When false, rule is skipped during routing evaluation. Useful for seasonal rules.';
COMMENT ON COLUMN import_routing_rules.conditions IS 'JSONB array of condition objects: [{field, operator, value}]. Evaluated with logic_operator.';
COMMENT ON COLUMN import_routing_rules.logic_operator IS 'How conditions are combined: AND (all must match) or OR (any must match).';
COMMENT ON COLUMN import_routing_rules.target_vault_id IS 'Destination workspace for matched calls. Required — routing always has a destination.';
COMMENT ON COLUMN import_routing_rules.target_folder_id IS 'Optional destination folder within the target vault.';

COMMENT ON TABLE import_routing_defaults IS 'Org-level fallback destination when no routing rule matches. One row per bank. Managed via upsert.';
COMMENT ON COLUMN import_routing_defaults.bank_id IS 'Organization this default destination applies to. Primary key — one default per org.';
COMMENT ON COLUMN import_routing_defaults.target_vault_id IS 'Default workspace for unmatched calls.';
COMMENT ON COLUMN import_routing_defaults.target_folder_id IS 'Optional default folder within the default vault.';
COMMENT ON COLUMN import_routing_defaults.updated_by IS 'Last user to update the default destination. Used for audit trail.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
