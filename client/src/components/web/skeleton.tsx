import * as React from "react"
import { cn } from "../ui/utils"

export interface WebSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
}

const WebSkeleton = React.forwardRef<HTMLDivElement, WebSkeletonProps>(
  ({ className, variant = "rectangular", width, height, style, ...props }, ref) => {
    const variantStyles = {
      text: "h-4 w-full rounded",
      circular: "rounded-full",
      rectangular: "rounded-lg",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "animate-pulse bg-muted",
          variantStyles[variant],
          className
        )}
        style={{
          width: width,
          height: height,
          ...style,
        }}
        {...props}
      />
    )
  }
)
WebSkeleton.displayName = "WebSkeleton"

// Preset skeleton loaders
const WebSkeletonCard = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      <WebSkeleton variant="rectangular" height="200px" />
      <div className="space-y-2">
        <WebSkeleton variant="text" />
        <WebSkeleton variant="text" width="80%" />
      </div>
    </div>
  )
}
WebSkeletonCard.displayName = "WebSkeletonCard"

const WebSkeletonTable = ({ rows = 5, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { rows?: number }) => {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      <WebSkeleton variant="rectangular" height="40px" />
      {Array.from({ length: rows }).map((_, i) => (
        <WebSkeleton key={i} variant="rectangular" height="60px" />
      ))}
    </div>
  )
}
WebSkeletonTable.displayName = "WebSkeletonTable"

const WebSkeletonList = ({ items = 5, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { items?: number }) => {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <WebSkeleton variant="circular" width="40px" height="40px" />
          <div className="flex-1 space-y-2">
            <WebSkeleton variant="text" width="60%" />
            <WebSkeleton variant="text" width="40%" />
          </div>
        </div>
      ))}
    </div>
  )
}
WebSkeletonList.displayName = "WebSkeletonList"

export { WebSkeleton, WebSkeletonCard, WebSkeletonTable, WebSkeletonList }
