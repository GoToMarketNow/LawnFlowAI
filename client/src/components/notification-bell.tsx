import { Bell, Check, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@shared/schema";

interface UnreadResponse {
  count: number;
  notifications: Notification[];
}

export function NotificationBell() {
  const { data: unreadData, isLoading } = useQuery<UnreadResponse>({
    queryKey: ["/api/crew-comms/notifications/unread"],
    refetchInterval: 30000,
  });

  const ackMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await apiRequest("POST", `/api/crew-comms/notifications/${notificationId}/ack`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-comms/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crew-comms/notifications"] });
    },
  });

  const markSeenMutation = useMutation({
    mutationFn: async (notificationIds: number[]) => {
      await apiRequest("POST", "/api/crew-comms/notifications/mark-seen", { notificationIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-comms/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crew-comms/notifications"] });
    },
  });

  const count = unreadData?.count || 0;
  const recentNotifications = unreadData?.notifications || [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "JOB_ADDED":
        return "text-green-500";
      case "JOB_CANCELED":
        return "text-red-500";
      case "ACTION_REQUIRED":
        return "text-yellow-500";
      case "EQUIPMENT_ALERT":
        return "text-orange-500";
      default:
        return "text-muted-foreground";
    }
  };

  const handleMarkAllSeen = () => {
    if (recentNotifications.length > 0) {
      markSeenMutation.mutate(recentNotifications.map((n) => n.id));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-notification-count"
            >
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllSeen}
              disabled={markSeenMutation.isPending}
              data-testid="button-mark-all-seen"
            >
              {markSeenMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Mark all read"
              )}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-muted-foreground text-sm">
              <Bell className="h-6 w-6 mb-2 opacity-50" />
              <span>No new notifications</span>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 hover-elevate cursor-pointer"
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                        notification.status === "DELIVERED" || notification.status === "SENT"
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${getNotificationIcon(notification.type)}`}
                        data-testid={`text-notification-title-${notification.id}`}
                      >
                        {notification.title}
                      </p>
                      <p
                        className="text-xs text-muted-foreground line-clamp-2 mt-0.5"
                        data-testid={`text-notification-body-${notification.id}`}
                      >
                        {notification.body}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {notification.status !== "ACKED" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          ackMutation.mutate(notification.id);
                        }}
                        disabled={ackMutation.isPending}
                        data-testid={`button-ack-${notification.id}`}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              window.location.href = "/crew-inbox";
            }}
            data-testid="button-view-all-notifications"
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
