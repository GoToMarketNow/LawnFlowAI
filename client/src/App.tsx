import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/conversations" component={ConversationsPage} />
      <Route path="/conversations/:id" component={ConversationDetailPage} />
      <Route path="/actions" component={PendingActionsPage} />
      <Route path="/profile" component={BusinessProfilePage} />
      <Route path="/simulator" component={SimulatorPage} />
      <Route path="/jobs" component={JobsPage} />
      <Route path="/audit" component={AuditLogPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="lawnflow-ui-theme">
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto bg-background">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
