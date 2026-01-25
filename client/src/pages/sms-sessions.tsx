import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Search,
  ChevronRight,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SmsSession, SmsEvent } from "@shared/schema";

const statusColors: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  handoff: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  abandoned: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
};

const stateLabels: Record<string, { label: string; color: string }> = {
  INTENT: { label: "Intent", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  ADDRESS: { label: "Address", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  ADDRESS_VALIDATE: { label: "Validating Address", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  SERVICES: { label: "Services", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  FREQUENCY: { label: "Frequency", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  PRICE_RANGE: { label: "Pricing", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  SCHEDULING: { label: "Scheduling", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  CONFIRM_BOOKING: { label: "Confirm Booking", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  HUMAN_HANDOFF: { label: "Human Handoff", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  BOOKED: { label: "Booked", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  END: { label: "Completed", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function SessionCard({ 
  session, 
  onView 
}: { 
  session: SmsSession; 
  onView: (session: SmsSession) => void;
}) {
  const createdAt = session.createdAt ? new Date(session.createdAt) : new Date();
  const timeAgo = getTimeAgo(createdAt);
  const stateInfo = stateLabels[session.state] || { label: session.state, color: "bg-muted" };
  const collected = session.collected as Record<string, any> || {};
  const derived = session.derived as Record<string, any> || {};

  return (
    <Card
      className="hover-elevate cursor-pointer transition-all"
      data-testid={`card-sms-session-${session.sessionId}`}
      onClick={() => onView(session)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate">
                  {session.fromPhone}
                </p>
                <Badge variant="outline" className={stateInfo.color}>
                  {stateInfo.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {collected.intent && (
                  <span className="text-xs text-muted-foreground">
                    {collected.intent === "recurring" ? "Ongoing service" : 
                     collected.intent === "one_time" ? "One-time" : collected.intent}
                  </span>
                )}
                {derived.address_one_line && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {derived.address_one_line}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {session.serviceTemplateId || "lawncare_v1"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {timeAgo}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={statusColors[session.status] || statusColors.active}>
              {session.status}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionDetailModal({ 
  session, 
  onClose 
}: { 
  session: SmsSession | null; 
  onClose: () => void;
}) {
  const { data: sessionData, isLoading: eventsLoading } = useQuery<{ session: SmsSession; events: SmsEvent[] }>({
    queryKey: [`/api/sms/sessions/${session?.sessionId}`],
    enabled: !!session?.sessionId,
  });
  const events = sessionData?.events;

  if (!session) return null;

  const collected = session.collected as Record<string, any> || {};
  const derived = session.derived as Record<string, any> || {};
  const quote = session.quote as Record<string, any> || {};
  const scheduling = session.scheduling as Record<string, any> || {};
  const handoff = session.handoff as Record<string, any> || {};

  return (
    <Dialog open={!!session} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {session.fromPhone}
          </DialogTitle>
          <DialogDescription>
            Session ID: {session.sessionId}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Status</h4>
                  <Badge variant="outline" className={statusColors[session.status] || ""}>
                    {session.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Current State</h4>
                  <Badge variant="outline" className={stateLabels[session.state]?.color || ""}>
                    {stateLabels[session.state]?.label || session.state}
                  </Badge>
                </div>
              </div>

              {Object.keys(collected).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Collected Info</h4>
                  <div className="bg-muted/50 rounded-md p-3">
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(collected).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-muted-foreground text-xs">{key}</dt>
                          <dd className="font-medium">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}

              {Object.keys(derived).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Derived Data</h4>
                  <div className="bg-muted/50 rounded-md p-3">
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {derived.address_one_line && (
                        <div className="col-span-2">
                          <dt className="text-muted-foreground text-xs">Address</dt>
                          <dd className="font-medium">{derived.address_one_line}</dd>
                        </div>
                      )}
                      {derived.arcgis?.estimated_lot_acres && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Lot Size</dt>
                          <dd className="font-medium">{derived.arcgis.estimated_lot_acres.toFixed(2)} acres</dd>
                        </div>
                      )}
                      {derived.address_confidence && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Confidence</dt>
                          <dd className="font-medium">{(derived.address_confidence * 100).toFixed(0)}%</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              )}

              {Object.keys(quote).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Quote</h4>
                  <div className="bg-muted/50 rounded-md p-3">
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {quote.price_range && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Price Range</dt>
                          <dd className="font-medium">{quote.price_range}</dd>
                        </div>
                      )}
                      {quote.services && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Services</dt>
                          <dd className="font-medium">{quote.services.join(", ")}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              )}

              {Object.keys(scheduling).length > 0 && scheduling.selected_slot && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Scheduling</h4>
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-sm font-medium">{scheduling.selected_slot}</p>
                  </div>
                </div>
              )}

              {Object.keys(handoff).length > 0 && handoff.triggered && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    Handoff Triggered
                  </h4>
                  <div className="bg-yellow-500/10 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                    <p className="text-sm">{handoff.reason || "Manual escalation"}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Message History</h4>
                {eventsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : events && events.length > 0 ? (
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div 
                        key={event.id} 
                        className={`p-3 rounded-md text-sm ${
                          event.direction === "inbound" 
                            ? "bg-muted/50 mr-8" 
                            : "bg-primary/10 ml-8"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {event.direction === "inbound" ? "Customer" : "LawnFlow"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {event.stateBefore && event.stateAfter && event.stateBefore !== event.stateAfter && (
                              <span className="mr-2">
                                {event.stateBefore} → {event.stateAfter}
                              </span>
                            )}
                            {event.createdAt ? getTimeAgo(new Date(event.createdAt)) : ""}
                          </span>
                        </div>
                        <p>{event.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SmsSessionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<SmsSession | null>(null);

  const { data: sessions, isLoading, refetch } = useQuery<SmsSession[]>({
    queryKey: ["/api/sms/sessions"],
  });

  const filteredSessions = sessions?.filter((session) => {
    const matchesSearch =
      !searchQuery ||
      session.fromPhone.includes(searchQuery) ||
      session.sessionId?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || session.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: sessions?.length || 0,
    active: sessions?.filter(s => s.status === "active").length || 0,
    completed: sessions?.filter(s => s.status === "completed").length || 0,
    handoff: sessions?.filter(s => s.status === "handoff").length || 0,
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-sms-sessions">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">SMS Sessions</h1>
          <p className="text-muted-foreground mt-1">
            View and manage AI-powered SMS lead conversations
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh-sessions">
          <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Handoffs</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.handoff}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg font-medium">All Sessions</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone or session ID..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-sessions"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="handoff">Handoff</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredSessions && filteredSessions.length > 0 ? (
            <div className="space-y-3">
              {filteredSessions.map((session) => (
                <SessionCard 
                  key={session.id} 
                  session={session} 
                  onView={setSelectedSession}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No SMS Sessions</h3>
              <p className="text-muted-foreground mt-1">
                {sessions?.length === 0
                  ? "Send a test SMS or wait for inbound messages"
                  : "No sessions match your search criteria"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <SessionDetailModal 
        session={selectedSession} 
        onClose={() => setSelectedSession(null)} 
      />
    </div>
  );
}
