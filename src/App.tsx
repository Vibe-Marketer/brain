import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
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
import TeamJoin from "@/pages/TeamJoin";
import VaultJoin from "@/pages/VaultJoin";
import OAuthConsentPage from "@/pages/OAuthConsentPage";

// Import existing pages
import TranscriptsNew from "@/pages/TranscriptsNew";
import SortingTagging from "@/pages/SortingTagging";
import Settings from "@/pages/Settings";
import Analytics from "@/pages/Analytics";
import SharedWithMe from "@/pages/SharedWithMe";
import VaultsPage from "@/pages/VaultsPage";

// Manual Import
import ManualImport from "@/pages/ManualImport";

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
                    path="/oauth/callback/meet"
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
                          <Settings />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/:category"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Settings />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sorting-tagging"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <SortingTagging />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sorting-tagging/:category"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <SortingTagging />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Analytics />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics/:category"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Analytics />
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
                          <SharedWithMe />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Vaults routes */}
                  <Route
                    path="/vaults"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <VaultsPage />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/vaults/:vaultId"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <VaultsPage />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Legacy team redirect */}
                  <Route
                    path="/team"
                    element={<Navigate to="/vaults" replace />}
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

                  {/* Team join page - public-ish route (redirects to login if not authenticated) */}
                  <Route path="/join/team/:token" element={<TeamJoin />} />

                  {/* Vault join page - public-ish route (redirects to login if not authenticated) */}
                  <Route path="/join/vault/:token" element={<VaultJoin />} />

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
                          <ManualImport />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <Toaster />
              </Router>
            </ThemeProvider>
          </AuthProvider>
        </DebugPanelProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
