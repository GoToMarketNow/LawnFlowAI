import * as React from "react"
import { cn } from "../ui/utils"
import { AlertTriangle, TrendingDown, TrendingUp, Target } from "lucide-react"

export interface CoverageGap {
  topic: string
  ticketCount: number
  resolutionRate: number
  avgResolutionTime: string
  trend: "up" | "down" | "stable"
  severity: "critical" | "high" | "medium" | "low"
}

export interface WebCoverageGapIndicatorProps {
  gap: CoverageGap
  onClick?: () => void
}

const WebCoverageGapIndicator: React.FC<WebCoverageGapIndicatorProps> = ({ gap, onClick }) => {
  const severityConfig = {
    critical: {
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/30",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    high: {
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/30",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    medium: {
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      icon: <Target className="w-5 h-5" />,
    },
    low: {
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      borderColor: "border-border",
      icon: <Target className="w-5 h-5" />,
    },
  }

  const config = severityConfig[gap.severity]

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border-2 rounded-lg p-4 transition-all",
        config.borderColor,
        onClick && "cursor-pointer hover:shadow-[var(--elevation-1)]"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={cn("rounded-lg p-2", config.bgColor)}>
            <div className={config.color}>{config.icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold mb-1">{gap.topic}</h4>
            <p className="text-sm text-muted-foreground">
              {gap.ticketCount} recent tickets without knowledge coverage
            </p>
          </div>
        </div>

        {/* Trend */}
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded",
            gap.trend === "up"
              ? "bg-destructive/10 text-destructive"
              : gap.trend === "down"
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          )}
        >
          {gap.trend === "up" && <TrendingUp className="w-3 h-3" />}
          {gap.trend === "down" && <TrendingDown className="w-3 h-3" />}
          {gap.trend === "up" ? "Rising" : gap.trend === "down" ? "Improving" : "Stable"}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Resolution Rate</p>
          <p className="text-lg font-semibold">{gap.resolutionRate}%</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Avg Time</p>
          <p className="text-lg font-semibold">{gap.avgResolutionTime}</p>
        </div>
      </div>
    </div>
  )
}

export { WebCoverageGapIndicator }
