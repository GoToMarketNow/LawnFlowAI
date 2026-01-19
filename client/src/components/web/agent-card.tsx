import * as React from "react"
import { cn } from "../ui/utils"
import { WebBadge } from "./badge"
import { WebStatusIndicator } from "./status-indicator"
import { Play, Edit, MoreVertical, Activity, Clock, TrendingUp } from "lucide-react"

export type AgentLifecycleStage = "development" | "testing" | "production" | "archived"

export interface WebAgentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  description: string
  stage: AgentLifecycleStage
  status: "active" | "inactive" | "error" | "running"
  successRate: number // 0-100
  lastRun?: {
    timestamp: string
    outcome: "success" | "failure" | "partial"
  }
  onViewDetails?: () => void
  onEdit?: () => void
  onTest?: () => void
}

const WebAgentCard = React.forwardRef<HTMLDivElement, WebAgentCardProps>(
  (
    {
      className,
      name,
      description,
      stage,
      status,
      successRate,
      lastRun,
      onViewDetails,
      onEdit,
      onTest,
      ...props
    },
    ref
  ) => {
    const statusConfig = {
      active: { label: "Active", indicatorStatus: "active" as const },
      inactive: { label: "Inactive", indicatorStatus: "pending" as const },
      error: { label: "Error", indicatorStatus: "error" as const },
      running: { label: "Running", indicatorStatus: "active" as const },
    }

    const stageColors = {
      development: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      testing: "bg-warning/10 text-warning border-warning/30",
      production: "bg-success/10 text-success border-success/30",
      archived: "bg-muted text-muted-foreground border-border",
    }

    const stageLabels = {
      development: "Development",
      testing: "Testing",
      production: "Production",
      archived: "Archived",
    }

    const config = statusConfig[status]

    return (
      <div
        ref={ref as any}
        onClick={onViewDetails}
        className={cn(
          "w-full text-left bg-card border-2 border-border rounded-lg p-5 transition-all cursor-pointer",
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
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">{name}</h3>
                {status === "running" && (
                  <Activity className="w-4 h-4 text-primary animate-pulse" />
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            </div>
          </div>

          {/* Stage Badge */}
          <div>
            <span
              className={cn(
                "inline-flex items-center text-xs font-medium px-2 py-1 rounded-md border",
                stageColors[stage]
              )}
            >
              {stageLabels[stage]}
            </span>
          </div>

          {/* Metrics */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-4">
              {/* Status */}
              <WebStatusIndicator status={config.indicatorStatus} showLabel label={config.label} />

              {/* Success Rate */}
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm font-medium">{successRate}%</span>
                <span className="text-xs text-muted-foreground">success</span>
              </div>
            </div>

            {/* Last Run */}
            {lastRun && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{lastRun.timestamp}</span>
                <WebBadge
                  variant="status"
                  status={
                    lastRun.outcome === "success"
                      ? "success"
                      : lastRun.outcome === "failure"
                      ? "error"
                      : "pending"
                  }
                  size="sm"
                >
                  {lastRun.outcome}
                </WebBadge>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTest?.()
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
            >
              <Play className="w-3 h-3" />
              Test
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit?.()
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
            >
              <Edit className="w-3 h-3" />
              Edit
            </button>
          </div>
        </div>
      </div>
    )
  }
)
WebAgentCard.displayName = "WebAgentCard"

export { WebAgentCard }