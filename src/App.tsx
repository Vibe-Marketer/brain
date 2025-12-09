import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { DebugPanelProvider, DebugPanel } from "./components/debug-panel";
import Settings from "./pages/Settings";
import TranscriptsNew from "./pages/TranscriptsNew";
import Chat from "./pages/Chat";
import Categorization from "./pages/Categorization";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";
import TestVerification from "./pages/TestVerification";

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

                  {/* Main app routes */}
                  <Route path="/" element={<ProtectedRoute><Layout><TranscriptsNew /></Layout></ProtectedRoute>} />
                  <Route path="/transcripts" element={<ProtectedRoute><Layout><TranscriptsNew /></Layout></ProtectedRoute>} />
                  <Route path="/chat" element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>} />
                  <Route path="/chat/:sessionId" element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
                  <Route path="/categorization" element={<ProtectedRoute><Layout><Categorization /></Layout></ProtectedRoute>} />

                  {/* Test environment verification (only shows UI on test subdomain) */}
                  <Route path="/test-verification" element={<TestVerification />} />

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
