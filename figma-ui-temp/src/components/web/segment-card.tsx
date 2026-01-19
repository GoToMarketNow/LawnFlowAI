import * as React from "react"
import { TrendingUp, TrendingDown, AlertTriangle, Users, XCircle, Sparkles } from "lucide-react"
import { cn } from "../ui/utils"

export type SegmentVariant = "high-value" | "at-risk" | "new" | "dormant" | "churned"

export interface WebSegmentCardProps extends React.HTMLAttributes<HTMLButtonElement> {
  variant: SegmentVariant
  title: string
  count: number
  criteria: string
  trend?: {
    value: string
    direction: "up" | "down" | "neutral"
  }
  isActive?: boolean
  onClick?: () => void
}

const WebSegmentCard = React.forwardRef<HTMLButtonElement, WebSegmentCardProps>(
  ({ className, variant, title, count, criteria, trend, isActive = false, onClick, ...props }, ref) => {
    const variantConfig = {
      "high-value": {
        icon: TrendingUp,
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
        activeColor: "border-success bg-success/20",
        iconColor: "text-success",
        countColor: "text-success",
      },
      "at-risk": {
        icon: AlertTriangle,
        bgColor: "bg-warning/10",
        borderColor: "border-warning/30",
        activeColor: "border-warning bg-warning/20",
        iconColor: "text-warning",
        countColor: "text-warning",
      },
      new: {
        icon: Sparkles,
        bgColor: "bg-primary/10",
        borderColor: "border-primary/30",
        activeColor: "border-primary bg-primary/20",
        iconColor: "text-primary",
        countColor: "text-primary",
      },
      dormant: {
        icon: Users,
        bgColor: "bg-muted",
        borderColor: "border-border",
        activeColor: "border-foreground/50 bg-muted",
        iconColor: "text-muted-foreground",
        countColor: "text-muted-foreground",
      },
      churned: {
        icon: XCircle,
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive/30",
        activeColor: "border-destructive bg-destructive/20",
        iconColor: "text-destructive",
        countColor: "text-destructive",
      },
    }

    const config = variantConfig[variant]
    const Icon = config.icon

    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          "relative w-full text-left border-2 rounded-lg p-6 transition-all hover:shadow-[var(--elevation-2)]",
          isActive ? config.activeColor : `${config.bgColor} ${config.borderColor}`,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      >
        {/* Active Indicator */}
        {isActive && (
          <div className="absolute top-3 right-3">
            <div className={cn("w-2 h-2 rounded-full", config.iconColor.replace("text-", "bg-"))} />
          </div>
        )}

        {/* Icon */}
        <div className="mb-4">
          <div className={cn("inline-flex p-3 rounded-lg", isActive ? config.activeColor : config.bgColor)}>
            <Icon className={cn("w-6 h-6", config.iconColor)} />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h3 className={cn("text-3xl font-semibold", config.countColor)}>
              {count.toLocaleString()}
            </h3>
            {trend && (
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.direction === "up" && "text-success",
                  trend.direction === "down" && "text-destructive",
                  trend.direction === "neutral" && "text-muted-foreground"
                )}
              >
                {trend.direction === "up" && "↑"}
                {trend.direction === "down" && "↓"}
                {trend.value}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{criteria}</p>
        </div>

        {/* Hover State Indicator */}
        <div className={cn(
          "absolute inset-0 rounded-lg pointer-events-none transition-opacity",
          isActive ? "opacity-0" : "opacity-0 group-hover:opacity-5",
          config.iconColor.replace("text-", "bg-")
        )} />
      </button>
    )
  }
)
WebSegmentCard.displayName = "WebSegmentCard"

export { WebSegmentCard }
