import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  Check, 
  CheckCheck,
  Calendar, 
  AlertTriangle, 
  Truck, 
  MessageCircle, 
  Wrench,
  Loader2,
  Inbox
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { Notification } from "@shared/schema";

const notificationTypeIcons: Record<string, typeof Bell> = {
  DAILY_BRIEFING: Calendar,
  JOB_ADDED: Truck,
  JOB_UPDATED: Truck,
  JOB_CANCELED: AlertTriangle,
  SCOPE_CHANGED: Wrench,
  ETA_CHANGED: Calendar,
  CUSTOMER_NOTE: MessageCircle,
  EQUIPMENT_ALERT: Wrench,
  ACTION_REQUIRED: AlertTriangle,
  CREW_BROADCAST: MessageCircle,
};

const notificationTypeBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  JOB_ADDED: "default",
  JOB_CANCELED: "destructive",
  ACTION_REQUIRED: "destructive",
  EQUIPMENT_ALERT: "secondary",
  DAILY_BRIEFING: "outline",
  JOB_UPDATED: "secondary",
  SCOPE_CHANGED: "secondary",
  ETA_CHANGED: "secondary",
  CUSTOMER_NOTE: "outline",
  CREW_BROADCAST: "outline",
};

function getNotificationTypeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CrewInboxPage() {
  const [selectedTab, setSelectedTab] = useState("unread");

  const { data: allNotifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/crew-comms/notifications"],
  });

  const { data: unreadData } = useQuery<{ count: number }>({
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

  const markAllSeenMutation = useMutation({
    mutationFn: async (notificationIds: number[]) => {
      await apiRequest("POST", "/api/crew-comms/notifications/mark-seen", { notificationIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-comms/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crew-comms/notifications"] });
    },
  });

  const notifications = allNotifications || [];
  const unreadCount = unreadData?.count || 0;

  const unreadNotifications = notifications.filter(
    (n) => n.status !== "ACKED" && n.channel === "IN_APP"
  );
  const allInAppNotifications = notifications.filter((n) => n.channel === "IN_APP");

  const displayedNotifications =
    selectedTab === "unread" ? unreadNotifications : allInAppNotifications;

  const handleMarkAllRead = () => {
    const ids = unreadNotifications.map((n) => n.id);
    if (ids.length > 0) {
      markAllSeenMutation.mutate(ids);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-3">
            <Inbox className="h-6 w-6 text-primary" />
            <div>
              <CardTitle data-testid="text-inbox-title">Notifications</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                  : "All caught up"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllSeenMutation.isPending}
              data-testid="button-mark-all-read"
            >
              {markAllSeenMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              Mark all read
            </Button>
          )}
        </CardHeader>

        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="unread" data-testid="tab-unread">
                Unread
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">
                All
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : displayedNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No notifications</p>
                  <p className="text-sm">
                    {selectedTab === "unread"
                      ? "You're all caught up"
                      : "No notifications yet"}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-2">
                    {displayedNotifications.map((notification) => {
                      const Icon = notificationTypeIcons[notification.type] || Bell;
                      const badgeVariant =
                        notificationTypeBadgeVariants[notification.type] || "secondary";
                      const isUnread = notification.status !== "ACKED";

                      return (
                        <div
                          key={notification.id}
                          className={`p-4 rounded-md border hover-elevate ${
                            isUnread ? "bg-muted/30" : ""
                          }`}
                          data-testid={`notification-row-${notification.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`mt-1 p-2 rounded-md ${
                                isUnread ? "bg-primary/10" : "bg-muted"
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 ${
                                  isUnread ? "text-primary" : "text-muted-foreground"
                                }`}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  className={`font-medium ${
                                    isUnread ? "" : "text-muted-foreground"
                                  }`}
                                  data-testid={`text-notification-title-${notification.id}`}
                                >
                                  {notification.title}
                                </h4>
                                <Badge variant={badgeVariant} className="text-xs">
                                  {getNotificationTypeLabel(notification.type)}
                                </Badge>
                              </div>

                              <p
                                className="text-sm text-muted-foreground mt-1"
                                data-testid={`text-notification-body-${notification.id}`}
                              >
                                {notification.body}
                              </p>

                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>
                                  {formatDistanceToNow(new Date(notification.createdAt), {
                                    addSuffix: true,
                                  })}
                                </span>
                                <span>
                                  {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                                </span>
                                {notification.status === "ACKED" && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <Check className="h-3 w-3" />
                                    Read
                                  </span>
                                )}
                              </div>
                            </div>

                            {isUnread && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => ackMutation.mutate(notification.id)}
                                disabled={ackMutation.isPending}
                                data-testid={`button-ack-${notification.id}`}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Mark read
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
