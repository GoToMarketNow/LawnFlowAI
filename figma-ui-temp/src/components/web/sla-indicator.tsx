import * as React from "react"
import { cn } from "../ui/utils"
import { AlertCircle, Clock } from "lucide-react"

export type SLAStatus = "safe" | "warning" | "critical" | "breached"

export interface WebSLAIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status: SLAStatus
  timeRemaining?: string
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

const WebSLAIndicator = React.forwardRef<HTMLDivElement, WebSLAIndicatorProps>(
  ({ className, status, timeRemaining, showLabel = false, size = "md", ...props }, ref) => {
    const config = {
      safe: {
        color: "bg-success",
        borderColor: "border-success",
        textColor: "text-success",
        label: "On Track",
        icon: <Clock className="w-3 h-3" />,
      },
      warning: {
        color: "bg-warning",
        borderColor: "border-warning",
        textColor: "text-warning",
        label: "At Risk",
        icon: <Clock className="w-3 h-3" />,
      },
      critical: {
        color: "bg-destructive",
        borderColor: "border-destructive",
        textColor: "text-destructive",
        label: "Critical",
        icon: <AlertCircle className="w-3 h-3" />,
      },
      breached: {
        color: "bg-destructive",
        borderColor: "border-destructive",
        textColor: "text-destructive",
        label: "Breached",
        icon: <AlertCircle className="w-3 h-3" />,
      },
    }

    const sizeClasses = {
      sm: "w-2 h-2",
      md: "w-3 h-3",
      lg: "w-4 h-4",
    }

    const statusConfig = config[status]
    
    // Safety check: if status is invalid, default to safe
    if (!statusConfig) {
      console.warn(`Invalid SLA status: ${status}. Defaulting to 'safe'.`)
      return (
        <WebSLAIndicator
          ref={ref}
          status="safe"
          timeRemaining={timeRemaining}
          showLabel={showLabel}
          size={size}
          className={className}
          {...props}
        />
      )
    }

    if (showLabel) {
      return (
        <div
          ref={ref}
          className={cn("flex items-center gap-2", className)}
          {...props}
        >
          <div className={cn("relative flex items-center justify-center")}>
            <div
              className={cn(
                "rounded-full",
                sizeClasses[size],
                statusConfig.color,
                status === "critical" && "animate-pulse"
              )}
            />
            {status === "breached" && (
              <div
                className={cn(
                  "absolute rounded-full animate-ping",
                  sizeClasses[size],
                  statusConfig.color,
                  "opacity-75"
                )}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm font-medium", statusConfig.textColor)}>
              {statusConfig.label}
            </span>
            {timeRemaining && (
              <span className="text-xs text-muted-foreground">({timeRemaining})</span>
            )}
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex", className)}
        title={`${statusConfig.label}${timeRemaining ? ` - ${timeRemaining}` : ""}`}
        {...props}
      >
        <div
          className={cn(
            "rounded-full",
            sizeClasses[size],
            statusConfig.color,
            status === "critical" && "animate-pulse"
          )}
        />
        {status === "breached" && (
          <div
            className={cn(
              "absolute rounded-full animate-ping",
              sizeClasses[size],
              statusConfig.color,
              "opacity-75"
            )}
          />
        )}
      </div>
    )
  }
)
WebSLAIndicator.displayName = "WebSLAIndicator"

export { WebSLAIndicator }