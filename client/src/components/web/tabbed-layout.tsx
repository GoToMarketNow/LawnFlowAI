import * as React from "react"
import { cn } from "../ui/utils"

export interface Tab {
  id: string
  label: string
  content: React.ReactNode
  badge?: string | number
}

export interface WebTabbedLayoutProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
  onTabChange?: (tabId: string) => void
}

const WebTabbedLayout = React.forwardRef<HTMLDivElement, WebTabbedLayoutProps>(
  ({ tabs, defaultTab, className, onTabChange }, ref) => {
    const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id)

    // Sync with URL params
    React.useEffect(() => {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam && tabs.some(tab => tab.id === tabParam)) {
        setActiveTab(tabParam)
      }
    }, [tabs])

    const handleTabChange = (tabId: string) => {
      setActiveTab(tabId)
      
      // Update URL without reload
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tabId)
      window.history.pushState({}, '', url.toString())
      
      onTabChange?.(tabId)
    }

    const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content

    return (
      <div ref={ref} className={cn("flex flex-col h-full", className)}>
        {/* Tab Navigation */}
        <div className="border-b border-border bg-background sticky top-0 z-20">
          <nav className="flex gap-1 px-6" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors",
                  "hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tab.badge && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                      {tab.badge}
                    </span>
                  )}
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {activeTabContent}
        </div>
      </div>
    )
  }
)
WebTabbedLayout.displayName = "WebTabbedLayout"

export { WebTabbedLayout }
