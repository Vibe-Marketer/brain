import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as SonnerToaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { DebugPanelProvider } from "@/components/debug-panel";
import Login from "@/pages/Login";
import OAuthCallback from "@/pages/OAuthCallback";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CallDetailPage } from "@/pages/CallDetailPage";
import { SharedCallView } from "@/pages/SharedCallView";
import OrganizationJoin from "@/pages/OrganizationJoin";
import WorkspaceJoin from "@/pages/WorkspaceJoin";
import OAuthConsentPage from "@/pages/OAuthConsentPage";

// Static import for landing page (always needed immediately)
import TranscriptsNew from "@/pages/TranscriptsNew";
import ImportPage from "@/pages/ImportPage";

// Lazy-loaded route pages (code-split for faster initial load)
const Analytics = React.lazy(() => import("@/pages/Analytics"));
const Settings = React.lazy(() => import("@/pages/Settings"));
const SortingTagging = React.lazy(() => import("@/pages/SortingTagging"));
const SharedWithMe = React.lazy(() => import("@/pages/SharedWithMe"));
const RoutingRulesPage = React.lazy(() => import("@/pages/RoutingRulesPage"));

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
        <DebugPanelProvider>
          <AuthProvider>
            <ThemeProvider>
              <Router>
                <Routes>
                  {/* Auth routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth" element={<Login />} />

                  {/* OAuth callback routes */}
                  <Route
                    path="/oauth/callback"
                    element={
                      <ProtectedRoute>
                        <OAuthCallback />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/oauth/callback/zoom"
                    element={
                      <ProtectedRoute>
                        <OAuthCallback />
                      </ProtectedRoute>
                    }
                  />

                  {/* OAuth consent page - public route, handles its own auth check internally */}
                  <Route path="/oauth/consent" element={<OAuthConsentPage />} />

                  {/* Main app routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <TranscriptsNew />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/transcripts"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <TranscriptsNew />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<div />}><Settings /></Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/:category"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<div />}><Settings /></Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sorting-tagging"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<div />}><SortingTagging /></Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sorting-tagging/:category"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<div />}><SortingTagging /></Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<div />}><Analytics /></Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics/:category"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<div />}><Analytics /></Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  {/* Shared with me page */}
                  <Route
                    path="/shared-with-me"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<div />}><SharedWithMe /></Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Legacy redirects */}
                  <Route
                    path="/workspaces"
                    element={<Navigate to="/" replace />}
                  />
                  <Route
                    path="/workspaces/:workspaceId"
                    element={<Navigate to="/" replace />}
                  />
                  <Route
                    path="/vaults"
                    element={<Navigate to="/" replace />}
                  />
                  <Route
                    path="/vaults/:workspaceId"
                    element={<Navigate to="/" replace />}
                  />
                  <Route
                    path="/agents"
                    element={<Navigate to="/" replace />}
                  />
                  <Route
                    path="/agents/:workspaceId"
                    element={<Navigate to="/" replace />}
                  />
                  <Route
                    path="/team"
                    element={<Navigate to="/workspaces" replace />}
                  />
                  <Route
                    path="/banks"
                    element={<Navigate to="/settings/organizations" replace />}
                  />

                  {/* Call detail route for search result navigation */}
                  <Route
                    path="/call/:callId"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <CallDetailPage />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Shared call view - public route with token-based access */}
                  <Route path="/s/:token" element={<SharedCallView />} />

                  {/* Organization join page */}
                  <Route path="/join/org/:token" element={<OrganizationJoin />} />

                  {/* Workspace join page - public-ish route (redirects to login if not authenticated) */}
                  <Route path="/join/workspace/:token" element={<WorkspaceJoin />} />

                  {/* Automation Rules routes */}
                  <Route
                    path="/automation-rules"
                    element={<Navigate to="/sorting-tagging/rules" replace />}
                  />
                  <Route
                    path="/automation-rules/new"
                    element={<Navigate to="/sorting-tagging/rules" replace />}
                  />
                  <Route
                    path="/automation-rules/:id"
                    element={<Navigate to="/sorting-tagging/rules" replace />}
                  />
                  <Route
                    path="/automation-rules/:id/history"
                    element={<Navigate to="/sorting-tagging/rules" replace />}
                  />

                  {/* Manual Import route */}
                  <Route
                    path="/import"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <ImportPage />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Routing Rules route */}
                  <Route
                    path="/rules"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<div />}><RoutingRulesPage /></Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <SonnerToaster position="bottom-right" richColors />
              </Router>
            </ThemeProvider>
          </AuthProvider>
        </DebugPanelProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
