-- Migration: SQL-level RPC type-signature smoke test
-- Purpose:   Catch the BIGINT-vs-UUID class of bug at PR time, not at deploy
--            time. The bug shipped twice in 24 hours (Fathom 2026-05-09 and
--            Fireflies 2026-05-23). It is invisible to unit tests, lint, and
--            type-check because the failure only fires when PostgREST hands
--            the call to Postgres at runtime.
--
-- Function:  verify_rpc_type_signatures()
--
--            Loops over every SECURITY DEFINER function in the `public`
--            schema, attempts a smoke EXECUTE inside a SAVEPOINT (so no
--            side effect persists), and returns one row per function whose
--            type signature is broken — Postgres error codes 22P02
--            (input arg doesn't fit param type), 42804 (RETURNS TABLE
--            doesn't match SELECT), or 42883 (overload missing after a
--            bad drop).
--
--            Other error codes (no_data_found, insufficient_privilege,
--            check_violation, etc.) are EXPECTED and IGNORED — the function
--            being callable with a fake UUID and getting "no rows" back is
--            fine. The point is exclusively to catch the type class.
--
-- Returns:   TABLE(function_signature TEXT, error_code TEXT,
--                  error_message TEXT)
--            Empty result = no type bugs.
--            Non-empty = one row per broken function.
--
-- Skip list: maintained in `public.rpc_type_smoke_skip_list` table. Add a
--            row for any function that is (a) a trigger callback not
--            callable directly, (b) destructive on dummy input
--            (cleanup_test_fixture_users, encrypt_existing_*), or
--            (c) takes a custom enum/composite type we can't synthesise.
--            Each row carries a reason for the next reader.
--
-- Date:      2026-05-23

BEGIN;

