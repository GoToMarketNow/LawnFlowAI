import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../ui/utils"
import { WebButton } from "./button"

export interface WebFilteredListLayoutProps {
  filterPanel: React.ReactNode
  children: React.ReactNode
  className?: string
  showMobileFilters?: boolean
  onCloseMobileFilters?: () => void
}

const WebFilteredListLayout = React.forwardRef<HTMLDivElement, WebFilteredListLayoutProps>(
  ({ filterPanel, children, className, showMobileFilters = false, onCloseMobileFilters }, ref) => {
    return (
      <div ref={ref} className={cn("flex h-full", className)}>
        {/* Desktop Filter Panel - Always visible on large screens */}
        <aside className="hidden lg:block w-64 border-r border-border bg-card overflow-y-auto flex-shrink-0">
          <div className="p-4">
            {filterPanel}
          </div>
        </aside>

        {/* Mobile Filter Panel - Overlay */}
        {showMobileFilters && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={onCloseMobileFilters}>
            <aside
              className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-card border-r border-border overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
                <h3 className="font-medium">Filters</h3>
                <button
                  onClick={onCloseMobileFilters}
                  className="p-1 hover:bg-accent rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                {filterPanel}
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    )
  }
)
WebFilteredListLayout.displayName = "WebFilteredListLayout"

export { WebFilteredListLayout }
