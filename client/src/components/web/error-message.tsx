import * as React from "react"
import { cn } from "../ui/utils"
import { AlertCircle, AlertTriangle, Info, XCircle } from "lucide-react"
import { WebButton } from "./button"

export type ErrorSeverity = "error" | "warning" | "info"

export interface WebErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  severity?: ErrorSeverity
  title?: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  inline?: boolean
}

const WebErrorMessage = React.forwardRef<HTMLDivElement, WebErrorMessageProps>(
  (
    {
      className,
      severity = "error",
      title,
      message,
      onRetry,
      onDismiss,
      inline = false,
      ...props
    },
    ref
  ) => {
    const config = {
      error: {
        icon: <XCircle className="w-5 h-5" />,
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive/30",
        defaultTitle: "Error",
      },
      warning: {
        icon: <AlertTriangle className="w-5 h-5" />,
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/30",
        defaultTitle: "Warning",
      },
      info: {
        icon: <Info className="w-5 h-5" />,
        color: "text-blue-600",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        defaultTitle: "Information",
      },
    }

    const severityConfig = config[severity]

    if (inline) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex items-start gap-2 text-sm",
            severityConfig.color,
            className
          )}
          {...props}
        >
          {severityConfig.icon}
          <span>{message}</span>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border p-4",
          severityConfig.bgColor,
          severityConfig.borderColor,
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div className={severityConfig.color}>{severityConfig.icon}</div>
          <div className="flex-1 min-w-0">
            <h4 className={cn("font-semibold mb-1", severityConfig.color)}>
              {title || severityConfig.defaultTitle}
            </h4>
            <p className="text-sm text-foreground mb-3">{message}</p>
            {(onRetry || onDismiss) && (
              <div className="flex gap-2">
                {onRetry && (
                  <WebButton variant="secondary" size="sm" onClick={onRetry}>
                    Try Again
                  </WebButton>
                )}
                {onDismiss && (
                  <WebButton variant="ghost" size="sm" onClick={onDismiss}>
                    Dismiss
                  </WebButton>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
)
WebErrorMessage.displayName = "WebErrorMessage"

export { WebErrorMessage }
