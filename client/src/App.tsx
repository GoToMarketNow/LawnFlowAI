import { useState, useCallback } from "react";
import { Switch, Route, useLocation, Redirect, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DrawerProvider } from "@/lib/drawer-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch, SearchTrigger } from "@/components/global-search";
import { ContextualDrawer } from "@/components/contextual-drawer";
import { ErrorBoundary } from "@/components/error-boundary";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { getPageTitle } from "@/lib/ui/nav";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Dashboard from "@/pages/dashboard";
import InboxPage from "@/pages/inbox";
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
import ViewsPage from "@/pages/views";
import SmsSessionsPage from "@/pages/sms-sessions";
import PricingControlCenter from "@/pages/pricing-control-center";
import QuoteBuilder from "@/pages/quote-builder";
import QuotesPage from "@/pages/quotes";
import OpsDashboard from "@/pages/ops-dashboard";
import LearningDashboard from "@/pages/learning";
import CommsStudio from "@/pages/comms-studio";
import SchedulePage from "@/pages/schedule";
import CustomersPage from "@/pages/customers";
import CrewsPage from "@/pages/crews";
import CrewDetailPage from "@/pages/crew-detail";
import ZonesPage from "@/pages/zones";
import SettingsPage from "@/pages/settings";
import CrewInboxPage from "@/pages/crew-inbox";
import AgentSetupPage from "@/pages/agent-setup";
import HomePage from "@/pages/home";
import WorkQueuePage from "@/pages/work-queue";
import ApprovalsPage from "@/pages/approvals";
import SettingsAgentsPage from "@/pages/settings/agents";
import SettingsPoliciesPage from "@/pages/settings/policies";
import SettingsPricingPage from "@/pages/settings/pricing";
import SettingsIntegrationsPage from "@/pages/settings/integrations";
import SettingsObservabilityPage from "@/pages/settings/observability";
import SettingsExportsPage from "@/pages/settings/exports";
import SettingsServicesPage from "@/pages/settings/services";
import SettingsUsersPage from "@/pages/settings/users";
import SettingsTemplatesPage from "@/pages/settings/templates";
import SettingsBillingConfigPage from "@/pages/settings/billing-config";
import SettingsCommsStudioPage from "@/pages/settings/comms-studio";
import SettingsActiveCommsPage from "@/pages/settings/active-comms";
import BillingPage from "@/pages/billing";
import BillingInvoicesPage from "@/pages/billing-invoices";
import BillingPaymentsPage from "@/pages/billing-payments";
import BillingIssuesPage from "@/pages/billing-issues";
import NotFound from "@/pages/not-found";
import { Loader2, AlertCircle } from "lucide-react";
import { useUserRole } from "@/components/role-gate";
import { canAccess, accessLevels } from "@/lib/ui/tokens";
import { isFeatureEnabled } from "@/lib/feature-flags";

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

