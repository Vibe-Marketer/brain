import { supabase } from '@/integrations/supabase/client'

/**
 * Identity Evidence Service — pure async wrapper over the redacted
 * get_identity_evidence RPC (Phase 34-02 migration).
 *
 * PII boundary: the RPC never returns the underlying alias value (email).
 * It returns only alias_type, confidence, and a human-readable evidence
 * string. This service must never query identity_aliases directly — the
 * RPC is the only sanctioned read path for identity evidence from the
 * client (see 34-05-PLAN.md threat model T-34-05-01).
 */

export interface IdentityEvidenceRow {
  alias_type: string
  confidence: number
  evidence: string
}

/**
 * Fetches the redacted evidence trail for a resolved identity.
 *
 * @param identityId - the identities.id a speaker/contact/call_participant
 *   resolved to (identity_id column).
 * @returns Redacted evidence rows (alias_type, confidence, evidence) — no
 *   PII. Empty array if the identity has no recorded evidence.
 * @throws Error if the RPC call fails.
 */
export async function getIdentityEvidence(identityId: string): Promise<IdentityEvidenceRow[]> {
  const { data, error } = await supabase.rpc('get_identity_evidence', {
    p_identity_id: identityId,
  })

  if (error) {
    throw new Error(`Failed to fetch identity evidence: ${error.message}`)
  }

  return data ?? []
}
