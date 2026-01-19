import * as React from "react"
import { Lightbulb, ChevronRight, TrendingUp, Users, DollarSign } from "lucide-react"
import { cn } from "../ui/utils"
import { WebBadge } from "./badge"

export interface GrowthInsight {
  id: string
  title: string
  description: string
  impact: "high" | "medium" | "low"
  category: "revenue" | "efficiency" | "customer"
  actionLabel: string
  onAction: () => void
}

export interface GrowthAdvisorWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  insights: GrowthInsight[]
  title?: string
}

const GrowthAdvisorWidget = React.forwardRef<HTMLDivElement, GrowthAdvisorWidgetProps>(
  ({ className, insights, title = "Growth Advisor", ...props }, ref) => {
    const getCategoryIcon = (category: GrowthInsight["category"]) => {
      switch (category) {
        case "revenue":
          return <DollarSign className="w-4 h-4" />
        case "efficiency":
          return <TrendingUp className="w-4 h-4" />
        case "customer":
          return <Users className="w-4 h-4" />
      }
    }

    const getImpactColor = (impact: GrowthInsight["impact"]) => {
      switch (impact) {
        case "high":
          return "success"
        case "medium":
          return "warning"
        case "low":
          return "neutral"
      }
    }

    return (
      <div
        ref={ref}
        className={cn("bg-card border border-border rounded-lg", className)}
        {...props}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
        </div>

        {/* Insights List */}
        <div className="divide-y divide-border">
          {insights.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No growth insights available at this time.
              </p>
            </div>
          ) : (
            insights.map((insight) => (
              <div
                key={insight.id}
                className="px-6 py-4 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={insight.onAction}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {getCategoryIcon(insight.category)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-medium text-foreground text-sm">
                        {insight.title}
                      </h4>
                      <WebBadge
                        variant="status"
                        status={getImpactColor(insight.impact) as any}
                        size="sm"
                      >
                        {insight.impact} impact
                      </WebBadge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {insight.description}
                    </p>
                    <button className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      {insight.actionLabel}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {insights.length > 0 && (
          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              Insights powered by LawnFlow AI
            </p>
          </div>
        )}
      </div>
    )
  }
)
GrowthAdvisorWidget.displayName = "GrowthAdvisorWidget"

export { GrowthAdvisorWidget, type GrowthInsight }