function QuickActions() {
  const userRole = useUserRole();
  const canCreateQuote = canAccess(userRole, accessLevels.operations);
  const canCreateJob = canAccess(userRole, accessLevels.fullAdmin);

  if (!canCreateQuote && !canCreateJob) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" data-testid="button-quick-actions">
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canCreateQuote && (
          <DropdownMenuItem asChild>
            <Link href="/quote-builder" data-testid="link-new-quote">
              New Quote
            </Link>
          </DropdownMenuItem>
        )}
        {canCreateJob && (
          <DropdownMenuItem asChild>
            <Link href="/jobs?action=new" data-testid="link-new-job">
              New Job
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AuthenticatedLayout() {
  const [location] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const userRole = useUserRole();
  
  const { data: onboarding } = useQuery<{ isOnboardingComplete: boolean }>({
    queryKey: ["/api/onboarding"],
    staleTime: 60000,
  });

  const pageTitle = getPageTitle(location);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  useKeyboardShortcuts({
    search: handleOpenSearch,
    close: handleCloseSearch,
    userRole,
  });

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar isOnboardingComplete={onboarding?.isOnboardingComplete ?? false} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <SetupBanner />
          <header className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 sticky top-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" aria-label="Toggle sidebar" />
              <h1 className="text-lg font-semibold hidden sm:block" data-testid="text-page-title">
                {pageTitle}
              </h1>
            </div>
            
            <div className="flex-1 flex justify-center max-w-xl mx-4">
              <SearchTrigger onClick={handleOpenSearch} />
            </div>
            
            <div className="flex items-center gap-2">
              <QuickActions />
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <ErrorBoundary>
              <div className="max-w-7xl mx-auto">
                <Switch>
                  {isFeatureEnabled('UI_REFACTOR_V1') ? (
                    <>
                      <Route path="/" component={HomePage} />
                      <Route path="/home" component={HomePage} />
                      <Route path="/dashboard">{() => <Redirect to="/home" />}</Route>
                      <Route path="/work" component={WorkQueuePage} />
                      <Route path="/inbox">{() => <Redirect to="/work" />}</Route>
                      <Route path="/approvals" component={ApprovalsPage} />
                      <Route path="/settings" component={SettingsPage} />
                      <Route path="/settings/agents" component={SettingsAgentsPage} />
                      <Route path="/settings/policies" component={SettingsPoliciesPage} />
                      <Route path="/settings/pricing" component={SettingsPricingPage} />
                      <Route path="/settings/integrations" component={SettingsIntegrationsPage} />
                      <Route path="/settings/observability" component={SettingsObservabilityPage} />
                      <Route path="/settings/exports" component={SettingsExportsPage} />
                      <Route path="/settings/services" component={SettingsServicesPage} />
                      <Route path="/settings/users" component={SettingsUsersPage} />
                      <Route path="/settings/templates" component={SettingsTemplatesPage} />
                      <Route path="/settings/billing-config" component={SettingsBillingConfigPage} />
                      <Route path="/settings/comms-studio" component={SettingsCommsStudioPage} />
                      <Route path="/settings/active-comms" component={SettingsActiveCommsPage} />
                      <Route path="/agents">{() => <Redirect to="/settings/agents" />}</Route>
                      <Route path="/agents/:id" component={AgentDetailPage} />
                      <Route path="/learning">{() => <Redirect to="/settings/policies" />}</Route>
                      <Route path="/pricing">{() => <Redirect to="/settings/pricing" />}</Route>
                      <Route path="/audit">{() => <Redirect to="/settings/observability" />}</Route>
                      <Route path="/billing" component={BillingPage} />
                      <Route path="/billing/invoices" component={BillingInvoicesPage} />
                      <Route path="/billing/payments" component={BillingPaymentsPage} />
                      <Route path="/billing/issues" component={BillingIssuesPage} />
                    </>
                  ) : (
                    <>
                      <Route path="/" component={Dashboard} />
                      <Route path="/dashboard" component={Dashboard} />
                      <Route path="/inbox" component={InboxPage} />
                      <Route path="/agents" component={AgentsPage} />
                      <Route path="/agents/:id" component={AgentDetailPage} />
                      <Route path="/settings" component={SettingsPage} />
                      <Route path="/pricing" component={PricingControlCenter} />
                      <Route path="/audit" component={AuditLogPage} />
                      <Route path="/learning" component={LearningDashboard} />
                    </>
                  )}
                  <Route path="/jobs" component={JobsPage} />
                  <Route path="/quotes" component={QuotesPage} />
                  <Route path="/quote-builder" component={QuoteBuilder} />
                  <Route path="/schedule" component={SchedulePage} />
                  <Route path="/customers" component={CustomersPage} />
                  <Route path="/customers/:id" component={ConversationDetailPage} />
                  <Route path="/operations/crews" component={CrewsPage} />
                  <Route path="/operations/crews/:id" component={CrewDetailPage} />
                  <Route path="/operations/zones" component={ZonesPage} />
                  <Route path="/crew-inbox" component={CrewInboxPage} />
                  <Route path="/profile" component={BusinessProfilePage} />
                  <Route path="/simulator" component={SimulatorPage} />
                  <Route path="/ops" component={OpsDashboard} />
                  <Route path="/comms" component={CommsStudio} />
                  <Route path="/admin/coverage" component={AdminCoveragePage} />
                  <Route path="/conversations" component={ConversationsPage} />
                  <Route path="/conversations/:id" component={ConversationDetailPage} />
                  <Route path="/actions" component={PendingActionsPage} />
                  <Route path="/events" component={EventsFeedPage} />
                  <Route path="/views" component={ViewsPage} />
                  <Route path="/sms" component={SmsSessionsPage} />
                  <Route path="/agent-setup" component={AgentSetupPage} />
                  <Route component={NotFound} />
                </Switch>
              </div>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <ContextualDrawer />
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
            <DrawerProvider>
              <AppRoutes />
            </DrawerProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
