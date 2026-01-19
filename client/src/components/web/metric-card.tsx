import * as React from "react"
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react"
import { cn } from "../ui/utils"

export interface WebMetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  change?: {
    value: string
    type: "increase" | "decrease" | "neutral"
  }
  trend?: "up" | "down" | "neutral"
  icon?: React.ReactNode
  href?: string
  onClick?: () => void
}

const WebMetricCard = React.forwardRef<HTMLDivElement, WebMetricCardProps>(
  ({ className, label, value, change, trend, icon, href, onClick, ...props }, ref) => {
    const Wrapper = href ? "a" : "div"
    const isClickable = href || onClick

    const content = (
      <>
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-semibold text-foreground mb-1">{value}</p>
            {change && (
              <div className="flex items-center gap-1">
                {change.type === "increase" && (
                  <ArrowUpRight className="w-4 h-4 text-success" />
                )}
                {change.type === "decrease" && (
                  <ArrowDownRight className="w-4 h-4 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    change.type === "increase" && "text-success",
                    change.type === "decrease" && "text-destructive",
                    change.type === "neutral" && "text-muted-foreground"
                  )}
                >
                  {change.value}
                </span>
                <span className="text-sm text-muted-foreground">vs last period</span>
              </div>
            )}
          </div>

          {trend && (
            <div className="flex items-center">
              <TrendingUp
                className={cn(
                  "w-5 h-5",
                  trend === "up" && "text-success",
                  trend === "down" && "text-destructive rotate-180",
                  trend === "neutral" && "text-muted-foreground"
                )}
              />
            </div>
          )}
        </div>
      </>
    )

    return (
      <Wrapper
        ref={ref as any}
        href={href}
        onClick={onClick}
        className={cn(
          "block bg-card border border-border rounded-lg p-6 transition-all",
          isClickable && "cursor-pointer hover:shadow-[var(--elevation-2)] hover:border-primary/50",
          className
        )}
        {...props}
      >
        {content}
      </Wrapper>
    )
  }
)
WebMetricCard.displayName = "WebMetricCard"

export { WebMetricCard }
