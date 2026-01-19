import * as React from "react"
import { cn } from "../ui/utils"
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target } from "lucide-react"

export interface AIEnrichment {
  intent: string
  intentConfidence: number
  sentiment: "positive" | "neutral" | "negative"
  sentimentScore: number
  priority: "low" | "medium" | "high" | "urgent"
  suggestedActions: string[]
  keyTopics: string[]
  customerHistory?: {
    totalTickets: number
    avgResolutionTime: string
    satisfactionScore: number
  }
}

export interface WebAIEnrichmentCardProps {
  enrichment: AIEnrichment
}

const WebAIEnrichmentCard: React.FC<WebAIEnrichmentCardProps> = ({ enrichment }) => {
  const sentimentConfig = {
    positive: {
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-success",
      bgColor: "bg-success/10",
      label: "Positive",
    },
    neutral: {
      icon: <TrendingUp className="w-4 h-4 rotate-90" />,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      label: "Neutral",
    },
    negative: {
      icon: <TrendingDown className="w-4 h-4" />,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      label: "Negative",
    },
  }

  const priorityConfig = {
    low: { color: "text-muted-foreground", bgColor: "bg-muted" },
    medium: { color: "text-blue-600", bgColor: "bg-blue-500/10" },
    high: { color: "text-warning", bgColor: "bg-warning/10" },
    urgent: { color: "text-destructive", bgColor: "bg-destructive/10" },
  }

  const sentiment = sentimentConfig[enrichment.sentiment]
  const priority = priorityConfig[enrichment.priority]

  return (
    <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm">AI Analysis</h4>
      </div>

      <div className="space-y-4">
        {/* Intent */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Detected Intent</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{enrichment.intent}</span>
            <span className="text-xs text-muted-foreground">
              {Math.round(enrichment.intentConfidence * 100)}% confident
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${enrichment.intentConfidence * 100}%` }}
            />
          </div>
        </div>

        {/* Sentiment & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className={cn("rounded-lg p-3", sentiment.bgColor)}>
            <div className="flex items-center gap-1.5 mb-1">
              {sentiment.icon}
              <p className="text-xs font-medium">Sentiment</p>
            </div>
            <p className={cn("text-sm font-semibold", sentiment.color)}>
              {sentiment.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enrichment.sentimentScore.toFixed(2)}
            </p>
          </div>

          <div className={cn("rounded-lg p-3", priority.bgColor)}>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-xs font-medium">Priority</p>
            </div>
            <p className={cn("text-sm font-semibold capitalize", priority.color)}>
              {enrichment.priority}
            </p>
          </div>
        </div>

        {/* Key Topics */}
        {enrichment.keyTopics.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Key Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {enrichment.keyTopics.map((topic, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Actions */}
        {enrichment.suggestedActions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Suggested Actions</p>
            <div className="space-y-1.5">
              {enrichment.suggestedActions.map((action, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-xs">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer History */}
        {enrichment.customerHistory && (
          <div className="pt-3 border-t border-primary/20">
            <p className="text-xs text-muted-foreground mb-2">Customer History</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold">
                  {enrichment.customerHistory.totalTickets}
                </p>
                <p className="text-xs text-muted-foreground">Tickets</p>
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {enrichment.customerHistory.avgResolutionTime}
                </p>
                <p className="text-xs text-muted-foreground">Avg Time</p>
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {enrichment.customerHistory.satisfactionScore.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { WebAIEnrichmentCard }
