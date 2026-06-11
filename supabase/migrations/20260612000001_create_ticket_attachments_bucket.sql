-- Migration: Create private ticket-attachments Storage bucket + RLS
-- Purpose: CAP-01 / D-04 — support-ticket screenshots (and console-log JSON)
--          upload to a PRIVATE bucket. Reporters may only write/read inside
--          their own `{auth.uid()}/...` folder; admins may read everything
--          via the existing public.has_role SECURITY DEFINER helper (same
--          idiom as the ticket tables' RLS, 20260611000002). No UPDATE or
--          DELETE policies — attachments are immutable, consistent with the
--          append-only ticket audit posture.
-- Author: Phase 15 Plan 01 (support-capture-fix)
-- Date: 2026-06-12

-- ============================================================================
-- BUCKET: ticket-attachments (private)
-- ============================================================================
-- 5MB cap + closed MIME allowlist (screenshots as jpeg/png/webp, console
-- buffers as application/json) bound hostile/oversized uploads (T-15-04).
-- Column set (id, name, public, file_size_limit, allowed_mime_types) verified
-- against the live hosted storage.buckets schema before this migration was
-- written (Assumption A1 confirmed 2026-06-11).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS POLICIES on storage.objects (scoped to bucket_id = 'ticket-attachments')
-- ============================================================================
-- RLS is already enabled on storage.objects by Supabase. CREATE POLICY works
-- from hosted migrations; ALTER on storage tables does not.

-- Reporters may upload ONLY into their own folder: the first path segment
-- must equal their auth.uid() (T-15-02 tampering control).
CREATE POLICY "Users can upload own ticket attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reporters read their own objects; admins read all (T-15-03 disclosure
-- control — bucket is private, so signed URLs under these policies are the
-- only access path).
CREATE POLICY "Users and admins can read ticket attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'ADMIN')
    )
  );

-- No UPDATE/DELETE policies: attachments are immutable once uploaded.

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- (storage.buckets/storage.objects are Supabase-owned tables — table/column
-- comments are not applied here; policy intent is documented inline above.)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
