/**
 * Hook for searching call_participants to provide contact suggestions.
 * Used in invite dialogs for email autocomplete.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface ContactSuggestion {
  email: string;
  name: string | null;
}

/**
 * Returns a deduplicated list of contacts from call_participants for the active org.
 * Cached for 5 minutes to avoid repeated queries.
 */
export function useContactSuggestions() {
  const { activeOrgId } = useOrganizationContext();

  const { data: suggestions = [] } = useQuery({
    queryKey: ["call-participants", activeOrgId],
    queryFn: async (): Promise<ContactSuggestion[]> => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("call_participants")
        .select("email, name")
        .eq("organization_id", activeOrgId)
        .not("email", "is", null)
        .order("email")
        .limit(500);

      if (error) return [];

      // Deduplicate by email, keeping the first name found
      const contactsMap = new Map<string, string | null>();
      (data ?? []).forEach((row: { email?: string | null; name?: string | null }) => {
        if (row.email && !contactsMap.has(row.email)) {
          contactsMap.set(row.email, row.name ?? null);
        }
      });

      return Array.from(contactsMap.entries())
        .map(([email, name]) => ({ email, name }))
        .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    },
    enabled: !!activeOrgId,
    staleTime: 5 * 60 * 1000,
  });

  return suggestions;
}
