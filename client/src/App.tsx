import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
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
import RegisterPage from "@/pages/register";
import LoginPage from "@/pages/login";
import VerifyPhonePage from "@/pages/verify-phone";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

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

function MainLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/conversations" component={ConversationsPage} />
              <Route path="/conversations/:id" component={ConversationDetailPage} />
              <Route path="/actions" component={PendingActionsPage} />
              <Route path="/profile" component={BusinessProfilePage} />
              <Route path="/simulator" component={SimulatorPage} />
              <Route path="/jobs" component={JobsPage} />
              <Route path="/audit" component={AuditLogPage} />
              <Route path="/events" component={EventsFeedPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="lawnflow-ui-theme">
        <TooltipProvider>
          <Switch>
            <Route path="/register" component={RegisterPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/verify-phone" component={VerifyPhonePage} />
            <Route>
              <OnboardingCheck>
                <Switch>
                  <Route path="/onboarding" component={OnboardingPage} />
                  <Route component={MainLayout} />
                </Switch>
              </OnboardingCheck>
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
