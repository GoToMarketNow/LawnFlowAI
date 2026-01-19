import * as React from "react"
import { cn } from "../ui/utils"

export interface WebResponsiveContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: "default" | "wide" | "full"
  padding?: boolean
  center?: boolean
}

const WebResponsiveContainer = React.forwardRef<HTMLDivElement, WebResponsiveContainerProps>(
  ({ className, maxWidth = "default", padding = true, center = true, children, ...props }, ref) => {
    const maxWidthClasses = {
      default: "max-w-[1440px]", // Primary desktop
      wide: "max-w-[1920px]", // Wide desktop
      full: "max-w-full", // No max width
    }

    return (
      <div
        ref={ref}
        className={cn(
          "w-full",
          maxWidthClasses[maxWidth],
          center && "mx-auto",
          padding && "px-6",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
WebResponsiveContainer.displayName = "WebResponsiveContainer"

export { WebResponsiveContainer }
