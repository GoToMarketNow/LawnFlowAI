import * as React from "react"
import { cn } from "../ui/utils"

export interface WebButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "ghost"
  size?: "sm" | "md" | "lg"
}

const WebButton = React.forwardRef<HTMLButtonElement, WebButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--elevation-2)]":
              variant === "primary",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border":
              variant === "secondary",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[var(--elevation-2)]":
              variant === "destructive",
            "hover:bg-accent hover:text-accent-foreground":
              variant === "ghost",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4": size === "md",
            "h-12 px-6 text-lg": size === "lg",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
WebButton.displayName = "WebButton"

export { WebButton }
