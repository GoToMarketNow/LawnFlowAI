import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebTabbedLayout } from "../components/web/tabbed-layout"
import { WebEmptyState } from "../components/web/empty-state"
import { WebLoadingSpinner } from "../components/web/loading-spinner"
import { WebProgressBar } from "../components/web/progress-bar"
import { WebErrorMessage } from "../components/web/error-message"
import { WebErrorPage } from "../components/web/error-page"
import { WebSkeleton, WebSkeletonCard, WebSkeletonTable, WebSkeletonList } from "../components/web/skeleton"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { WebInput } from "../components/web/input"
import { WebResponsiveContainer } from "../components/web/responsive-container"
import { WebDataTable, DataTableColumn } from "../components/web/data-table"
import { toast } from "sonner@2.0.3"
import {
  Plus,
  Search,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { cn } from "../components/ui/utils"

export default function StatesPage() {
  const [loadingProgress, setLoadingProgress] = React.useState(0)
  const [screenWidth, setScreenWidth] = React.useState<number>(1440)

  // Simulate progress
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLoadingProgress((prev) => (prev >= 100 ? 0 : prev + 5))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Track actual screen width
  React.useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    setScreenWidth(window.innerWidth)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Empty States Tab
  const EmptyStatesContent = () => (
    <div className="p-6 space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Empty State Variants</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* No Data */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">No Data</h4>
            </div>
            <div className="min-h-[300px] flex items-center justify-center">
              <WebEmptyState
                variant="no-data"
                title="No jobs yet"
                description="Create your first job to get started"
                actionLabel="Create Job"
                onAction={() => toast.success("Action triggered!")}
              />
            </div>
          </div>

          {/* No Results */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">No Results</h4>
            </div>
            <div className="min-h-[300px] flex items-center justify-center">
              <WebEmptyState
                variant="no-results"
                title="No results found"
                description="Try adjusting your filters or search query"
                actionLabel="Clear Filters"
                onAction={() => toast.info("Filters cleared")}
              />
            </div>
          </div>

          {/* No Access */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">No Access</h4>
            </div>
            <div className="min-h-[300px] flex items-center justify-center">
              <WebEmptyState
                variant="no-access"
                title="Access Restricted"
                description="You don't have permission to view this content"
                actionLabel="Request Access"
                onAction={() => toast.info("Access request sent")}
              />
            </div>
          </div>

          {/* Error State */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">Error State</h4>
            </div>
            <div className="min-h-[300px] flex items-center justify-center">
              <WebEmptyState
                variant="error"
                title="Failed to load"
                description="Something went wrong while loading this data"
                actionLabel="Retry"
                onAction={() => toast.info("Retrying...")}
              />
            </div>
          </div>

          {/* Success State */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">Success State</h4>
            </div>
            <div className="min-h-[300px] flex items-center justify-center">
              <WebEmptyState
                variant="success"
                title="All done!"
                description="You've completed all pending tasks"
              />
            </div>
          </div>

          {/* Coming Soon */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">Coming Soon</h4>
            </div>
            <div className="min-h-[300px] flex items-center justify-center">
              <WebEmptyState
                variant="no-data"
                title="Coming Soon"
                description="This feature is under development"
              />
            </div>
          </div>
        </div>
      </div>

      {/* In Context Examples */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Empty States in Context</h3>
        
        {/* Empty Table */}
        <div className="bg-card border border-border rounded-lg mb-6">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h4 className="font-medium">Customer List</h4>
              <p className="text-sm text-muted-foreground">Manage your customers</p>
            </div>
            <WebButton variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </WebButton>
          </div>
          <WebEmptyState
            variant="no-data"
            title="No customers yet"
            description="Add your first customer to get started with LawnFlow"
            actionLabel="Add Customer"
            onAction={() => toast.success("Opening customer form...")}
          />
        </div>

        {/* Empty Search Results */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <WebInput
                placeholder="Search jobs..."
                value="nonexistent query"
                readOnly
                className="pl-9"
              />
            </div>
          </div>
          <WebEmptyState
            variant="no-results"
            title="No jobs match your search"
            description="Try searching for something else or clear your filters"
            actionLabel="Clear Search"
            onAction={() => toast.info("Search cleared")}
          />
        </div>
      </div>
    </div>
  )

  // Loading States Tab
  const LoadingStatesContent = () => (
    <div className="p-6 space-y-8">
      {/* Spinners */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Loading Spinners</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]">
            <WebLoadingSpinner size="sm" variant="primary" />
            <p className="text-xs text-muted-foreground mt-3">Small</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]">
            <WebLoadingSpinner size="md" variant="primary" />
            <p className="text-xs text-muted-foreground mt-3">Medium</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]">
            <WebLoadingSpinner size="lg" variant="primary" />
            <p className="text-xs text-muted-foreground mt-3">Large</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]">
            <WebLoadingSpinner size="xl" variant="primary" label="Loading..." />
            <p className="text-xs text-muted-foreground mt-3">X-Large with Label</p>
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Progress Indicators</h3>
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <WebProgressBar
            value={loadingProgress}
            label="Upload Progress"
            showPercentage
            variant="primary"
          />
          <WebProgressBar
            value={75}
            label="Completion Status"
            showPercentage
            variant="success"
          />
          <WebProgressBar
            value={45}
            label="Storage Used"
            showPercentage
            variant="warning"
          />
          <WebProgressBar
            value={0}
            label="Processing..."
            indeterminate
            variant="primary"
          />
          <div className="grid grid-cols-3 gap-4">
            <WebProgressBar value={30} size="sm" showPercentage />
            <WebProgressBar value={60} size="md" showPercentage />
            <WebProgressBar value={90} size="lg" showPercentage />
          </div>
        </div>
      </div>

      {/* Skeleton Loaders */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Skeleton Loaders</h3>
        <div className="space-y-6">
          {/* Skeleton Card */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Card Skeleton</h4>
            <WebSkeletonCard />
          </div>

          {/* Skeleton Table */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Table Skeleton</h4>
            <WebSkeletonTable rows={5} columns={4} />
          </div>

          {/* Skeleton List */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">List Skeleton</h4>
            <WebSkeletonList items={4} />
          </div>

          {/* Custom Skeleton Layout */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Custom Skeleton</h4>
            <div className="flex gap-4">
              <WebSkeleton className="w-16 h-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <WebSkeleton className="h-4 w-1/4" />
                <WebSkeleton className="h-3 w-full" />
                <WebSkeleton className="h-3 w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading in Context */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Loading States in Context</h3>
        
        {/* Loading Page */}
        <div className="bg-card border border-border rounded-lg min-h-[400px] flex items-center justify-center">
          <WebLoadingSpinner size="xl" variant="primary" label="Loading page..." />
        </div>
      </div>
    </div>
  )

  // Error States Tab
  const ErrorStatesContent = () => (
    <div className="p-6 space-y-8">
      {/* Inline Errors */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Inline Error Messages</h3>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <WebInput type="email" value="invalid-email" readOnly />
            <WebErrorMessage
              severity="error"
              message="Please enter a valid email address"
              inline
              className="mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <WebInput type="password" value="123" readOnly />
            <WebErrorMessage
              severity="warning"
              message="Password must be at least 8 characters"
              inline
              className="mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <WebInput value="john_smith" readOnly />
            <WebErrorMessage
              severity="info"
              message="This username is available"
              inline
              className="mt-2"
            />
          </div>
        </div>
      </div>

      {/* Block Error Messages */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Block Error Messages</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <WebErrorMessage
            severity="error"
            title="Connection Failed"
            message="Unable to connect to the server. Please check your internet connection and try again."
            onRetry={() => toast.info("Retrying...")}
            onDismiss={() => toast.info("Dismissed")}
          />
          <WebErrorMessage
            severity="warning"
            title="Storage Almost Full"
            message="You're using 95% of your storage quota. Consider archiving old data."
            onDismiss={() => toast.info("Dismissed")}
          />
          <WebErrorMessage
            severity="info"
            title="Maintenance Scheduled"
            message="System maintenance is scheduled for tonight from 2-4 AM EST."
            onDismiss={() => toast.info("Dismissed")}
          />
        </div>
      </div>

      {/* Page-Level Errors */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Page-Level Error States</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">404 - Not Found</h4>
            </div>
            <WebErrorPage
              type="404"
              onGoHome={() => toast.info("Going home...")}
            />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">403 - Access Denied</h4>
            </div>
            <WebErrorPage
              type="403"
              onGoHome={() => toast.info("Going home...")}
            />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">500 - Server Error</h4>
            </div>
            <WebErrorPage
              type="500"
              onRetry={() => toast.info("Retrying...")}
              onGoHome={() => toast.info("Going home...")}
            />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium">Offline</h4>
            </div>
            <WebErrorPage
              type="offline"
              onRetry={() => toast.info("Checking connection...")}
            />
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Toast Notifications</h3>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Click the buttons below to see toast notifications
          </p>
          <div className="flex flex-wrap gap-3">
            <WebButton
              variant="primary"
              size="sm"
              onClick={() => toast.success("Operation completed successfully!")}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Success Toast
            </WebButton>
            <WebButton
              variant="destructive"
              size="sm"
              onClick={() => toast.error("An error occurred. Please try again.")}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Error Toast
            </WebButton>
            <WebButton
              variant="secondary"
              size="sm"
              onClick={() => toast.warning("Warning: This action cannot be undone.")}
            >
              Warning Toast
            </WebButton>
            <WebButton
              variant="secondary"
              size="sm"
              onClick={() => toast.info("New update available. Refresh to see changes.")}
            >
              Info Toast
            </WebButton>
            <WebButton
              variant="secondary"
              size="sm"
              onClick={() => {
                toast.promise(
                  new Promise((resolve) => setTimeout(resolve, 2000)),
                  {
                    loading: "Processing...",
                    success: "Process completed!",
                    error: "Process failed.",
                  }
                )
              }}
            >
              Promise Toast
            </WebButton>
          </div>
        </div>
      </div>
    </div>
  )

  // Responsive Tab
  const ResponsiveContent = () => {
    const breakpoints = [
      { name: "Minimum", width: 1024, icon: <Tablet className="w-4 h-4" /> },
      { name: "Desktop (Primary)", width: 1440, icon: <Monitor className="w-4 h-4" /> },
      { name: "Wide Desktop", width: 1920, icon: <Monitor className="w-4 h-4" /> },
    ]

    const sampleData = [
      { id: "1", name: "John Smith", email: "john@example.com", role: "Admin", status: "Active" },
      { id: "2", name: "Sarah Johnson", email: "sarah@example.com", role: "User", status: "Active" },
      { id: "3", name: "Mike Davis", email: "mike@example.com", role: "User", status: "Inactive" },
    ]

    const columns: DataTableColumn<typeof sampleData[0]>[] = [
      { id: "name", header: "Name", render: (_, row) => row.name },
      { id: "email", header: "Email", render: (_, row) => row.email },
      { id: "role", header: "Role", render: (_, row) => <WebBadge variant="neutral" size="sm">{row.role}</WebBadge> },
      { id: "status", header: "Status", render: (_, row) => (
        <WebBadge variant="status" status={row.status === "Active" ? "active" : "inactive"} size="sm">
          {row.status}
        </WebBadge>
      )},
    ]

    return (
      <div className="p-6 space-y-8">
        {/* Current Screen Info */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Current Screen Size</h3>
              <p className="text-sm text-muted-foreground">
                Resize your browser window to see responsive behavior
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold">{screenWidth}px</p>
              <p className="text-sm text-muted-foreground">
                {screenWidth >= 1920 ? "Wide Desktop" : screenWidth >= 1440 ? "Desktop (Primary)" : screenWidth >= 1024 ? "Minimum Supported" : "Below Minimum"}
              </p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min((screenWidth / 1920) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Breakpoints */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Supported Breakpoints</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {breakpoints.map((bp) => (
              <div
                key={bp.width}
                className={cn(
                  "bg-card border-2 rounded-lg p-4 transition-all",
                  screenWidth >= bp.width
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {bp.icon}
                  <h4 className="font-medium">{bp.name}</h4>
                </div>
                <p className="text-2xl font-semibold mb-1">{bp.width}px</p>
                <p className="text-xs text-muted-foreground">
                  {screenWidth >= bp.width ? "✓ Active" : "Inactive"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Container Examples */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Responsive Containers</h3>
          
          {/* Default Container (1440px) */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-3">Default Container (1440px max)</h4>
            <div className="bg-muted/30 p-4 rounded-lg">
              <WebResponsiveContainer maxWidth="default">
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 text-center">
                  <p className="font-medium">Primary Desktop Container</p>
                  <p className="text-sm text-muted-foreground">Max width: 1440px</p>
                </div>
              </WebResponsiveContainer>
            </div>
          </div>

          {/* Wide Container (1920px) */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-3">Wide Container (1920px max)</h4>
            <div className="bg-muted/30 p-4 rounded-lg">
              <WebResponsiveContainer maxWidth="wide">
                <div className="bg-success/10 border border-success/30 rounded-lg p-6 text-center">
                  <p className="font-medium">Wide Desktop Container</p>
                  <p className="text-sm text-muted-foreground">Max width: 1920px</p>
                </div>
              </WebResponsiveContainer>
            </div>
          </div>

          {/* Full Width */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-3">Full Width Container</h4>
            <div className="bg-muted/30 p-4 rounded-lg">
              <WebResponsiveContainer maxWidth="full">
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 text-center">
                  <p className="font-medium">Full Width Container</p>
                  <p className="text-sm text-muted-foreground">No max width constraint</p>
                </div>
              </WebResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Responsive Grid */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Responsive Grid System</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Card {i + 1}</h4>
                  <WebBadge variant="neutral" size="sm">New</WebBadge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Responsive grid card content
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Grid columns: 1 (mobile) → 2 (tablet) → 3 (desktop) → 4 (wide desktop)
          </p>
        </div>

        {/* Responsive Table */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Responsive Data Table</h3>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <WebDataTable
              columns={columns}
              data={sampleData}
              keyField="id"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Tables maintain horizontal scroll on smaller screens while keeping headers visible
          </p>
        </div>

        {/* Design Guidelines */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Responsive Design Guidelines</h3>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Primary Target: 1440px Desktop</p>
                <p className="text-muted-foreground">Optimize layouts and component sizing for 1440px screens first</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Wide Desktop Support: 1920px</p>
                <p className="text-muted-foreground">Utilize additional space with wider containers and more columns</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Minimum Supported: 1024px</p>
                <p className="text-muted-foreground">Ensure all features remain accessible and usable at minimum width</p>
              </div>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Below 1024px: Degraded Experience</p>
                <p className="text-muted-foreground">Show warning message encouraging users to use a larger screen</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    {
      id: "empty",
      label: "Empty States",
      content: <EmptyStatesContent />,
    },
    {
      id: "loading",
      label: "Loading States",
      content: <LoadingStatesContent />,
    },
    {
      id: "error",
      label: "Error States",
      content: <ErrorStatesContent />,
    },
    {
      id: "responsive",
      label: "Responsive",
      content: <ResponsiveContent />,
    },
  ]

  return (
    <WebAppShell
      pageTitle="States"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Page Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-card">
          <div className="max-w-[1440px] mx-auto">
            <h2 className="text-2xl font-semibold mb-2">Global UI States</h2>
            <p className="text-muted-foreground">
              Comprehensive demonstration of empty, loading, error states and responsive behavior
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden bg-background">
          <WebTabbedLayout tabs={tabs} defaultTab="empty" />
        </div>
      </div>
    </WebAppShell>
  )
}