/**
 * bulk-apply-rules.service — Pure async service for retroactively applying routing rules.
 */

import { supabase } from '@/integrations/supabase/client';

export interface BulkApplyOptions {
  dryRun?: boolean;
  ruleIds?: string[];
  limit?: number;
}

export interface BulkApplyResult {
  processed: number;
  matched: number;
  assigned: number;
  skipped: number;
  dryRun: boolean;
  details: Array<{
    recordingId: string;
    title: string;
    matchedRuleId: string;
    matchedRuleName: string;
    workspaceId: string;
    folderId: string | null;
    action: 'assigned' | 'skipped';
  }>;
}

export async function bulkApplyRoutingRules(opts: BulkApplyOptions): Promise<BulkApplyResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('Not authenticated — please sign in and try again.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(
    `${supabaseUrl}/functions/v1/bulk-apply-routing-rules`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify({
        dryRun: opts.dryRun ?? false,
        ruleIds: opts.ruleIds,
        limit: opts.limit ?? 1000,
      }),
    }
  );

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (payload as Record<string, string>)?.error ?? (payload as Record<string, string>)?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if ((payload as Record<string, string>)?.error) throw new Error((payload as Record<string, string>).error);

  return payload as BulkApplyResult;
}
