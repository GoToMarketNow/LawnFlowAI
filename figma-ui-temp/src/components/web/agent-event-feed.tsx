import * as React from "react"
import { cn } from "../ui/utils"
import { WebBadge } from "./badge"
import { CheckCircle, XCircle, AlertCircle, Activity, Clock, User, Zap } from "lucide-react"

export interface AgentEvent {
  id: string
  agentId: string
  agentName: string
  timestamp: string
  outcome: "success" | "failure" | "partial" | "running"
  duration?: number
  message: string
  details?: {
    input?: any
    output?: any
    error?: string
  }
  triggeredBy?: string
}

export interface WebAgentEventFeedProps {
  events: AgentEvent[]
  loading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  filters?: {
    agentId?: string
    outcome?: string[]
  }
  onFilterChange?: (filters: any) => void
}

const WebAgentEventFeed: React.FC<WebAgentEventFeedProps> = ({
  events,
  loading = false,
  hasMore = false,
  onLoadMore,
  filters,
  onFilterChange,
}) => {
  const observerTarget = React.useRef<HTMLDivElement>(null)

  // Infinite scroll
  React.useEffect(() => {
    if (!observerTarget.current || !hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore?.()
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(observerTarget.current)

    return () => observer.disconnect()
  }, [hasMore, loading, onLoadMore])

  const getOutcomeConfig = (outcome: string) => {
    switch (outcome) {
      case "success":
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: "text-success",
          bgColor: "bg-success/10",
          borderColor: "border-success/30",
          label: "Success",
        }
      case "failure":
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
          label: "Failed",
        }
      case "partial":
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: "text-warning",
          bgColor: "bg-warning/10",
          borderColor: "border-warning/30",
          label: "Partial",
        }
      case "running":
        return {
          icon: <Activity className="w-4 h-4 animate-pulse" />,
          color: "text-primary",
          bgColor: "bg-primary/10",
          borderColor: "border-primary/30",
          label: "Running",
        }
      default:
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          borderColor: "border-border",
          label: "Unknown",
        }
    }
  }

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-[19px] top-6 bottom-0 w-0.5 bg-border" />

        {/* Events */}
        <div className="space-y-4">
          {events.map((event, index) => {
            const config = getOutcomeConfig(event.outcome)

            return (
              <div key={event.id} className="relative pl-12">
                {/* Timeline Dot */}
                <div
                  className={cn(
                    "absolute left-0 top-2 w-10 h-10 rounded-full border-2 flex items-center justify-center",
                    config.bgColor,
                    config.borderColor,
                    config.color
                  )}
                >
                  {config.icon}
                </div>

                {/* Event Card */}
                <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{event.agentName}</h4>
                        <WebBadge
                          variant="status"
                          status={
                            event.outcome === "success"
                              ? "success"
                              : event.outcome === "failure"
                              ? "error"
                              : event.outcome === "running"
                              ? "active"
                              : "pending"
                          }
                          size="sm"
                        >
                          {config.label}
                        </WebBadge>
                      </div>
                      <p className="text-sm text-muted-foreground">{event.message}</p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{event.timestamp}</span>
                    </div>
                    {event.duration !== undefined && (
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>{event.duration}ms</span>
                      </div>
                    )}
                    {event.triggeredBy && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{event.triggeredBy}</span>
                      </div>
                    )}
                  </div>

                  {/* Details (collapsible) */}
                  {event.details && (
                    <details className="mt-3 pt-3 border-t border-border">
                      <summary className="text-xs font-medium cursor-pointer hover:text-primary">
                        View Details
                      </summary>
                      <div className="mt-2 space-y-2">
                        {event.details.input && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Input:</p>
                            <pre className="text-xs bg-muted rounded p-2 overflow-auto">
                              {JSON.stringify(event.details.input, null, 2)}
                            </pre>
                          </div>
                        )}
                        {event.details.output && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Output:</p>
                            <pre className="text-xs bg-muted rounded p-2 overflow-auto">
                              {JSON.stringify(event.details.output, null, 2)}
                            </pre>
                          </div>
                        )}
                        {event.details.error && (
                          <div>
                            <p className="text-xs text-destructive mb-1">Error:</p>
                            <pre className="text-xs bg-destructive/10 text-destructive rounded p-2 overflow-auto">
                              {event.details.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading more events...</span>
            </div>
          </div>
        )}

        {/* Infinite Scroll Target */}
        {hasMore && !loading && <div ref={observerTarget} className="h-4" />}

        {/* End of Timeline */}
        {!hasMore && events.length > 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">No more events</p>
          </div>
        )}
      </div>
    </div>
  )
}

export { WebAgentEventFeed }
