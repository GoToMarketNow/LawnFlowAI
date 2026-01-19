import * as React from "react"
import { cn } from "../ui/utils"

export interface WebBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "status" | "priority" | "confidence"
  status?: "active" | "pending" | "completed" | "cancelled" | "overdue"
  priority?: "low" | "medium" | "high" | "urgent"
  confidence?: "low" | "medium" | "high"
}

const WebBadge = React.forwardRef<HTMLDivElement, WebBadgeProps>(
  ({ className, variant = "status", status, priority, confidence, children, ...props }, ref) => {
    const getStatusStyles = () => {
      switch (status) {
        case "active":
          return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        case "pending":
          return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
        case "completed":
          return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
        case "cancelled":
          return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        case "overdue":
          return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        default:
          return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }
    }

    const getPriorityStyles = () => {
      switch (priority) {
        case "low":
          return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        case "medium":
          return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        case "high":
          return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
        case "urgent":
          return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        default:
          return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }
    }

    const getConfidenceStyles = () => {
      switch (confidence) {
        case "low":
          return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        case "medium":
          return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
        case "high":
          return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
        default:
          return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }
    }

    const variantStyles = () => {
      if (variant === "status") return getStatusStyles()
      if (variant === "priority") return getPriorityStyles()
      if (variant === "confidence") return getConfidenceStyles()
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
          variantStyles(),
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
WebBadge.displayName = "WebBadge"

export { WebBadge }
