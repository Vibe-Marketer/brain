/**
 * ContactSuggestions — dropdown list of matching contacts from call_participants.
 * Renders below an email input field when the user types a query.
 * Clicking a suggestion fills the email field.
 */
import { useMemo } from "react";
import { RiUserLine } from "@remixicon/react";
import type { ContactSuggestion } from "@/hooks/useContactSuggestions";

interface ContactSuggestionsProps {
  query: string;
  suggestions: ContactSuggestion[];
  onSelect: (email: string) => void;
}

export function ContactSuggestions({
  query,
  suggestions,
  onSelect,
}: ContactSuggestionsProps) {
  const filtered = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return suggestions
      .filter(
        (s) =>
          s.email.toLowerCase().includes(q) ||
          (s.name && s.name.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, suggestions]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
      {filtered.map((contact) => (
        <button
          key={contact.email}
          type="button"
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
          onMouseDown={(e) => {
            // Use onMouseDown to fire before the input's onBlur
            e.preventDefault();
            onSelect(contact.email);
          }}
        >
          <RiUserLine className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {contact.name ? (
              <>
                <div className="text-sm font-medium truncate">{contact.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {contact.email}
                </div>
              </>
            ) : (
              <div className="text-sm truncate">{contact.email}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
