-- Enforce Team self-serve member cap at the database boundary.
-- Team includes up to 10 active members, with pending org invites reserving seats.

CREATE OR REPLACE FUNCTION public.get_org_billing_tier(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id TEXT;
  v_status TEXT;
  v_period_end TIMESTAMPTZ;
BEGIN
  SELECT up.product_id, up.subscription_status, up.current_period_end
  INTO v_product_id, v_status, v_period_end
  FROM organization_memberships om
  JOIN user_profiles up ON up.user_id = om.user_id
  WHERE om.organization_id = p_org_id
    AND om.role = 'organization_owner'
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF v_product_id IS NULL THEN
    RETURN 'free';
  END IF;

  IF v_product_id = 'pro-trial' THEN
    IF v_status = 'trialing' AND (v_period_end IS NULL OR v_period_end >= NOW()) THEN
      RETURN 'pro';
    END IF;
    RETURN 'free';
  END IF;

  IF v_product_id IN (
    '30020903-fa8f-4534-9cf1-6e9fba26584c',
    '9ff62255-446c-41fe-a84d-c04aed23725c'
  ) AND v_status IN ('active', 'trialing') THEN
    RETURN 'pro';
  END IF;

  IF v_product_id IN (
    '88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7',
    '6a1bcf14-86b4-4ec9-bcbe-660bb714b19f'
  ) AND v_status IN ('active', 'trialing') THEN
    RETURN 'team';
  END IF;

  RETURN 'free';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_org_reserved_member_count(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*)::INTEGER
    FROM organization_memberships
    WHERE organization_id = p_org_id
  ) + (
    SELECT COUNT(*)::INTEGER
    FROM organization_invitations
    WHERE organization_id = p_org_id
      AND status = 'pending'
      AND expires_at > NOW()
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_team_org_invite_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_org_billing_tier(NEW.organization_id) = 'team'
    AND public.get_org_reserved_member_count(NEW.organization_id) >= 10 THEN
    RAISE EXCEPTION 'Team plan member limit reached. Contact support to add more seats.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_team_org_member_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_members INTEGER;
BEGIN
  IF public.get_org_billing_tier(NEW.organization_id) != 'team' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_active_members
  FROM organization_memberships
  WHERE organization_id = NEW.organization_id;

  IF v_active_members >= 10 THEN
    RAISE EXCEPTION 'Team plan member limit reached. Contact support to add more seats.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_team_org_invite_cap_trigger ON public.organization_invitations;
CREATE TRIGGER enforce_team_org_invite_cap_trigger
  BEFORE INSERT ON public.organization_invitations
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.enforce_team_org_invite_cap();

DROP TRIGGER IF EXISTS enforce_team_org_member_cap_trigger ON public.organization_memberships;
CREATE TRIGGER enforce_team_org_member_cap_trigger
  BEFORE INSERT ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_team_org_member_cap();

COMMENT ON FUNCTION public.get_org_billing_tier(UUID) IS
  'Returns free/pro/team from the org owner subscription fields using real Polar product UUIDs.';
COMMENT ON FUNCTION public.get_org_reserved_member_count(UUID) IS
  'Counts active organization members plus non-expired pending invitations.';
COMMENT ON COLUMN public.user_profiles.product_id IS
  'Polar product UUID identifying paid plan, or pro-trial for the signup trial.';
