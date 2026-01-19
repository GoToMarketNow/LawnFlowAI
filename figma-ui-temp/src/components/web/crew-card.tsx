import * as React from "react"
import { Users, TrendingUp, Briefcase, MapPin, Star, Clock } from "lucide-react"
import { cn } from "../ui/utils"
import { WebBadge } from "./badge"
import { WebStatusIndicator } from "./status-indicator"

export type CrewStatus = "available" | "on-job" | "off-duty" | "unavailable"

export interface WebCrewCardProps extends React.HTMLAttributes<HTMLButtonElement> {
  name: string
  members: string[]
  status: CrewStatus
  rating: number // 0-5
  jobsPerWeek: number
  currentJob?: string
  onViewDetails?: () => void
}

const WebCrewCard = React.forwardRef<HTMLButtonElement, WebCrewCardProps>(
  ({ className, name, members, status, rating, jobsPerWeek, currentJob, onViewDetails, ...props }, ref) => {
    const statusConfig = {
      available: {
        label: "Available",
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
        indicatorStatus: "active" as const,
      },
      "on-job": {
        label: "On Job",
        color: "text-primary",
        bgColor: "bg-primary/10",
        borderColor: "border-primary/30",
        indicatorStatus: "active" as const,
      },
      "off-duty": {
        label: "Off Duty",
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        borderColor: "border-border",
        indicatorStatus: "pending" as const,
      },
      unavailable: {
        label: "Unavailable",
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive/30",
        indicatorStatus: "error" as const,
      },
    }

    const config = statusConfig[status]

    return (
      <button
        ref={ref}
        onClick={onViewDetails}
        className={cn(
          "w-full text-left bg-card border-2 border-border rounded-lg p-6 transition-all",
          "hover:border-primary/50 hover:shadow-[var(--elevation-1)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-lg">{name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {members.join(" • ")}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <WebStatusIndicator status={config.indicatorStatus} showLabel label={config.label} />
            {currentJob && status === "on-job" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{currentJob}</span>
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            {/* Rating */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Rating</p>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-warning text-warning" />
                <span className="font-semibold text-lg">{rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">/5</span>
              </div>
            </div>

            {/* Jobs/Week */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Jobs/Week</p>
              <div className="flex items-center gap-1">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-lg">{jobsPerWeek}</span>
              </div>
            </div>
          </div>
        </div>
      </button>
    )
  }
)
WebCrewCard.displayName = "WebCrewCard"

export { WebCrewCard }
