import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../ui/utils"

export interface WebContextualDrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: "md" | "lg"
  className?: string
}

const WebContextualDrawer = React.forwardRef<HTMLDivElement, WebContextualDrawerProps>(
  ({ open, onClose, title, description, children, footer, size = "md", className }, ref) => {
    // Lock body scroll when drawer is open
    React.useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
      return () => {
        document.body.style.overflow = ''
      }
    }, [open])

    // Handle escape key
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && open) {
          onClose()
        }
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }, [open, onClose])

    if (!open) return null

    const drawerWidth = {
      md: "w-full sm:w-[400px]",
      lg: "w-full sm:w-[600px]",
    }

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Drawer Panel */}
        <div
          ref={ref}
          className={cn(
            "relative h-full bg-background shadow-[var(--elevation-5)] flex flex-col",
            "animate-in slide-in-from-right duration-300",
            drawerWidth[size],
            className
          )}
        >
          {/* Header */}
          {(title || description) && (
            <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="text-lg font-semibold text-foreground">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 -mr-2 hover:bg-accent rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="sticky bottom-0 z-10 bg-background border-t border-border px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    )
  }
)
WebContextualDrawer.displayName = "WebContextualDrawer"

export { WebContextualDrawer }
