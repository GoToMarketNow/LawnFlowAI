import { useQuery } from "@tanstack/react-query";
import { Phone, MessageSquare, Globe, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const eventTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  missed_call: {
    icon: <Phone className="h-4 w-4" />,
    label: "Missed Call",
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  inbound_sms: {
    icon: <MessageSquare className="h-4 w-4" />,
    label: "Inbound SMS",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  web_lead: {
    icon: <Globe className="h-4 w-4" />,
    label: "Web Lead",
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  pending: {
    icon: <Clock className="h-3 w-3" />,
    color: "text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-600",
  },
  processing: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600",
  },
  completed: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: "text-green-600 dark:text-green-400 border-green-300 dark:border-green-600",
  },
  failed: {
    icon: <XCircle className="h-3 w-3" />,
    color: "text-red-600 dark:text-red-400 border-red-300 dark:border-red-600",
  },
};

function EventCard({ event }: { event: Event }) {
  const typeConfig = eventTypeConfig[event.type] || {
    icon: <MessageSquare className="h-4 w-4" />,
    label: event.type,
    color: "bg-muted",
  };
  const status = statusConfig[event.status] || statusConfig.pending;
  const payload = event.payload as Record<string, unknown>;

  return (
    <div
      className="flex items-start gap-4 p-4 border-b border-border last:border-0"
      data-testid={`event-item-${event.id}`}
    >
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${typeConfig.color}`}>
        {typeConfig.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{typeConfig.label}</span>
          <Badge variant="outline" className={`text-xs ${status.color}`}>
            <span className="flex items-center gap-1">
              {status.icon}
              {event.status}
            </span>
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {payload.phone ? <span>From: {String(payload.phone)} </span> : null}
          {payload.from ? <span>From: {String(payload.from)} </span> : null}
          {payload.body ? <span className="truncate block max-w-md">Message: {String(payload.body)}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {event.createdAt && formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
          {event.conversationId && <span> | Conversation #{event.conversationId}</span>}
        </p>
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 border-b border-border">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-48 mt-2" />
        <Skeleton className="h-3 w-32 mt-2" />
      </div>
    </div>
  );
}

export default function EventsFeed() {
  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    refetchInterval: 5000,
  });

  const eventCounts = {
    total: events?.length || 0,
    pending: events?.filter((e) => e.status === "pending").length || 0,
    processing: events?.filter((e) => e.status === "processing").length || 0,
    completed: events?.filter((e) => e.status === "completed").length || 0,
    failed: events?.filter((e) => e.status === "failed").length || 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Events Feed</h1>
        <p className="text-sm text-muted-foreground">
          Real-time view of all incoming events from missed calls, SMS, and web leads
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="metric-total-events">{eventCounts.total}</div>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600" data-testid="metric-pending-events">{eventCounts.pending}</div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600" data-testid="metric-completed-events">{eventCounts.completed}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600" data-testid="metric-failed-events">{eventCounts.failed}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Event Stream</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div>
              {[1, 2, 3, 4, 5].map((i) => (
                <EventSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <XCircle className="h-10 w-10 mx-auto text-red-500/50 mb-2" />
              <p className="text-sm text-muted-foreground">Failed to load events</p>
            </div>
          ) : events && events.length > 0 ? (
            <div>
              {events
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No events yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the Simulator to generate test events
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
