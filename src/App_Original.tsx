import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "./components/loop/AppShell";
import { AppShellV2 } from "./components/contextual";
import { DebugPanelProvider, DebugPanel } from "./components/debug-panel";
import { WorkspacesHome } from "./pages/WorkspacesHome";
import { WorkspacesPageV2 } from "./pages/WorkspacesPageV2";
import { CallsPageV2 } from "./pages/CallsPageV2";
import { InsightsPageV2 } from "./pages/InsightsPageV2";
import { InsightsPage } from "./pages/InsightsPage";
import { CallDetailPage } from "./pages/CallDetailPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { TranscriptsNewEnhanced } from "./pages/TranscriptsNewEnhanced";
import Settings from "./pages/Settings";
import TranscriptsNew from "./pages/TranscriptsNew";
import Chat from "./pages/Chat";
import SortingTagging from "./pages/SortingTagging";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";

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

const App = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <DebugPanelProvider>
              <TooltipProvider>
                <Routes>
                  {/* Auth routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth" element={<Login />} />
                  <Route path="/oauth/callback" element={<OAuthCallback />} />

                  {/* Main app routes with AppShellV2 (Contextual Panels) */}
                  <Route path="/" element={<ProtectedRoute><AppShellV2 /></ProtectedRoute>}>
                    <Route index element={<WorkspacesPageV2 />} />
                    <Route path="recent" element={<WorkspacesHome />} />
                    <Route path="ideas" element={<WorkspacesHome />} />
                    <Route path="favorites" element={<WorkspacesHome />} />
                    <Route path="workspace/:id" element={<TranscriptsNewEnhanced />} />
                    <Route path="call/:callId" element={<CallDetailPage />} />
                    <Route path="insights" element={<InsightsPageV2 />} />
                    <Route path="calls" element={<CallsPageV2 />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="library" element={<TranscriptsNew />} />
                    <Route path="tags" element={<TranscriptsNew />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="integrations" element={<Settings />} />
                    <Route path="transcripts" element={<TranscriptsNew />} />
                    <Route path="chat" element={<Chat />} />
                    <Route path="chat/:sessionId" element={<Chat />} />
                    <Route path="sorting-tagging" element={<SortingTagging />} />
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Toaster />
                <Sonner />
                <DebugPanel />
              </TooltipProvider>
            </DebugPanelProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
