/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { logger } from '@/lib/logger';

// SEC-03C (Phase 38) — Cross-org cache clear on active-org switch.
//
// The existing handlers below already clear the cache on SIGNED_OUT and
// on account-switch SIGNED_IN. This subscription extends defense-in-depth
// to org-switch WITHIN the same account: when the user toggles between
// orgs in the org switcher, any cached call/folder/tag data from the
// previous org is purged so no Org A row ever surfaces in an Org B view.

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  queryClient: QueryClient;
}

export function AuthProvider({ children, queryClient }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Track the previous user ID so we can detect an account switch
  // (sign-in as a different user without an explicit sign-out between them).
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.debug('[AuthContext] Auth state changed:', event + ' ' + (session ? 'Session valid' : 'No session'));

        // Handle specific auth events
        if (event === 'SIGNED_OUT') {
          logger.debug('[AuthContext] User signed out — clearing query cache and org context');
          // Clear ALL cached server state so stale data from the previous
          // account never bleeds into a subsequent sign-in.
          queryClient.clear();
          useOrgContextStore.getState().reset();
          prevUserIdRef.current = null;
          setSession(null);
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED') {
          logger.debug('[AuthContext] Token refreshed successfully');
          setSession(session);
          setUser(session?.user ?? null);
        } else if (event === 'SIGNED_IN') {
          const incomingUserId = session?.user?.id ?? null;
          const prevUserId = prevUserIdRef.current;

          // If a different user is signing in (account switch without an
          // explicit sign-out), clear the cache and org context first.
          if (prevUserId !== null && prevUserId !== incomingUserId) {
            logger.debug('[AuthContext] Account switch detected — clearing query cache and org context');
            queryClient.clear();
            useOrgContextStore.getState().reset();
          }

          prevUserIdRef.current = incomingUserId;
          logger.debug('[AuthContext] User signed in');
          setSession(session);
          setUser(session?.user ?? null);
          // Load preferences fire-and-forget — do NOT await here.
          // Awaiting inside onAuthStateChange causes a Supabase auth lock
          // deadlock: the lock held by _notifyAllSubscribers is re-acquired
          // by loadPreferences → supabase.auth.getUser(), hanging forever.
          void usePreferencesStore.getState().loadPreferences();
        } else {
          // For other events (INITIAL_SESSION, etc.), update state
          setSession(session);
          setUser(session?.user ?? null);
        }

        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logger.error('[AuthContext] Error getting session:', error);
        setSession(null);
        setUser(null);
      } else {
        logger.debug('[AuthContext] Initial session loaded:', session ? 'Valid' : 'None');
        prevUserIdRef.current = session?.user?.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        // Load preferences fire-and-forget — do NOT await inside getSession().then().
        // Same deadlock risk as onAuthStateChange: supabase.auth.getUser() inside
        // loadPreferences re-acquires the auth lock that getSession() still holds.
        if (session) {
          void usePreferencesStore.getState().loadPreferences();
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // SEC-03C — Clear TanStack Query cache whenever the active organization
  // changes so Org A data never bleeds into the next Org B view.
  useEffect(() => {
    let prevOrgId = useOrgContextStore.getState().activeOrgId;
    const unsubscribe = useOrgContextStore.subscribe((state) => {
      const newOrgId = state.activeOrgId;
      if (prevOrgId !== null && prevOrgId !== newOrgId) {
        logger.debug('[AuthContext] Active org changed — clearing query cache');
        queryClient.clear();
      }
      prevOrgId = newOrgId;
    });
    return unsubscribe;
  }, [queryClient]);

  const signOut = async () => {
    // supabase.auth.signOut() triggers the SIGNED_OUT event in onAuthStateChange,
    // which handles cache clearing and org context reset.
    // We still set local state here for immediate UI response.
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
