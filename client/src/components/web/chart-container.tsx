import * as React from "react"
import { cn } from "../ui/utils"
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react"

export interface WebChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  metric?: {
    value: string
    change?: number
    changeLabel?: string
  }
  tooltip?: string
  actions?: React.ReactNode
  height?: string | number
}

const WebChartContainer = React.forwardRef<HTMLDivElement, WebChartContainerProps>(
  ({ className, title, subtitle, metric, tooltip, actions, height, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("bg-card border border-border rounded-lg overflow-hidden", className)}
        {...props}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">{title}</h3>
                {tooltip && (
                  <div className="group relative">
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    <div className="absolute left-0 top-6 w-64 p-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <p className="text-xs text-muted-foreground">{tooltip}</p>
                    </div>
                  </div>
                )}
              </div>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>

          {/* Metric */}
          {metric && (
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{metric.value}</span>
                {metric.change !== undefined && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      metric.change > 0 && "text-success",
                      metric.change < 0 && "text-destructive",
                      metric.change === 0 && "text-muted-foreground"
                    )}
                  >
                    {metric.change > 0 && <TrendingUp className="w-3 h-3" />}
                    {metric.change < 0 && <TrendingDown className="w-3 h-3" />}
                    {metric.change === 0 && <Minus className="w-3 h-3" />}
                    <span>
                      {metric.change > 0 ? "+" : ""}
                      {metric.change}%
                    </span>
                    {metric.changeLabel && (
                      <span className="text-muted-foreground ml-1">{metric.changeLabel}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chart Content */}
        <div className={cn("p-4", height && `h-[${height}px]`)}>{children}</div>
      </div>
    )
  }
)
WebChartContainer.displayName = "WebChartContainer"

export { WebChartContainer }
