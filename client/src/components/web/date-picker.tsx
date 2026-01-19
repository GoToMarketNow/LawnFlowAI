import * as React from "react"
import { Calendar } from "lucide-react"
import { cn } from "../ui/utils"

export interface WebDatePickerProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  helperText?: string
}

const WebDatePicker = React.forwardRef<HTMLInputElement, WebDatePickerProps>(
  ({ className, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative">
          <input
            type="date"
            className={cn(
              "flex h-10 w-full rounded-lg border bg-input-background pl-10 pr-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-destructive focus-visible:ring-destructive"
                : "border-input",
              className
            )}
            ref={ref}
            {...props}
          />
          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
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
WebDatePicker.displayName = "WebDatePicker"

export { WebDatePicker }
