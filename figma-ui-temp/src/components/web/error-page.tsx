import * as React from "react"
import { cn } from "../ui/utils"
import { WebButton } from "./button"
import { AlertCircle, Home, RefreshCw, Lock, Wifi, ServerCrash } from "lucide-react"

export type ErrorPageType = "404" | "403" | "500" | "offline" | "generic"

export interface WebErrorPageProps {
  type?: ErrorPageType
  title?: string
  message?: string
  onRetry?: () => void
  onGoHome?: () => void
  className?: string
}

const WebErrorPage: React.FC<WebErrorPageProps> = ({
  type = "generic",
  title,
  message,
  onRetry,
  onGoHome,
  className,
}) => {
  const config = {
    "404": {
      icon: <AlertCircle className="w-20 h-20" />,
      defaultTitle: "Page Not Found",
      defaultMessage:
        "Sorry, we couldn't find the page you're looking for. It may have been moved or deleted.",
      showRetry: false,
    },
    "403": {
      icon: <Lock className="w-20 h-20" />,
      defaultTitle: "Access Denied",
      defaultMessage:
        "You don't have permission to access this resource. Please contact your administrator if you believe this is an error.",
      showRetry: false,
    },
    "500": {
      icon: <ServerCrash className="w-20 h-20" />,
      defaultTitle: "Server Error",
      defaultMessage:
        "Something went wrong on our end. Our team has been notified and is working to fix the issue.",
      showRetry: true,
    },
    offline: {
      icon: <Wifi className="w-20 h-20" />,
      defaultTitle: "Connection Lost",
      defaultMessage:
        "Unable to connect to the server. Please check your internet connection and try again.",
      showRetry: true,
    },
    generic: {
      icon: <AlertCircle className="w-20 h-20" />,
      defaultTitle: "Something Went Wrong",
      defaultMessage:
        "An unexpected error occurred. Please try again or contact support if the problem persists.",
      showRetry: true,
    },
  }

  const errorConfig = config[type]

  return (
    <div
      className={cn(
        "min-h-[400px] flex items-center justify-center p-8",
        className
      )}
    >
      <div className="max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            {errorConfig.icon}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">
            {title || errorConfig.defaultTitle}
          </h2>
          <p className="text-muted-foreground">
            {message || errorConfig.defaultMessage}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {(onRetry || errorConfig.showRetry) && (
            <WebButton
              variant="primary"
              onClick={onRetry || (() => window.location.reload())}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </WebButton>
          )}
          {onGoHome && (
            <WebButton variant="secondary" onClick={onGoHome}>
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </WebButton>
          )}
        </div>

        {/* Error Code */}
        {type !== "generic" && type !== "offline" && (
          <p className="text-xs text-muted-foreground font-mono">
            Error Code: {type.toUpperCase()}
          </p>
        )}
      </div>
    </div>
  )
}

export { WebErrorPage }
