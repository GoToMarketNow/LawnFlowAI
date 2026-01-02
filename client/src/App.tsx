import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import ConversationsPage from "@/pages/conversations";
import ConversationDetailPage from "@/pages/conversation-detail";
import PendingActionsPage from "@/pages/pending-actions";
import BusinessProfilePage from "@/pages/business-profile";
import SimulatorPage from "@/pages/simulator";
import JobsPage from "@/pages/jobs";
import AuditLogPage from "@/pages/audit-log";
import EventsFeedPage from "@/pages/events-feed";
import OnboardingPage from "@/pages/onboarding";
import AdminCoveragePage from "@/pages/admin-coverage";
import RegisterPage from "@/pages/register";
import LoginPage from "@/pages/login";
import VerifyPhonePage from "@/pages/verify-phone";
import AgentsPage from "@/pages/agents";
import AgentDetailPage from "@/pages/agent-detail";
import NotFound from "@/pages/not-found";
import { Loader2, AlertCircle } from "lucide-react";

function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: onboarding, isLoading } = useQuery<{ isOnboardingComplete: boolean }>({
    queryKey: ["/api/onboarding"],
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (location === "/onboarding") {
    return <>{children}</>;
  }

  if (onboarding && !onboarding.isOnboardingComplete) {
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}

function SetupBanner() {
  const { data: onboarding } = useQuery<{ isOnboardingComplete: boolean }>({
    queryKey: ["/api/onboarding"],
    staleTime: 60000,
  });

  if (onboarding?.isOnboardingComplete) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
      <AlertCircle className="h-4 w-4" />
      <span>Setup in progress - Complete onboarding to unlock all features</span>
    </div>
  );
}

function AuthenticatedLayout() {
  const { data: onboarding } = useQuery<{ isOnboardingComplete: boolean }>({
    queryKey: ["/api/onboarding"],
    staleTime: 60000,
  });

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar isOnboardingComplete={onboarding?.isOnboardingComplete ?? false} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <SetupBanner />
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" aria-label="Toggle sidebar" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/conversations" component={ConversationsPage} />
              <Route path="/conversations/:id" component={ConversationDetailPage} />
              <Route path="/actions" component={PendingActionsPage} />
              <Route path="/profile" component={BusinessProfilePage} />
              <Route path="/simulator" component={SimulatorPage} />
              <Route path="/jobs" component={JobsPage} />
              <Route path="/audit" component={AuditLogPage} />
              <Route path="/events" component={EventsFeedPage} />
              <Route path="/agents" component={AgentsPage} />
              <Route path="/agents/:id" component={AgentDetailPage} />
              <Route path="/admin/coverage" component={AdminCoveragePage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const publicPaths = ["/login", "/register", "/verify-phone"];
  const isPublicPath = publicPaths.includes(location);

  if (!isAuthenticated && !isPublicPath) {
    return <Redirect to="/login" />;
  }

  if (isAuthenticated && isPublicPath) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/register" component={RegisterPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/verify-phone" component={VerifyPhonePage} />
        <Route>
          <OnboardingCheck>
            <Switch>
              <Route path="/onboarding" component={OnboardingPage} />
              <Route component={AuthenticatedLayout} />
            </Switch>
          </OnboardingCheck>
        </Route>
      </Switch>
    </AuthGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="lawnflow-ui-theme">
        <TooltipProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
