import * as React from "react"
import { cn } from "../ui/utils"

export interface WebStatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: "active" | "pending" | "completed" | "cancelled" | "overdue" | "success" | "warning" | "error" | "info"
  showLabel?: boolean
  label?: string
  size?: "sm" | "md" | "lg"
}

const WebStatusIndicator = React.forwardRef<HTMLDivElement, WebStatusIndicatorProps>(
  ({ className, status = "active", showLabel = false, label, size = "md", ...props }, ref) => {
    const getStatusColor = () => {
      switch (status) {
        case "active":
        case "info":
          return "bg-blue-500"
        case "pending":
        case "warning":
          return "bg-yellow-500"
        case "completed":
        case "success":
          return "bg-green-500"
        case "cancelled":
          return "bg-gray-400"
        case "overdue":
        case "error":
          return "bg-red-500"
        default:
          return "bg-gray-400"
      }
    }

    const getLabel = () => {
      if (label) return label
      return status.charAt(0).toUpperCase() + status.slice(1)
    }

    const dotSize = {
      sm: "w-2 h-2",
      md: "w-2.5 h-2.5",
      lg: "w-3 h-3",
    }

    const textSize = {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    }

    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center gap-2", className)}
        {...props}
      >
        <span
          className={cn(
            "rounded-full",
            dotSize[size],
            getStatusColor()
          )}
        />
        {showLabel && (
          <span className={cn("text-foreground", textSize[size])}>
            {getLabel()}
          </span>
        )}
      </div>
    )
  }
)
WebStatusIndicator.displayName = "WebStatusIndicator"

export { WebStatusIndicator }
