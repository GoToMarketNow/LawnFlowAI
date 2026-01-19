import * as React from "react"
import { AlertTriangle, X, TrendingDown } from "lucide-react"
import { cn } from "../ui/utils"
import { WebButton } from "./button"

export interface MarginAlertTileProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description: string
  severity: "high" | "medium" | "low"
  metric?: {
    label: string
    value: string
  }
  actionLabel?: string
  onAction?: () => void
  onDismiss?: () => void
}

const MarginAlertTile = React.forwardRef<HTMLDivElement, MarginAlertTileProps>(
  ({ className, title, description, severity, metric, actionLabel, onAction, onDismiss, ...props }, ref) => {
    const severityColors = {
      high: "bg-destructive/10 border-destructive/50 text-destructive",
      medium: "bg-warning/10 border-warning/50 text-warning",
      low: "bg-warning/10 border-warning/30 text-warning",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative border rounded-lg p-6",
          severityColors[severity],
          className
        )}
        {...props}
      >
        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1 hover:bg-black/5 rounded transition-colors"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center",
              severity === "high" && "bg-destructive/20",
              severity === "medium" && "bg-warning/20",
              severity === "low" && "bg-warning/15"
            )}>
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>

            {/* Metric */}
            {metric && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-background/50 rounded-lg">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">{metric.label}:</span>
                <span className="text-sm font-semibold">{metric.value}</span>
              </div>
            )}

            {/* Action */}
            {actionLabel && onAction && (
              <div className="mt-4">
                <WebButton
                  variant="secondary"
                  size="sm"
                  onClick={onAction}
                >
                  {actionLabel}
                </WebButton>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
)
MarginAlertTile.displayName = "MarginAlertTile"

export { MarginAlertTile }
