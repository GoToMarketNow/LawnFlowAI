import * as React from "react"
import { Search, Plus, Bell, Moon, Sun, User, Settings, LogOut } from "lucide-react"
import { cn } from "../ui/utils"
import { WebButton } from "./button"

export interface QuickAction {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
}

export interface WebTopBarProps {
  pageTitle?: string
  onSearchClick?: () => void
  quickActions?: QuickAction[]
  notificationCount?: number
  onNotificationClick?: () => void
  darkMode?: boolean
  onToggleDarkMode?: () => void
  userName?: string
  userEmail?: string
  onProfileClick?: () => void
  onSettingsClick?: () => void
  onLogoutClick?: () => void
  className?: string
}

const WebTopBar = React.forwardRef<HTMLDivElement, WebTopBarProps>(
  ({
    pageTitle,
    onSearchClick,
    quickActions = [],
    notificationCount = 0,
    onNotificationClick,
    darkMode = false,
    onToggleDarkMode,
    userName = "John Doe",
    userEmail = "john@example.com",
    onProfileClick,
    onSettingsClick,
    onLogoutClick,
    className,
  }, ref) => {
    const [showUserMenu, setShowUserMenu] = React.useState(false)
    const [showQuickActions, setShowQuickActions] = React.useState(false)
    const userMenuRef = React.useRef<HTMLDivElement>(null)
    const quickActionsRef = React.useRef<HTMLDivElement>(null)

    // Close menus when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
          setShowUserMenu(false)
        }
        if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
          setShowQuickActions(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
      <header
        ref={ref}
        className={cn(
          "h-16 bg-background border-b border-border flex items-center justify-between px-6 sticky top-0 z-40",
          className
        )}
      >
        {/* Left: Page Title */}
        <div className="flex-1 min-w-0">
          {pageTitle && (
            <h1 className="text-lg font-semibold text-foreground truncate">
              {pageTitle}
            </h1>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Global Search */}
          <button
            onClick={onSearchClick}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-input-background hover:bg-accent transition-colors text-sm text-muted-foreground min-w-[240px]"
          >
            <Search className="w-4 h-4" />
            <span>Search...</span>
            <kbd className="ml-auto px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
              ⌘K
            </kbd>
          </button>

          {/* Mobile Search */}
          <button
            onClick={onSearchClick}
            className="md:hidden p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Quick Actions */}
          {quickActions.length > 0 && (
            <div className="relative" ref={quickActionsRef}>
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
              {showQuickActions && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-lg shadow-[var(--elevation-3)] py-1">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => {
                        action.onClick()
                        setShowQuickActions(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors text-left"
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notification Bell */}
          <button
            onClick={onNotificationClick}
            className="relative p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 hover:bg-accent rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-lg shadow-[var(--elevation-3)] py-2">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      onProfileClick?.()
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      onSettingsClick?.()
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                </div>

                <div className="border-t border-border pt-1">
                  <button
                    onClick={() => {
                      onLogoutClick?.()
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    )
  }
)
WebTopBar.displayName = "WebTopBar"

export { WebTopBar }
