import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Profile from "./pages/Profile.tsx";
import Apply from "./pages/Apply.tsx";
import Admin from "./pages/Admin.tsx";
import Notifications from "./pages/Notifications.tsx";
import AdminAudit from "./pages/AdminAudit.tsx";
import ApplicationsHistory from "./pages/ApplicationsHistory.tsx";
import Messages from "./pages/Messages.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import Settings from "./pages/Settings.tsx";
import Terms from "./pages/Terms.tsx";
import Disclaimer from "./pages/Disclaimer.tsx";
import Privacy from "./pages/Privacy.tsx";
import { ChatBubble } from "./components/ai/ChatBubble";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/apply/:slug" element={<Apply />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/applications" element={<ApplicationsHistory />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/privacy" element={<Privacy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ChatBubble />
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
