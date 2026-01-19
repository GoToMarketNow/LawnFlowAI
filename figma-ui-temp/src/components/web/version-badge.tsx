import * as React from "react"
import { cn } from "../ui/utils"
import { GitBranch, Clock, CheckCircle } from "lucide-react"

export type VersionStatus = "draft" | "pending" | "published" | "archived"

export interface WebVersionBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  version: string
  status: VersionStatus
  showIcon?: boolean
  size?: "sm" | "md" | "lg"
}

const WebVersionBadge = React.forwardRef<HTMLDivElement, WebVersionBadgeProps>(
  ({ className, version, status, showIcon = true, size = "md", ...props }, ref) => {
    const statusConfig = {
      draft: {
        label: "Draft",
        icon: <Clock className="w-3 h-3" />,
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        borderColor: "border-border",
      },
      pending: {
        label: "Pending Review",
        icon: <Clock className="w-3 h-3" />,
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/30",
      },
      published: {
        label: "Published",
        icon: <CheckCircle className="w-3 h-3" />,
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
      },
      archived: {
        label: "Archived",
        icon: <Clock className="w-3 h-3" />,
        color: "text-muted-foreground",
        bgColor: "bg-muted/50",
        borderColor: "border-border",
      },
    }

    const sizeClasses = {
      sm: "text-xs px-2 py-0.5",
      md: "text-sm px-2.5 py-1",
      lg: "text-base px-3 py-1.5",
    }

    const config = statusConfig[status]

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 font-medium rounded-md border",
          config.color,
          config.bgColor,
          config.borderColor,
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {showIcon && config.icon}
        <GitBranch className="w-3 h-3" />
        <span>v{version}</span>
        <span className="opacity-70">•</span>
        <span>{config.label}</span>
      </div>
    )
  }
)
WebVersionBadge.displayName = "WebVersionBadge"

export { WebVersionBadge }
