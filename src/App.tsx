import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from "@/components/Layout";
import Login from '@/pages/Login';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CallDetailPage } from '@/pages/CallDetailPage';
import { SharedCallView } from '@/pages/SharedCallView';

// Import existing pages
import TranscriptsNew from '@/pages/TranscriptsNew';
import Chat from '@/pages/Chat';
import SortingTagging from '@/pages/SortingTagging';
import Settings from '@/pages/Settings';
import LoopLayoutDemo from '@/pages/LoopLayoutDemo';
import SharedWithMe from '@/pages/SharedWithMe';
import CoachDashboard from '@/pages/CoachDashboard';
import CollaborationPage from '@/pages/CollaborationPage';

// Content Library pages
import { ContentLibraryPage } from '@/components/content-library/ContentLibraryPage';
import { TemplatesPage } from '@/components/content-library/TemplatesPage';

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
          <ThemeProvider>
            <Router>
                  <Routes>
                    {/* Auth routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth" element={<Login />} />
                    <Route path="/oauth/callback" element={<Login />} />

                    {/* Main app routes */}
                    <Route path="/" element={<ProtectedRoute><Layout><TranscriptsNew /></Layout></ProtectedRoute>} />
                    <Route path="/transcripts" element={<ProtectedRoute><Layout><TranscriptsNew /></Layout></ProtectedRoute>} />
                    <Route path="/chat" element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>} />
                    <Route path="/chat/:sessionId" element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
                    <Route path="/settings/:category" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
                    <Route path="/sorting-tagging" element={<ProtectedRoute><Layout><SortingTagging /></Layout></ProtectedRoute>} />
                    <Route path="/sorting-tagging/:category" element={<ProtectedRoute><Layout><SortingTagging /></Layout></ProtectedRoute>} />
                    <Route path="/loop" element={<Layout><LoopLayoutDemo /></Layout>} />

                    {/* Shared with me page */}
                    <Route path="/shared-with-me" element={<ProtectedRoute><Layout><SharedWithMe /></Layout></ProtectedRoute>} />

                    {/* Coach dashboard */}
                    <Route path="/coach" element={<ProtectedRoute><Layout><CoachDashboard /></Layout></ProtectedRoute>} />

                    {/* Collaboration routes */}
                    <Route path="/team" element={<ProtectedRoute><Layout><CollaborationPage /></Layout></ProtectedRoute>} />
                    <Route path="/coaches" element={<ProtectedRoute><Layout><CollaborationPage /></Layout></ProtectedRoute>} />

                    {/* Content Library routes */}
                    <Route path="/library" element={<ProtectedRoute><Layout><ContentLibraryPage /></Layout></ProtectedRoute>} />
                    <Route path="/templates" element={<ProtectedRoute><Layout><TemplatesPage /></Layout></ProtectedRoute>} />

                    {/* Call detail route for search result navigation */}
                    <Route path="/call/:callId" element={<ProtectedRoute><Layout><CallDetailPage /></Layout></ProtectedRoute>} />

                    {/* Shared call view - public route with token-based access */}
                    <Route path="/s/:token" element={<SharedCallView />} />

                    {/* 404 */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
              <Toaster />
            </Router>
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}


export default App;
