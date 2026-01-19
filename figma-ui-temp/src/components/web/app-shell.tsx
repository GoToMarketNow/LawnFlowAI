import * as React from "react"
import { cn } from "../ui/utils"
import { WebSidebar, defaultSidebarSections } from "./sidebar"
import { WebTopBar, QuickAction } from "./top-bar"

export interface WebAppShellProps {
  children: React.ReactNode
  pageTitle?: string
  userRole?: string
  userName?: string
  userEmail?: string
  className?: string
}

const WebAppShell = React.forwardRef<HTMLDivElement, WebAppShellProps>(
  ({ children, pageTitle, userRole = "USER", userName, userEmail, className }, ref) => {
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
    const [darkMode, setDarkMode] = React.useState(false)
    const [showSearch, setShowSearch] = React.useState(false)

    // Apply dark mode
    React.useEffect(() => {
      if (darkMode) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }, [darkMode])

    // Quick actions configuration
    const quickActions: QuickAction[] = [
      {
        id: "new-job",
        label: "New Job",
        onClick: () => console.log("Create job"),
      },
      {
        id: "new-quote",
        label: "New Quote",
        onClick: () => console.log("Create quote"),
      },
    ]

    // Global search handler (Cmd+K)
    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault()
          setShowSearch(true)
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    return (
      <div ref={ref} className={cn("flex h-screen overflow-hidden", className)}>
        {/* Sidebar */}
        <WebSidebar
          sections={defaultSidebarSections}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          userRole={userRole}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <WebTopBar
            pageTitle={pageTitle}
            onSearchClick={() => setShowSearch(true)}
            quickActions={quickActions}
            notificationCount={3}
            onNotificationClick={() => console.log("Notifications")}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            userName={userName}
            userEmail={userEmail}
            onProfileClick={() => console.log("Profile")}
            onSettingsClick={() => console.log("Settings")}
            onLogoutClick={() => console.log("Logout")}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>

        {/* Global Search Modal */}
        {showSearch && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowSearch(false)}
            />
            <div className="relative w-full max-w-2xl bg-popover rounded-lg shadow-[var(--elevation-5)] border border-border">
              <div className="p-4">
                <input
                  type="text"
                  placeholder="Search jobs, customers, invoices..."
                  className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              <div className="border-t border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Start typing to search...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)
WebAppShell.displayName = "WebAppShell"

export { WebAppShell }
