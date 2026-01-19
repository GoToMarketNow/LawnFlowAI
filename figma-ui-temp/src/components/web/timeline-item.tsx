import * as React from "react"
import { cn } from "../ui/utils"
import { WebStatusIndicator } from "./status-indicator"

export interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  timestamp: string
  status?: "active" | "completed" | "pending" | "cancelled" | "scheduled"
  icon?: React.ReactNode
  showConnector?: boolean
}

const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, title, description, timestamp, status, icon, showConnector = true, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        {/* Connector Line */}
        {showConnector && (
          <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />
        )}

        {/* Timeline Item */}
        <div className="flex gap-4">
          {/* Icon/Status */}
          <div className="relative flex-shrink-0 z-10">
            {icon ? (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {icon}
              </div>
            ) : status ? (
              <div className="w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center">
                <WebStatusIndicator status={status} size="sm" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-8">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h4 className="font-medium text-foreground">{title}</h4>
              <span className="text-sm text-muted-foreground flex-shrink-0">
                {timestamp}
              </span>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      </div>
    )
  }
)
TimelineItem.displayName = "TimelineItem"

export { TimelineItem }
