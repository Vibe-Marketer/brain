import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoopShell } from '@/components/LoopShell';
import { WorkspacesPage } from '@/pages/WorkspacesPage';
import { CallsPage } from '@/pages/CallsPage';
import Login from '@/pages/Login';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Import existing pages
import TranscriptsNew from '@/pages/TranscriptsNew';
import Chat from '@/pages/Chat';
import SortingTagging from '@/pages/SortingTagging';
import Settings from '@/pages/Settings';

// Optimized QueryClient configuration with smart caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
      gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache
      refetchOnWindowFocus: false, // Prevent refetch on window focus by default
      retry: 1, // Only retry failed requests once
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes with LoopShell */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <LoopShell>
                      <Routes>
                        <Route path="/" element={<TranscriptsNew />} />
                        <Route path="/workspaces" element={<WorkspacesPage />} />
                        <Route path="/calls" element={<CallsPage />} />
                        <Route path="/insights" element={<div className="p-8"><h1 className="text-2xl font-bold">Insights Page</h1></div>} />
                        <Route path="/analytics" element={<div className="p-8"><h1 className="text-2xl font-bold">Analytics Page</h1></div>} />
                        <Route path="/chat" element={<Chat />} />
                        <Route path="/sorting-tagging" element={<SortingTagging />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </LoopShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
            <Toaster />
          </Router>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
