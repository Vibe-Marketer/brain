/**
 * Content Persistence Module
 *
 * Handles saving generated hooks and content items to the database
 * when the Content Hub wizard completes.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Hook, StreamingContent } from '@/types/content-hub';

/**
 * Result of a save operation
 */
export interface SaveResult {
  success: boolean;
  savedHookIds: string[];
  savedContentIds: string[];
  errors: string[];
}

/**
 * Save wizard-generated content to the database
 *
 * Saves selected hooks to the hooks table, then saves associated
 * posts and emails to the content_items table with proper FK relationships.
 *
 * @param selectedHookIds - IDs of hooks the user selected
 * @param generatedHooks - All generated hooks from the wizard
 * @param generatedContent - Content generated for each hook (posts/emails)
 * @returns SaveResult with success status and saved IDs
 */
export async function saveWizardContent(
  selectedHookIds: string[],
  generatedHooks: Hook[],
  generatedContent: Record<string, StreamingContent>
): Promise<SaveResult> {
  const result: SaveResult = {
    success: true,
    savedHookIds: [],
    savedContentIds: [],
    errors: [],
  };

  // Get current user - MUST use getUser(), not auth.uid()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ...result,
      success: false,
      errors: ['Not authenticated. Please log in and try again.'],
    };
  }

  // Filter to only selected hooks
  const hooksToSave = generatedHooks.filter((h) => selectedHookIds.includes(h.id));

  if (hooksToSave.length === 0) {
    return {
      ...result,
      success: false,
      errors: ['No hooks selected to save.'],
    };
  }

  // Save hooks first (parent records), then content items (children)
  for (const hook of hooksToSave) {
    // Insert hook into database
    const { data: savedHook, error: hookError } = await supabase
      .from('hooks')
      .insert({
        user_id: user.id,
        hook_text: hook.hook_text,
        recording_id: hook.recording_id || null,
        emotion_category: hook.emotion_category || null,
        virality_score: hook.virality_score || null,
        topic_hint: hook.topic_hint || null,
        status: 'selected', // Mark as selected since user chose this hook
        is_starred: false,
      })
      .select('id')
      .single();

    if (hookError) {
      result.errors.push(`Failed to save hook: ${hookError.message}`);
      result.success = false;
      continue; // Try to save other hooks even if one fails
    }

    result.savedHookIds.push(savedHook.id);

    // Get content for this hook
    const content = generatedContent[hook.id];
    if (!content) {
      continue; // No content generated for this hook
    }

    // Save social post (content_type = 'post')
    if (content.social_post_text && content.social_post_text.trim()) {
      const { data: savedPost, error: postError } = await supabase
        .from('content_items')
        .insert({
          user_id: user.id,
          hook_id: savedHook.id, // Use NEW database ID, not client-side ID
          content_type: 'post' as const,
          content_text: content.social_post_text,
          email_subject: null, // MUST be null for posts (database constraint)
          status: 'draft' as const,
        })
        .select('id')
        .single();

      if (postError) {
        result.errors.push(`Failed to save post: ${postError.message}`);
      } else if (savedPost) {
        result.savedContentIds.push(savedPost.id);
      }
    }

    // Save email (content_type = 'email')
    if (content.email_body_opening && content.email_body_opening.trim()) {
      const { data: savedEmail, error: emailError } = await supabase
        .from('content_items')
        .insert({
          user_id: user.id,
          hook_id: savedHook.id,
          content_type: 'email' as const,
          content_text: content.email_body_opening,
          email_subject: content.email_subject || 'Untitled Email',
          status: 'draft' as const,
        })
        .select('id')
        .single();

      if (emailError) {
        result.errors.push(`Failed to save email: ${emailError.message}`);
      } else if (savedEmail) {
        result.savedContentIds.push(savedEmail.id);
      }
    }
  }

  // If we saved at least one hook but had some errors, still mark as success
  // but include errors for user awareness
  if (result.savedHookIds.length > 0 && result.errors.length > 0) {
    result.success = true; // Partial success
  }

  return result;
}