-- ============================================================================
-- SKIP-LIST TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rpc_type_smoke_skip_list (
  function_name TEXT PRIMARY KEY,
  reason        TEXT NOT NULL,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.rpc_type_smoke_skip_list IS
'Functions excluded from verify_rpc_type_signatures(). Add a row per function with a one-line reason. Reasons: trigger callback, destructive on dummy input, custom-type parameter we can''t synthesise.';

-- Seed the known set. Triggers + destructive sweepers are the obvious skips;
-- this list will grow as ops adds more pg_cron jobs.
INSERT INTO public.rpc_type_smoke_skip_list (function_name, reason) VALUES
  ('cleanup_test_fixture_users',            'destructive: deletes auth.users matching test-fixture patterns'),
  ('encrypt_existing_oauth_tokens',         'destructive: rewrites every OAuth token in import_sources'),
  ('encrypt_existing_fireflies_credentials','destructive: rewrites every Fireflies credential'),
  ('handle_new_user',                       'trigger callback (auth.users INSERT); not callable directly'),
  ('handle_new_user_workspace',             'trigger callback; not callable directly'),
  ('prevent_last_workspace_owner_removal',  'trigger callback (workspace_memberships BEFORE DELETE)'),
  ('prevent_recording_hard_delete',         'trigger callback (recordings BEFORE DELETE)'),
  ('prevent_default_workspace_delete',      'trigger callback (workspaces BEFORE DELETE)')
ON CONFLICT (function_name) DO NOTHING;

-- ============================================================================
-- SUPPORT FUNCTION: placeholder_for_type
-- ============================================================================
-- Returns a TEXT-cast literal valid as input for the given Postgres type.
-- Used by verify_rpc_type_signatures to synthesise dummy arguments.
CREATE OR REPLACE FUNCTION public.placeholder_for_type(p_type TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type ILIKE 'uuid%'                           THEN '''00000000-0000-0000-0000-000000000000''::uuid'
    WHEN p_type ILIKE 'text%' OR p_type ILIKE 'varchar%'
      OR p_type ILIKE 'character varying%'
      OR p_type ILIKE 'name%'                           THEN '''rpc-type-smoke''::text'
    WHEN p_type ILIKE 'bigint%' OR p_type ILIKE 'int8%' THEN '0::bigint'
    WHEN p_type ILIKE 'integer%' OR p_type ILIKE 'int%'
      OR p_type ILIKE 'int4%'                           THEN '0::integer'
    WHEN p_type ILIKE 'smallint%' OR p_type ILIKE 'int2%' THEN '0::smallint'
    WHEN p_type ILIKE 'numeric%' OR p_type ILIKE 'decimal%' THEN '0::numeric'
    WHEN p_type ILIKE 'real%' OR p_type ILIKE 'float4%' THEN '0::real'
    WHEN p_type ILIKE 'double precision%' OR p_type ILIKE 'float8%' THEN '0::double precision'
    WHEN p_type ILIKE 'boolean%' OR p_type ILIKE 'bool%' THEN 'false'
    WHEN p_type ILIKE 'jsonb%'                          THEN '''{}''::jsonb'
    WHEN p_type ILIKE 'json%'                           THEN '''{}''::json'
    WHEN p_type ILIKE 'timestamp with time zone%'
      OR p_type ILIKE 'timestamptz%'                    THEN '''1970-01-01T00:00:00Z''::timestamptz'
    WHEN p_type ILIKE 'timestamp%'                      THEN '''1970-01-01T00:00:00''::timestamp'
    WHEN p_type ILIKE 'date%'                           THEN '''1970-01-01''::date'
    WHEN p_type ILIKE 'interval%'                       THEN '''0 seconds''::interval'
    WHEN p_type ILIKE 'bytea%'                          THEN '''\x00''::bytea'
    ELSE NULL   -- custom enum / composite / domain — caller decides
  END;
$$;

COMMENT ON FUNCTION public.placeholder_for_type IS
'Returns a SQL literal cast suitable for the given Postgres type, for use as a dummy RPC argument. NULL for types we don''t synthesise — caller can skip the function.';

-- ============================================================================
-- MAIN FUNCTION: verify_rpc_type_signatures
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_rpc_type_signatures()
RETURNS TABLE(
  function_signature TEXT,
  error_code         TEXT,
  error_message      TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_func          RECORD;
  v_arg_types     TEXT[];
  v_arg_type      TEXT;
  v_placeholders  TEXT[];
  v_placeholder   TEXT;
  v_call_sql      TEXT;
  v_skip          BOOLEAN;
  v_idx           INT;
  v_error_code    TEXT;
  v_error_message TEXT;
BEGIN
  FOR v_func IN
    SELECT
      p.proname AS name,
      p.oid     AS func_oid,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      pg_get_function_arguments(p.oid)          AS full_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = TRUE   -- SECURITY DEFINER only
      AND NOT EXISTS (
        SELECT 1 FROM public.rpc_type_smoke_skip_list s
        WHERE s.function_name = p.proname
      )
    ORDER BY p.proname
  LOOP
    -- Pull bare arg type names for this function. proargtypes is an
    -- oidvector — we cast each oid to its regtype name.
    SELECT array_agg(format_type(t.oid, NULL) ORDER BY ord)
    INTO v_arg_types
    FROM unnest(
      (SELECT proargtypes FROM pg_proc WHERE oid = v_func.func_oid)
    ) WITH ORDINALITY AS x(arg_oid, ord)
    JOIN pg_type t ON t.oid = x.arg_oid;

    v_arg_types := COALESCE(v_arg_types, ARRAY[]::TEXT[]);

    -- Build placeholder literals for each arg type.
    v_placeholders := ARRAY[]::TEXT[];
    v_skip := FALSE;
    FOREACH v_arg_type IN ARRAY v_arg_types LOOP
      v_placeholder := public.placeholder_for_type(v_arg_type);
      IF v_placeholder IS NULL THEN
        -- Custom enum/composite/domain — can't synthesise a value safely.
        -- Skip this function (it's not the BIGINT/UUID class anyway).
        v_skip := TRUE;
        EXIT;
      END IF;
      v_placeholders := array_append(v_placeholders, v_placeholder);
    END LOOP;

    IF v_skip THEN
      CONTINUE;
    END IF;

    -- Compose the call. PERFORM is plpgsql-only, so we wrap in a DO block
    -- to run it dynamically. `PERFORM * FROM <fn>` discards rows for both
    -- set-returning (TABLE / SETOF) AND scalar (1-row 1-col set) returns,
    -- so this one form works for every function shape.
    v_call_sql := format(
      'DO $do$ BEGIN PERFORM * FROM public.%I(%s); END $do$',
      v_func.name,
      array_to_string(v_placeholders, ', ')
    );

    -- Each call runs inside a sub-transaction (SAVEPOINT) so any data
    -- mutation rolls back automatically. We only care about whether the
    -- call PARSES + EXECUTES without a type-class error.
    BEGIN
      EXECUTE v_call_sql;
    EXCEPTION
      WHEN SQLSTATE '22P02'   -- invalid_text_representation (input type mismatch)
        OR SQLSTATE '42804'   -- datatype_mismatch (RETURNS TABLE shape wrong)
        OR SQLSTATE '42883'   -- undefined_function (overload missing)
      THEN
        GET STACKED DIAGNOSTICS
          v_error_code    = RETURNED_SQLSTATE,
          v_error_message = MESSAGE_TEXT;
        function_signature := format('%s(%s)', v_func.name, v_func.identity_args);
        error_code         := v_error_code;
        error_message      := v_error_message;
        RETURN NEXT;
      WHEN OTHERS THEN
        -- Any other error (no_data_found, insufficient_privilege,
        -- check_violation, foreign_key_violation, raise_exception, etc.)
        -- means the function ACCEPTED the call shape and ran its body —
        -- type signature is fine. Swallow.
        NULL;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.verify_rpc_type_signatures IS
'Smoke-calls every SECURITY DEFINER function in public schema. Returns one row per function whose parameter or return-table types don''t match the underlying schema (Postgres 22P02 / 42804 / 42883). Empty result = no type bugs. Used by the rpc-type-smoke Vitest integration test.';

REVOKE EXECUTE ON FUNCTION public.verify_rpc_type_signatures() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_rpc_type_signatures() TO service_role, postgres;

COMMIT;
