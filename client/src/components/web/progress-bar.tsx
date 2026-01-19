import * as React from "react"
import { cn } from "../ui/utils"

export interface WebProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number // 0-100
  max?: number
  variant?: "primary" | "success" | "warning" | "destructive"
  size?: "sm" | "md" | "lg"
  label?: string
  showPercentage?: boolean
  indeterminate?: boolean
}

const WebProgressBar = React.forwardRef<HTMLDivElement, WebProgressBarProps>(
  (
    {
      className,
      value,
      max = 100,
      variant = "primary",
      size = "md",
      label,
      showPercentage = false,
      indeterminate = false,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const sizeClasses = {
      sm: "h-1.5",
      md: "h-2.5",
      lg: "h-4",
    }

    const variantClasses = {
      primary: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
    }

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {(label || showPercentage) && (
          <div className="flex items-center justify-between mb-2 text-sm">
            {label && <span className="font-medium">{label}</span>}
            {showPercentage && !indeterminate && (
              <span className="text-muted-foreground">{Math.round(percentage)}%</span>
            )}
          </div>
        )}
        <div className={cn("w-full bg-muted rounded-full overflow-hidden", sizeClasses[size])}>
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              variantClasses[variant],
              indeterminate && "animate-pulse"
            )}
            style={{
              width: indeterminate ? "100%" : `${percentage}%`,
            }}
          />
        </div>
      </div>
    )
  }
)
WebProgressBar.displayName = "WebProgressBar"

export { WebProgressBar }
