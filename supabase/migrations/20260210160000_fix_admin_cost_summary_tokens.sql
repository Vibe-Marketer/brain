-- ==========================================================================
-- FIX ADMIN COST SUMMARY TOKEN AMBIGUITY
-- ==========================================================================
-- Purpose: Disambiguate total_tokens references inside get_admin_cost_summary
-- Author: OpenCode
-- Date: 2026-02-10
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_admin_cost_summary(
  p_period TEXT DEFAULT 'month'
)
RETURNS TABLE (
  model_breakdown JSONB,
  feature_breakdown JSONB,
  user_breakdown JSONB,
  total_cost_cents NUMERIC,
  total_tokens BIGINT,
  total_requests BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
BEGIN
  -- Get the calling user's ID
  v_user_id := auth.uid();

  -- Check if user is admin
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = v_user_id;

  -- Non-admin users get empty results
  IF v_user_role IS NULL OR v_user_role != 'ADMIN' THEN
    RETURN QUERY SELECT
      '[]'::JSONB,
      '[]'::JSONB,
      '[]'::JSONB,
      0::NUMERIC,
      0::BIGINT,
      0::BIGINT;
    RETURN;
  END IF;

  -- Calculate date range based on period
  v_end_date := NOW();

  CASE p_period
    WHEN 'month' THEN
      v_start_date := DATE_TRUNC('month', NOW());
    WHEN 'last_month' THEN
      v_start_date := DATE_TRUNC('month', NOW() - INTERVAL '1 month');
      v_end_date := DATE_TRUNC('month', NOW());
    WHEN 'all' THEN
      v_start_date := '1970-01-01'::TIMESTAMPTZ;
    ELSE
      v_start_date := DATE_TRUNC('month', NOW());
  END CASE;

  RETURN QUERY
  WITH filtered_logs AS (
    SELECT *
    FROM public.embedding_usage_logs
    WHERE created_at >= v_start_date
      AND created_at < v_end_date
  ),
  -- Aggregate by model
  model_agg AS (
    SELECT
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'model', model,
            'cost_cents', ROUND(total_cost::NUMERIC, 4),
            'requests', request_count,
            'tokens', token_count
          )
          ORDER BY total_cost DESC
        ),
        '[]'::JSONB
      ) AS breakdown
    FROM (
      SELECT
        model,
        SUM(cost_cents) AS total_cost,
        COUNT(*) AS request_count,
        SUM(fl.total_tokens) AS token_count
      FROM filtered_logs fl
      GROUP BY model
    ) m
  ),
  -- Aggregate by operation type (feature)
  feature_agg AS (
    SELECT
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'operation_type', operation_type,
            'cost_cents', ROUND(total_cost::NUMERIC, 4),
            'requests', request_count
          )
          ORDER BY total_cost DESC
        ),
        '[]'::JSONB
      ) AS breakdown
    FROM (
      SELECT
        operation_type,
        SUM(cost_cents) AS total_cost,
        COUNT(*) AS request_count
      FROM filtered_logs
      GROUP BY operation_type
    ) f
  ),
  -- Aggregate by user (top 20 by cost)
  user_agg AS (
    SELECT
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'user_id', u.user_id,
            'email', COALESCE(p.email, 'Unknown'),
            'cost_cents', ROUND(u.total_cost::NUMERIC, 4),
            'requests', u.request_count
          )
          ORDER BY u.total_cost DESC
        ),
        '[]'::JSONB
      ) AS breakdown
    FROM (
      SELECT
        fl.user_id,
        SUM(fl.cost_cents) AS total_cost,
        COUNT(*) AS request_count
      FROM filtered_logs fl
      GROUP BY fl.user_id
      ORDER BY SUM(fl.cost_cents) DESC
      LIMIT 20
    ) u
    LEFT JOIN public.user_profiles p ON p.user_id = u.user_id
  ),
  -- Calculate totals
  totals AS (
    SELECT
      COALESCE(SUM(cost_cents), 0) AS total_cost,
      COALESCE(SUM(fl.total_tokens), 0)::BIGINT AS total_tok,
      COUNT(*) AS total_req
    FROM filtered_logs fl
  )
  SELECT
    ma.breakdown,
    fa.breakdown,
    ua.breakdown,
    t.total_cost,
    t.total_tok,
    t.total_req
  FROM model_agg ma, feature_agg fa, user_agg ua, totals t;

END;
$$;

COMMENT ON FUNCTION public.get_admin_cost_summary IS 'Get admin-level cost aggregation across all users with breakdowns by model, feature, and user. Returns empty results for non-admin callers.';

-- ==========================================================================
-- END OF MIGRATION
-- ==========================================================================
