import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { requireUser } from "@/lib/auth-utils";
import type { ContactWithCallCount } from "@/types/contacts";

/**
 * Default prompt for re-engagement email generation
 * From CONTEXT.md: "Casual message noting they've been missed, recent call highlights, checking in"
 */
export const DEFAULT_REENGAGEMENT_PROMPT = `Write a friendly, casual check-in email to {{contact_name}}.

Tone: Warm and personal, not corporate or salesy
Length: 2-3 short paragraphs

Include:
- A warm greeting noting it's been a while since we connected
- Reference to something from our last conversation (if known)
- An open invitation to catch up or discuss anything on their mind
- A friendly sign-off

Keep it genuine and human - this should feel like a note from a colleague, not an automated message.`;

export interface ReengagementEmailResult {
  subject: string;
  body: string;
}

/**
 * Hook for health alert functionality
 * Provides re-engagement email generation via AI
 */
export function useHealthAlerts() {
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Generate a re-engagement email for a contact
   */
  const generateReengagementEmail = async (
    contact: ContactWithCallCount | { id: string; name: string | null; email: string },
    customPrompt?: string
  ): Promise<ReengagementEmailResult | null> => {
    setIsGenerating(true);

    try {
      const user = await requireUser();

      // Build the prompt with contact info substituted
      const contactName = contact.name || contact.email.split("@")[0];
      const prompt = (customPrompt || DEFAULT_REENGAGEMENT_PROMPT)
        .replace(/\{\{contact_name\}\}/gi, contactName)
        .replace(/\{\{contact_email\}\}/gi, contact.email);

      // Get recent call context if available (for better personalization)
      let callContext = "";
      if ("last_call_recording_id" in contact && contact.last_call_recording_id) {
        const { data: call } = await supabase
          .from("fathom_calls")
          .select("title, summary, recording_start_time")
          .eq("recording_id", contact.last_call_recording_id)
          .eq("user_id", user.id)
          .single();

        if (call) {
          const callDate = call.recording_start_time
            ? new Date(call.recording_start_time).toLocaleDateString()
            : "recently";
          callContext = `\n\nContext from last call (${call.title || "untitled"}, ${callDate}):\n${call.summary || "No summary available"}`;
        }
      }

      const fullPrompt = prompt + callContext + "\n\nGenerate the email with a subject line and body. Format as:\nSUBJECT: [subject]\n\n[body]";

      // Call OpenRouter via Supabase function for AI generation
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          prompt: fullPrompt,
          max_tokens: 500,
          temperature: 0.7,
        },
      });

      if (error) throw error;

      // Parse the response
      const content = data?.content || data?.text || "";
      
      // Extract subject and body
      const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
      const subject = subjectMatch?.[1]?.trim() || `Catching up with ${contactName}`;
      
      // Remove subject line from body
      const body = content
        .replace(/SUBJECT:\s*.+?(?:\n|$)/i, "")
        .trim();

      return { subject, body };
    } catch (error) {
      logger.error("Error generating re-engagement email", error);
      toast.error("Failed to generate email. Please try again.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Check if a contact is overdue based on threshold
   */
  const isContactOverdue = (
    lastSeenAt: string | null,
    thresholdDays: number = 14
  ): boolean => {
    if (!lastSeenAt) return true;
    const daysSince = Math.floor(
      (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince > thresholdDays;
  };

  /**
   * Calculate days since last contact
   */
  const daysSinceContact = (lastSeenAt: string | null): number | null => {
    if (!lastSeenAt) return null;
    return Math.floor(
      (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  return {
    generateReengagementEmail,
    isGenerating,
    isContactOverdue,
    daysSinceContact,
    DEFAULT_REENGAGEMENT_PROMPT,
  };
}
