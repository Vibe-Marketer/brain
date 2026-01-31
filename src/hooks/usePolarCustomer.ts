import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSafeUser } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';

/**
 * Polar customer management hook
 * 
 * Provides access to Polar customer ID and lazy customer creation.
 * If the user doesn't have a Polar customer yet, ensureCustomer()
 * will create one on demand.
 */
export interface UsePolarCustomerResult {
  /** Polar customer ID (null if not created yet) */
  customerId: string | null;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Whether customer creation is in progress */
  isCreating: boolean;
  /** Error if fetch or creation failed */
  error: Error | null;
  /** Ensure customer exists, create if needed. Returns customer ID. */
  ensureCustomer: () => Promise<string>;
}

/**
 * usePolarCustomer - Manage Polar customer state
 * 
 * Queries user_profiles for polar_customer_id.
 * If null, provides ensureCustomer() to create a Polar customer on demand.
 * 
 * @example
 * ```tsx
 * const { customerId, ensureCustomer, isCreating } = usePolarCustomer();
 * 
 * async function handleUpgrade() {
 *   const id = await ensureCustomer(); // Creates if needed
 *   // Now use id for checkout...
 * }
 * ```
 */
export function usePolarCustomer(): UsePolarCustomerResult {
  const queryClient = useQueryClient();
  const [creationError, setCreationError] = useState<Error | null>(null);
  
  // Query existing customer ID
  const {
    data: customerData,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['polar-customer'],
    queryFn: async () => {
      const { user, error: authError } = await getSafeUser();
      
      if (authError || !user) {
        logger.debug('No authenticated user for Polar customer check');
        return { customerId: null };
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('polar_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileError) {
        logger.error('Error fetching Polar customer ID', profileError);
        throw new Error(`Failed to fetch Polar customer: ${profileError.message}`);
      }
      
      return { customerId: profile?.polar_customer_id ?? null };
    },
    staleTime: 300000, // 5 minutes - customer ID rarely changes
    gcTime: 600000, // 10 minutes
  });
  
  // Mutation for creating customer
  const createCustomerMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { user, error: authError } = await getSafeUser();
      
      if (authError || !user) {
        throw new Error('Must be authenticated to create Polar customer');
      }
      
      // Get current session for Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }
      
      // Call polar-create-customer Edge Function
      const { data, error } = await supabase.functions.invoke('polar-create-customer', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        logger.error('Error creating Polar customer', error);
        throw new Error(`Failed to create Polar customer: ${error.message}`);
      }
      
      if (!data?.customerId) {
        throw new Error('No customer ID returned from Polar');
      }
      
      logger.info('Polar customer created/retrieved', { customerId: data.customerId, created: data.created });
      
      return data.customerId;
    },
    onSuccess: (customerId) => {
      // Update the query cache with new customer ID
      queryClient.setQueryData(['polar-customer'], { customerId });
      setCreationError(null);
    },
    onError: (error) => {
      setCreationError(error as Error);
    },
  });
  
  // Ensure customer exists, create if needed
  const ensureCustomer = useCallback(async (): Promise<string> => {
    // If we already have a customer ID, return it
    const existingId = customerData?.customerId;
    if (existingId) {
      return existingId;
    }
    
    // Create customer and return the ID
    return createCustomerMutation.mutateAsync();
  }, [customerData?.customerId, createCustomerMutation]);
  
  return {
    customerId: customerData?.customerId ?? null,
    isLoading,
    isCreating: createCustomerMutation.isPending,
    error: queryError as Error | null ?? creationError,
    ensureCustomer,
  };
}
