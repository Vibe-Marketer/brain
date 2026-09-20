import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  hasPendingParticipationClaim,
  PARTICIPATION_CLAIM_ROUTE,
} from '@/lib/pending-participation-claim';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

  // OAuth and confirmation links return to the app root. Restore a pending
  // claim first, without moving its credential into router state or a query.
  // Limit restoration to root so a completed claim can remain on /events and
  // a separate pending share destination stays isolated.
  if (location.pathname === '/') {
    if (hasPendingParticipationClaim()) {
      return <Navigate to={PARTICIPATION_CLAIM_ROUTE} replace />;
    }

    const pendingToken = sessionStorage.getItem('pendingShareToken');
    if (pendingToken) {
      sessionStorage.removeItem('pendingShareToken');
      return <Navigate to={`/s/${pendingToken}`} replace />;
    }
  }

  return <>{children}</>;
}
