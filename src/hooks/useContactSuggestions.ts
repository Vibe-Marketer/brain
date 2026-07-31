/**
 * Hook for searching call_participants to provide contact suggestions.
 * Used in invite dialogs for email autocomplete.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { untypedRpc } from "@/types/db-extensions";

const CONTACT_SUGGESTIONS_PAGE_SIZE = 1000;

export interface ContactSuggestion {
  email: string;
  name: string | null;
}

function mergeContactSuggestion(
  contactsMap: Map<string, string | null>,
  row: { email?: string | null; name?: string | null },
) {
  const emails = (row.email ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
  if (emails.length === 0) return;

  const name = emails.length === 1 ? row.name?.trim() || null : null;
  for (const email of emails) {
    if (!contactsMap.has(email)) {
      contactsMap.set(email, name);
      continue;
    }

    if (name && !contactsMap.get(email)) {
      contactsMap.set(email, name);
    }
  }
}

async function fetchPagedContactRows(
  table: "contacts" | "call_participants",
  orgColumn: "org_id" | "organization_id",
  orgId: string,
  signal?: AbortSignal,
): Promise<Array<{ email?: string | null; name?: string | null }>> {
  const rows: Array<{ email?: string | null; name?: string | null }> = [];
  let from = 0;

  while (true) {
    const to = from + CONTACT_SUGGESTIONS_PAGE_SIZE - 1;
    let query = supabase
      .from(table)
      .select("email, name")
      .eq(orgColumn, orgId)
      .not("email", "is", null)
      .order("email")
      .range(from, to);

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < CONTACT_SUGGESTIONS_PAGE_SIZE) break;
    from += CONTACT_SUGGESTIONS_PAGE_SIZE;
  }

  return rows;
}

async function fetchParticipantContactRows(
  orgId: string,
  signal?: AbortSignal,
): Promise<Array<{ email?: string | null; name?: string | null }>> {
  // Deduped server-side (one row per distinct email) via RPC instead of
  // paginating every raw call_participants row — a recurring meeting
  // attendee otherwise adds a row per call, blowing past the 1000-row page
  // size and firing several near-identical requests per load (ticket 43eabbbe).
  let query = untypedRpc(supabase, "get_org_call_participant_contacts", {
    p_organization_id: orgId,
  });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data ?? [];
}

export async function fetchContactSuggestionsForOrg(
  orgId: string,
  signal?: AbortSignal,
): Promise<ContactSuggestion[]> {
  const contactsMap = new Map<string, string | null>();

  const [savedContacts, participantContacts] = await Promise.all([
    fetchPagedContactRows("contacts", "org_id", orgId, signal),
    fetchParticipantContactRows(orgId, signal),
  ]);

  savedContacts.forEach((row) => mergeContactSuggestion(contactsMap, row));
  participantContacts.forEach((row) => mergeContactSuggestion(contactsMap, row));

  return Array.from(contactsMap.entries())
    .map(([email, name]) => ({ email, name }))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
}

/**
 * Returns a deduplicated list of contacts from saved contacts and call_participants
 * for the active org.
 * Cached for 5 minutes to avoid repeated queries.
 */
export function useContactSuggestions() {
  const { activeOrgId } = useOrganizationContext();

  const { data: suggestions = [] } = useQuery({
    queryKey: ["call-participants", activeOrgId],
    queryFn: async (): Promise<ContactSuggestion[]> => {
      if (!activeOrgId) return [];

      return fetchContactSuggestionsForOrg(activeOrgId);
    },
    enabled: !!activeOrgId,
    staleTime: 5 * 60 * 1000,
  });

  return suggestions;
}
