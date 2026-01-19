import * as React from "react"
import { CheckCircle, AlertCircle, Info, XCircle, X } from "lucide-react"
import { cn } from "../ui/utils"

export interface WebToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "error" | "warning" | "info"
  title?: string
  description?: string
  onClose?: () => void
}

const WebToast = React.forwardRef<HTMLDivElement, WebToastProps>(
  ({ className, variant = "info", title, description, onClose, ...props }, ref) => {
    const getIcon = () => {
      switch (variant) {
        case "success":
          return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        case "error":
          return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        case "warning":
          return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        case "info":
          return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        default:
          return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      }
    }

    const getStyles = () => {
      switch (variant) {
        case "success":
          return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
        case "error":
          return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
        case "warning":
          return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
        case "info":
          return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
        default:
          return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "pointer-events-auto flex w-full max-w-md rounded-lg border p-4 shadow-[var(--elevation-4)] transition-all",
          getStyles(),
          className
        )}
        {...props}
      >
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium text-foreground mb-1">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 inline-flex flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    )
  }
)
WebToast.displayName = "WebToast"

export { WebToast }
