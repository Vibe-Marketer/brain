import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Settings from "./pages/Settings";
import TranscriptsNew from "./pages/TranscriptsNew";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";

// Optimized QueryClient configuration with smart caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute default stale time
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
      refetchOnWindowFocus: false, // Prevent refetch on window focus by default
      refetchOnReconnect: true, // Refetch when connection is restored
      retry: 1, // Only retry failed requests once
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1,
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

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
              <Sonner />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
