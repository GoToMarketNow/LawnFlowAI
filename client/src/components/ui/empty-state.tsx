import { LucideIcon, Inbox, FileText, Calendar, Users } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "default" | "lg";
}

const defaultIcons: Record<string, LucideIcon> = {
  inbox: Inbox,
  quotes: FileText,
  schedule: Calendar,
  customers: Users,
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = "default",
}: EmptyStateProps) {
  const iconSizes = {
    sm: "h-8 w-8",
    default: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const containerPadding = {
    sm: "py-6",
    default: "py-12",
    lg: "py-16",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        containerPadding[size],
        className
      )}
      data-testid="empty-state"
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className={cn("text-muted-foreground", iconSizes[size])} />
      </div>
      <h3 className={cn(
        "font-semibold",
        size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg"
      )}>
        {title}
      </h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-4"
          data-testid="button-empty-action"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { defaultIcons };
