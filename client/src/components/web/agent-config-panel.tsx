import * as React from "react"
import { cn } from "../ui/utils"

export interface AgentConfig {
  id: string
  name: string
  description: string
  trigger: {
    type: "schedule" | "event" | "manual"
    value: string
  }
  actions: Array<{
    type: string
    config: Record<string, any>
  }>
  conditions?: Array<{
    field: string
    operator: string
    value: any
  }>
  settings: {
    timeout: number
    retries: number
    priority: "low" | "medium" | "high"
  }
}

export interface WebAgentConfigPanelProps {
  config: AgentConfig
  onEdit?: () => void
}

const WebAgentConfigPanel: React.FC<WebAgentConfigPanelProps> = ({ config, onEdit }) => {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Configuration
          </h4>
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-xs text-primary hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Agent ID</p>
            <p className="font-mono text-sm">{config.id}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Trigger Configuration */}
      <div>
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Trigger
        </h4>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Type</p>
            <span className="text-sm font-medium capitalize">{config.trigger.type}</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Value</p>
            <span className="text-sm font-mono">{config.trigger.value}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div>
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Actions ({config.actions.length})
        </h4>
        <div className="space-y-2">
          {config.actions.map((action, index) => (
            <div key={index} className="bg-muted/50 rounded-lg p-3 border border-border">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center justify-center">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium">{action.type}</p>
                </div>
              </div>
              <div className="pl-7 space-y-1">
                {Object.entries(action.config).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between text-xs">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-mono text-right max-w-[200px] truncate">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conditions */}
      {config.conditions && config.conditions.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
            Conditions
          </h4>
          <div className="space-y-2">
            {config.conditions.map((condition, index) => (
              <div key={index} className="bg-muted/50 rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{condition.field}</span>
                  <span className="text-muted-foreground">{condition.operator}</span>
                  <span className="font-mono text-primary">{String(condition.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      <div>
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Settings
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Timeout</p>
            <p className="text-lg font-semibold">{config.settings.timeout}s</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Retries</p>
            <p className="text-lg font-semibold">{config.settings.retries}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Priority</p>
            <p className="text-lg font-semibold capitalize">{config.settings.priority}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export { WebAgentConfigPanel }
