import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../ui/utils"

export interface WebSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  helperText?: string
  options?: { value: string; label: string }[]
}

const WebSelect = React.forwardRef<HTMLSelectElement, WebSelectProps>(
  ({ className, error, helperText, options = [], children, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative">
          <select
            className={cn(
              "flex h-10 w-full appearance-none rounded-lg border bg-input-background px-3 py-2 pr-10 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-destructive focus-visible:ring-destructive"
                : "border-input",
              className
            )}
            ref={ref}
            {...props}
          >
            {children ||
              options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        {helperText && (
          <p
            className={cn(
              "mt-1.5 text-xs",
              error ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
WebSelect.displayName = "WebSelect"

export { WebSelect }
