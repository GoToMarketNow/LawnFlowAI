import * as React from "react"
import { Users, MapPin, Clock, TrendingUp, Star } from "lucide-react"
import { cn } from "../ui/utils"
import { WebBadge } from "./badge"

export interface CrewRecommendation {
  id: string
  name: string
  members: string[]
  score: number // 0-100
  matchReasons: string[]
  travelTime: string
  availability: "available" | "limited" | "unavailable"
  currentLocation?: string
  estimatedArrival?: string
}

export interface WebCrewRecommendationCardProps extends React.HTMLAttributes<HTMLButtonElement> {
  crew: CrewRecommendation
  isSelected?: boolean
  onSelect?: () => void
  rank?: number
}

const WebCrewRecommendationCard = React.forwardRef<HTMLButtonElement, WebCrewRecommendationCardProps>(
  ({ className, crew, isSelected = false, onSelect, rank, ...props }, ref) => {
    const availabilityConfig = {
      available: {
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
        label: "Available",
      },
      limited: {
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/30",
        label: "Limited Availability",
      },
      unavailable: {
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        borderColor: "border-border",
        label: "Unavailable",
      },
    }

    const config = availabilityConfig[crew.availability]

    // Determine score color
    const getScoreColor = (score: number) => {
      if (score >= 90) return "text-success"
      if (score >= 75) return "text-primary"
      if (score >= 60) return "text-warning"
      return "text-muted-foreground"
    }

    return (
      <button
        ref={ref}
        onClick={onSelect}
        disabled={crew.availability === "unavailable"}
        className={cn(
          "relative w-full text-left border-2 rounded-lg p-4 transition-all",
          isSelected
            ? "border-primary bg-primary/5 shadow-[var(--elevation-1)]"
            : "border-border bg-card hover:border-primary/50 hover:shadow-sm",
          crew.availability === "unavailable" && "opacity-50 cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      >
        {/* Rank Badge */}
        {rank !== undefined && (
          <div className="absolute -top-2 -left-2">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs",
              rank === 1 && "bg-warning text-white",
              rank === 2 && "bg-muted-foreground/30 text-foreground",
              rank === 3 && "bg-muted-foreground/20 text-foreground",
              rank > 3 && "bg-muted text-muted-foreground"
            )}>
              {rank}
            </div>
          </div>
        )}

        {/* Selected Indicator */}
        {isSelected && (
          <div className="absolute top-3 right-3">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-8">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-foreground">{crew.name}</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {crew.members.join(", ")}
              </p>
            </div>
          </div>

          {/* Score */}
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <Star className={cn("w-4 h-4", getScoreColor(crew.score))} />
              <span className={cn("text-2xl font-semibold", getScoreColor(crew.score))}>
                {crew.score}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  crew.score >= 90 && "bg-success",
                  crew.score >= 75 && crew.score < 90 && "bg-primary",
                  crew.score >= 60 && crew.score < 75 && "bg-warning",
                  crew.score < 60 && "bg-muted-foreground"
                )}
                style={{ width: `${crew.score}%` }}
              />
            </div>
          </div>

          {/* Match Reasons */}
          <div className="flex flex-wrap gap-1.5">
            {crew.matchReasons.map((reason, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs text-primary"
              >
                <TrendingUp className="w-3 h-3" />
                {reason}
              </span>
            ))}
          </div>

          {/* Location & Travel */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Travel Time</p>
                <p className="font-medium text-sm">{crew.travelTime}</p>
              </div>
            </div>
            {crew.currentLocation && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Current Location</p>
                  <p className="font-medium text-sm">{crew.currentLocation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Availability */}
          <div className="flex items-center justify-between pt-2">
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.bgColor, config.color)}>
              <div className={cn("w-1.5 h-1.5 rounded-full", config.color.replace("text-", "bg-"))} />
              {config.label}
            </div>
            {crew.estimatedArrival && (
              <span className="text-xs text-muted-foreground">
                ETA: {crew.estimatedArrival}
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }
)
WebCrewRecommendationCard.displayName = "WebCrewRecommendationCard"

export { WebCrewRecommendationCard }
