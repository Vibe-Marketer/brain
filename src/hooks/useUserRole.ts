import { useState, useEffect } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

type UserRole = "FREE" | "PRO" | "TEAM" | "ADMIN";

interface UserRoleData {
  role: UserRole;
  loading: boolean;
  isAdmin: boolean;
  isTeam: boolean;
  isPro: boolean;
  isFree: boolean;
}

/**
 * Custom hook to fetch and track user role from user_roles table
 * Used for role-based UI rendering (tab visibility, feature access)
 * Uses secure get_user_role() function to prevent privilege escalation
 */
export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<UserRole>("FREE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { supabase } = await import("@/integrations/supabase/client");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          logger.warn("No authenticated user found");
          setRole("FREE");
          setLoading(false);
          return;
        }

        // Call the secure get_user_role() function
        const { data, error } = await supabase.rpc("get_user_role", {
          _user_id: user.id,
        });

        if (error) {
          logger.error("Error fetching user role", error);
          // Silently default to FREE - function may not exist yet or user has no role
          setRole("FREE");
          setLoading(false);
          return;
        }

        if (data) {
          setRole(data as UserRole);
        } else {
          // No role found, default to FREE
          setRole("FREE");
        }

        setLoading(false);
      } catch (error) {
        logger.error("Unexpected error in useUserRole", error);
        setRole("FREE");
        setLoading(false);
      }
    }

    fetchUserRole();
  }, []);

  return {
    role,
    loading,
    isAdmin: role === "ADMIN",
    isTeam: role === "TEAM",
    isPro: role === "PRO",
    isFree: role === "FREE",
  };
}
