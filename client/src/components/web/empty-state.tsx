import * as React from "react"
import { FileQuestion, Search, ShieldAlert, AlertCircle } from "lucide-react"
import { cn } from "../ui/utils"
import { WebButton } from "./button"

export interface WebEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "no-data" | "no-results" | "no-permission" | "error"
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

const WebEmptyState = React.forwardRef<HTMLDivElement, WebEmptyStateProps>(
  ({ 
    className, 
    variant = "no-data", 
    title, 
    description, 
    actionLabel,
    onAction,
    ...props 
  }, ref) => {
    const getIcon = () => {
      switch (variant) {
        case "no-data":
          return <FileQuestion className="w-12 h-12 text-muted-foreground" />
        case "no-results":
          return <Search className="w-12 h-12 text-muted-foreground" />
        case "no-permission":
          return <ShieldAlert className="w-12 h-12 text-muted-foreground" />
        case "error":
          return <AlertCircle className="w-12 h-12 text-destructive" />
        default:
          return <FileQuestion className="w-12 h-12 text-muted-foreground" />
      }
    }

    const getDefaultTitle = () => {
      switch (variant) {
        case "no-data":
          return "No data available"
        case "no-results":
          return "No results found"
        case "no-permission":
          return "Access denied"
        case "error":
          return "Something went wrong"
        default:
          return "No data available"
      }
    }

    const getDefaultDescription = () => {
      switch (variant) {
        case "no-data":
          return "Get started by creating your first item"
        case "no-results":
          return "Try adjusting your search or filters"
        case "no-permission":
          return "You don't have permission to view this content"
        case "error":
          return "We encountered an error while loading this content"
        default:
          return ""
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center py-12 px-4 text-center",
          className
        )}
        {...props}
      >
        <div className="mb-4">{getIcon()}</div>
        <h3 className="mb-2 text-lg font-medium">
          {title || getDefaultTitle()}
        </h3>
        <p className="mb-6 text-sm text-muted-foreground max-w-sm">
          {description || getDefaultDescription()}
        </p>
        {actionLabel && onAction && (
          <WebButton onClick={onAction} variant="primary">
            {actionLabel}
          </WebButton>
        )}
      </div>
    )
  }
)
WebEmptyState.displayName = "WebEmptyState"

export { WebEmptyState }
