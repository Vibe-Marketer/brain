import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "./components/loop/AppShell";
import { DebugPanelProvider, DebugPanel } from "./components/debug-panel";
import { WorkspacesHome } from "./pages/WorkspacesHome";
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

                  {/* Main app routes with AppShell */}
                  <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                    <Route index element={<WorkspacesHome />} />
                    <Route path="recent" element={<WorkspacesHome />} />
                    <Route path="ideas" element={<WorkspacesHome />} />
                    <Route path="favorites" element={<WorkspacesHome />} />
                    <Route path="workspace/:id" element={<TranscriptsNewEnhanced />} />
                    <Route path="call/:callId" element={<CallDetailPage />} />
                    <Route path="insights" element={<InsightsPage />} />
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
