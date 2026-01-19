import * as React from "react"
import { cn } from "../ui/utils"
import { Loader2 } from "lucide-react"

export interface WebLoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "primary" | "muted"
  label?: string
}

const WebLoadingSpinner = React.forwardRef<HTMLDivElement, WebLoadingSpinnerProps>(
  ({ className, size = "md", variant = "primary", label, ...props }, ref) => {
    const sizeClasses = {
      sm: "w-4 h-4",
      md: "w-8 h-8",
      lg: "w-12 h-12",
      xl: "w-16 h-16",
    }

    const colorClasses = {
      primary: "text-primary",
      muted: "text-muted-foreground",
    }

    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center gap-3", className)}
        {...props}
      >
        <Loader2 className={cn("animate-spin", sizeClasses[size], colorClasses[variant])} />
        {label && (
          <p className={cn("text-sm", colorClasses[variant])}>{label}</p>
        )}
      </div>
    )
  }
)
WebLoadingSpinner.displayName = "WebLoadingSpinner"

export { WebLoadingSpinner }
