import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSetupWizard } from '@/hooks/useSetupWizard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { wizardCompleted, loading: wizardLoading } = useSetupWizard();
  const location = useLocation();
  const [hasTranscripts, setHasTranscripts] = useState<boolean | null>(null);
  const [checkingTranscripts, setCheckingTranscripts] = useState(true);

  // Check if user has any synced transcripts
  useEffect(() => {
    async function checkTranscripts() {
      if (!user) {
        setCheckingTranscripts(false);
        return;
      }

      try {
        const { count, error } = await supabase
          .from('fathom_calls')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .limit(1);

        if (error) throw error;
        setHasTranscripts((count ?? 0) > 0);
      } catch {
        // On error, assume they have transcripts to not block navigation
        setHasTranscripts(true);
      } finally {
        setCheckingTranscripts(false);
      }
    }

    checkTranscripts();
  }, [user]);

  if (authLoading || wizardLoading || checkingTranscripts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Force setup wizard completion for first-time users
  // Redirect to /settings if wizard not completed AND not already on settings page
  if (!wizardCompleted && !location.pathname.startsWith('/settings')) {
    return <Navigate to="/settings" replace />;
  }

  // If wizard completed but no transcripts synced, redirect to sync tab
  // (unless already on home page, settings, chat, or content pages)
  if (wizardCompleted && hasTranscripts === false &&
      location.pathname !== '/' && 
      !location.pathname.startsWith('/settings') && 
      !location.pathname.startsWith('/chat') &&
      !location.pathname.startsWith('/content')) {
    return <Navigate to="/?tab=sync" replace />;
  }

  return <>{children}</>;
}
