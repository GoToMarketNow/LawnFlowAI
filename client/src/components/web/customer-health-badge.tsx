import * as React from "react"
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Minus } from "lucide-react"
import { cn } from "../ui/utils"

export type CustomerHealthStatus = "excellent" | "good" | "fair" | "at-risk" | "critical"

export interface WebCustomerHealthBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: CustomerHealthStatus
  score?: number // 0-100
  showLabel?: boolean
  size?: "sm" | "md"
}

const WebCustomerHealthBadge = React.forwardRef<HTMLDivElement, WebCustomerHealthBadgeProps>(
  ({ className, status, score, showLabel = false, size = "md", ...props }, ref) => {
    const statusConfig = {
      excellent: {
        icon: CheckCircle,
        label: "Excellent",
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
      },
      good: {
        icon: TrendingUp,
        label: "Good",
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
      },
      fair: {
        icon: Minus,
        label: "Fair",
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/30",
      },
      "at-risk": {
        icon: TrendingDown,
        label: "At Risk",
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/30",
      },
      critical: {
        icon: AlertTriangle,
        label: "Critical",
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive/30",
      },
    }

    const config = statusConfig[status]
    const Icon = config.icon
    const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4"
    const textSize = size === "sm" ? "text-xs" : "text-sm"

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
          config.bgColor,
          config.borderColor,
          className
        )}
        {...props}
      >
        <Icon className={cn(iconSize, config.color)} />
        {showLabel && (
          <div className="flex items-center gap-1">
            <span className={cn("font-medium", textSize, config.color)}>
              {config.label}
            </span>
            {score !== undefined && (
              <span className={cn(textSize, "text-muted-foreground")}>({score})</span>
            )}
          </div>
        )}
      </div>
    )
  }
)
WebCustomerHealthBadge.displayName = "WebCustomerHealthBadge"

export { WebCustomerHealthBadge }
