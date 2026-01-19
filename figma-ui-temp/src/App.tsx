import React from "react"
import { RouterProvider, useRouter } from "./lib/router"

// Import all page components
import HomePage from "./pages/home"
import WorkPage from "./pages/work"
import ApprovalsPage from "./pages/approvals"
import PendingActionsPage from "./pages/pending-actions"
import CustomersPage from "./pages/customers"
import CustomerSegmentsPage from "./pages/customer-segments"
import JobsPage from "./pages/jobs"
import QuotesPage from "./pages/quotes"
import SchedulePage from "./pages/schedule"
import CrewsPage from "./pages/operations/crews-enhanced"
import CrewMembersPage from "./pages/operations/crew-members"
import BillingPage from "./pages/billing"
import SupportPage from "./pages/support"
import KnowledgePage from "./pages/knowledge"
import AnalyticsPage from "./pages/analytics"
import AgentsPage from "./pages/agents"
import SettingsPage from "./pages/settings"
import CrewEligibilityDemoPage from "./pages/demo/crew-eligibility-control"

// Placeholder pages for routes without full implementations
import { WebAppShell } from "./components/web/app-shell"
import { WebPageHeader } from "./components/web/page-header"
import { WebEmptyState } from "./components/web/empty-state"

// Placeholder component for missing pages
function PlaceholderPage({ title, route }: { title: string; route: string }) {
  return (
    <WebAppShell pageTitle={title} userRole="ADMIN">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title={title}
          subtitle={`Route: ${route}`}
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: title },
          ]}
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <WebEmptyState
            variant="no-data"
            title={`${title} Page`}
            description="This page is under development"
          />
        </div>
      </div>
    </WebAppShell>
  )
}

// Main app routing component
function AppRouter() {
  const { currentPath } = useRouter()

  // Route mapping
  const routes: Record<string, React.ReactNode> = {
    "/home": <HomePage />,
    "/work": <WorkPage />,
    "/approvals": <ApprovalsPage />,
    "/actions": <PendingActionsPage />,
    "/customers": <CustomersPage />,
    "/customers/segments": <CustomerSegmentsPage />,
    "/jobs": <JobsPage />,
    "/quotes": <QuotesPage />,
    "/schedule": <SchedulePage />,
    "/operations/crews": <CrewsPage />,
    "/operations/crew-members": <CrewMembersPage />,
    "/billing": <BillingPage />,
    "/billing/invoices": <PlaceholderPage title="Invoices" route="/billing/invoices" />,
    "/billing/payments": <PlaceholderPage title="Payments" route="/billing/payments" />,
    "/billing/issues": <PlaceholderPage title="Billing Issues" route="/billing/issues" />,
    "/support/queue": <SupportPage />,
    "/support/gaps": <PlaceholderPage title="Coverage Gaps" route="/support/gaps" />,
    "/knowledge": <KnowledgePage />,
    "/knowledge/builder": <PlaceholderPage title="Knowledge Builder" route="/knowledge/builder" />,
    "/knowledge/approvals": <PlaceholderPage title="Knowledge Approvals" route="/knowledge/approvals" />,
    "/knowledge/reviews": <PlaceholderPage title="Knowledge Reviews" route="/knowledge/reviews" />,
    "/analytics": <AnalyticsPage />,
    "/agents": <AgentsPage />,
    "/events": <PlaceholderPage title="Agent Events" route="/events" />,
    "/settings": <SettingsPage />,
    "/demo/crew-eligibility-control": <CrewEligibilityDemoPage />,
  }

  // Render the current route or default to home
  return routes[currentPath] || routes["/home"]
}

// Main App component
export default function App() {
  return (
    <RouterProvider>
      <AppRouter />
    </RouterProvider>
  )
}