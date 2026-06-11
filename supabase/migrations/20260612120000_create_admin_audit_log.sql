-- Migration: create_admin_audit_log (16-02)
-- Ported from worktree-admin-center (admin_center_foundation + admin_center_v2
-- posture), rebound to main's live role helper:
--   * is_admin() (branch-only) -> public.has_role(auth.uid(), 'ADMIN')
--   * append-only: NO client-reachable INSERT/UPDATE/DELETE policies.
--     Audit rows are written exclusively by edge functions using the
--     service-role client (bypasses RLS). The branch's "Admins can insert"
--     escape hatch was deliberately dropped in its v2 migration — an admin's
--     browser session must not be able to forge audit entries.
--   * SELECT is admin-only.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_type text NOT NULL CHECK (target_type IN ('user', 'ticket', 'system')),
    target_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read. has_role is SECURITY DEFINER (no RLS recursion).
DROP POLICY IF EXISTS "Admins can read admin audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read admin audit log"
    ON public.admin_audit_log FOR SELECT
    USING (public.has_role(auth.uid(), 'ADMIN'));

-- No INSERT/UPDATE/DELETE policies on purpose: service-role writes only,
-- append-only from every client-reachable path.

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
    ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
    ON public.admin_audit_log (action);

COMMENT ON TABLE public.admin_audit_log IS
    'Append-only audit trail for privileged admin actions (role changes, password resets, access revoke/restore). Written exclusively via service-role from edge functions; admin-only read.';
COMMENT ON COLUMN public.admin_audit_log.actor_user_id IS
    'The admin who performed the action (verified server-side from the JWT, never client-supplied).';
COMMENT ON COLUMN public.admin_audit_log.action IS
    'Action identifier, e.g. manage_user_change_role, manage_user_reset_password.';
COMMENT ON COLUMN public.admin_audit_log.target_type IS
    'What kind of entity was acted on: user, ticket, or system.';
COMMENT ON COLUMN public.admin_audit_log.metadata IS
    'Action-specific detail (e.g. new_role). Never contains secrets or passwords.';
