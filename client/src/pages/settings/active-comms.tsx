import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  MessageSquare,
  Phone,
  User,
  Users,
  Truck,
  Briefcase,
  FileText,
  XCircle,
  RefreshCw,
  ChevronRight,
  Frown,
  Meh,
  Smile,
  AlertCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { RoleGate } from "@/components/role-gate";
import { Link } from "wouter";

interface OpsCommsThread {
  id: number;
  audienceType: string;
  audienceName: string;
  phoneE164: string | null;
  urgencyScore: number;
  urgencyReasons: string[] | null;
  status: string;
  slaDeadline: string | null;
  slaTier: string | null;
  sentimentScore: number | null;
  hasNegativeSentiment: boolean;
  lastMessageSnippet: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  relatedLeadId: number | null;
  relatedJobId: number | null;
  relatedQuoteId: number | null;
  pendingActionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface OpsCommsActionItem {
  id: number;
  threadId: number;
  type: string;
  title: string;
  description: string | null;
  state: string;
  priority: number;
  assignedToUserId: number | null;
  suggestedByAgent: string | null;
  agentConfidence: number | null;
  agentRationale: string | null;
  dueAt: string | null;
  payloadJson: Record<string, unknown> | null;
  createdAt: string;
}

const audienceTypeConfig: Record<string, { label: string; icon: typeof User; color: string }> = {
  LEAD: { label: "Lead", icon: User, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  CUSTOMER: { label: "Customer", icon: Users, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  CREW: { label: "Crew", icon: Truck, color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
};

const actionTypeLabels: Record<string, string> = {
  SEND_QUOTE: "Send Quote",
  REPLY_NEEDED: "Reply Needed",
  SCHEDULE_VISIT: "Schedule Visit",
  SCHEDULE_REDO: "Schedule Redo",
  FOLLOW_UP: "Follow Up",
  CREW_DISPATCH: "Crew Dispatch",
  CONTACT_CUSTOMER: "Contact Customer",
  APPROVE_QUOTE: "Approve Quote",
};

function getUrgencyTier(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "CRITICAL", color: "bg-destructive text-destructive-foreground" };
  if (score >= 50) return { label: "HIGH", color: "bg-orange-500 text-white dark:bg-orange-600" };
  if (score >= 30) return { label: "MEDIUM", color: "bg-yellow-500 text-black dark:bg-yellow-600" };
  return { label: "LOW", color: "bg-muted text-muted-foreground" };
}

function SlaCountdown({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const isOverdue = deadlineDate < now;
  const timeStr = formatDistanceToNow(deadlineDate, { addSuffix: true });
  
  return (
    <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
      <Clock className="h-3 w-3" />
      <span>{isOverdue ? "Overdue" : "Due"} {timeStr}</span>
    </div>
  );
}

function SentimentIndicator({ score, hasNegative }: { score: number | null; hasNegative: boolean }) {
  if (score === null) return null;
  
  if (hasNegative || score < 30) {
    return (
      <div className="flex items-center gap-1 text-xs text-destructive">
        <Frown className="h-3 w-3" />
        <span>Negative</span>
      </div>
    );
  }
  if (score < 60) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Meh className="h-3 w-3" />
        <span>Neutral</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
      <Smile className="h-3 w-3" />
      <span>Positive</span>
    </div>
  );
}

function ThreadCard({ 
  thread, 
  isSelected, 
  onClick 
}: { 
  thread: OpsCommsThread; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const config = audienceTypeConfig[thread.audienceType] || audienceTypeConfig.CUSTOMER;
  const Icon = config.icon;
  const urgency = getUrgencyTier(thread.urgencyScore);
  
  return (
    <div
      onClick={onClick}
      data-testid={`thread-card-${thread.id}`}
      className={`p-4 border-b cursor-pointer transition-colors hover-elevate ${
        isSelected ? "bg-accent" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant="outline" className={`shrink-0 ${config.color}`}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          <span className="font-medium truncate">{thread.audienceName}</span>
        </div>
        <Badge className={`shrink-0 ${urgency.color}`}>
          {thread.urgencyScore}
        </Badge>
      </div>
      
      {thread.lastMessageSnippet && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
          {thread.lastMessageSnippet}
        </p>
      )}
      
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <SlaCountdown deadline={thread.slaDeadline} />
          <SentimentIndicator score={thread.sentimentScore} hasNegative={thread.hasNegativeSentiment} />
        </div>
        
        <div className="flex items-center gap-2">
          {thread.pendingActionCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {thread.pendingActionCount} action{thread.pendingActionCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {thread.relatedJobId && (
            <Badge variant="outline" className="text-xs">
              <Briefcase className="h-3 w-3 mr-1" />
              Job
            </Badge>
          )}
          {thread.relatedQuoteId && (
            <Badge variant="outline" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Quote
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionItemCard({ 
  item, 
  onComplete, 
  onDismiss,
  isPending,
}: { 
  item: OpsCommsActionItem; 
  onComplete: () => void;
  onDismiss: () => void;
  isPending: boolean;
}) {
  return (
    <Card className="mb-3" data-testid={`action-item-${item.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {actionTypeLabels[item.type] || item.type}
              </Badge>
              {item.priority >= 80 && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <h4 className="font-medium">{item.title}</h4>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
            )}
          </div>
        </div>
        
        {item.suggestedByAgent && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <span>Suggested by {item.suggestedByAgent}</span>
            {item.agentConfidence !== null && (
              <span className="text-muted-foreground">({item.agentConfidence}% confidence)</span>
            )}
          </div>
        )}
        
        {item.dueAt && (
          <div className="text-xs text-muted-foreground mb-3">
            <Clock className="h-3 w-3 inline mr-1" />
            Due {format(new Date(item.dueAt), "MMM d 'at' h:mm a")}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onComplete}
            disabled={isPending}
            data-testid={`button-complete-action-${item.id}`}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDismiss}
            disabled={isPending}
            data-testid={`button-dismiss-action-${item.id}`}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThreadDetailPanel({ 
  thread, 
  actionItems,
  onClose,
  onActionUpdate,
}: { 
  thread: OpsCommsThread;
  actionItems: OpsCommsActionItem[];
  onClose: () => void;
  onActionUpdate: () => void;
}) {
  const { toast } = useToast();
  const config = audienceTypeConfig[thread.audienceType] || audienceTypeConfig.CUSTOMER;
  const Icon = config.icon;
  const urgency = getUrgencyTier(thread.urgencyScore);
  
  const updateActionMutation = useMutation({
    mutationFn: async ({ id, state }: { id: number; state: string }) => {
      const res = await apiRequest("PATCH", `/api/ops/comms/action-items/${id}`, { state });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action updated" });
      onActionUpdate();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-detail">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Badge className={urgency.color}>
          {urgency.label} ({thread.urgencyScore})
        </Badge>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-full ${config.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{thread.audienceName}</h2>
              {thread.phoneE164 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {thread.phoneE164}
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground mb-1">SLA Status</div>
                <SlaCountdown deadline={thread.slaDeadline} />
                {thread.slaTier && (
                  <Badge variant="outline" className="mt-1 text-xs">{thread.slaTier}</Badge>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Sentiment</div>
                <SentimentIndicator score={thread.sentimentScore} hasNegative={thread.hasNegativeSentiment} />
              </CardContent>
            </Card>
          </div>
          
          {thread.urgencyReasons && thread.urgencyReasons.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">Urgency Factors</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ul className="space-y-1">
                  {thread.urgencyReasons.map((reason, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          
          <div className="mb-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Pending Actions ({actionItems.length})
            </h3>
            
            {actionItems.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="No pending actions"
                description="All actions for this thread have been completed"
              />
            ) : (
              actionItems.map((item) => (
                <ActionItemCard
                  key={item.id}
                  item={item}
                  onComplete={() => updateActionMutation.mutate({ id: item.id, state: "DONE" })}
                  onDismiss={() => updateActionMutation.mutate({ id: item.id, state: "DISMISSED" })}
                  isPending={updateActionMutation.isPending}
                />
              ))
            )}
          </div>
          
          {thread.lastMessageSnippet && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">Last Message</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-sm text-muted-foreground">{thread.lastMessageSnippet}</p>
                <div className="text-xs text-muted-foreground mt-2">
                  {thread.lastInboundAt && (
                    <span>Last inbound: {format(new Date(thread.lastInboundAt), "MMM d, h:mm a")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ActiveCommsPage() {
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const { toast } = useToast();
  
  const threadsQuery = useQuery<OpsCommsThread[]>({
    queryKey: ["/api/ops/comms/threads", audienceFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (audienceFilter !== "all") params.set("audienceType", audienceFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("sortBy", "urgency");
      params.set("sortOrder", "desc");
      
      const res = await fetch(`/api/ops/comms/threads?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch threads");
      return res.json();
    },
  });
  
  const selectedThread = threadsQuery.data?.find(t => t.id === selectedThreadId);
  
  const threadDetailQuery = useQuery<{ thread: OpsCommsThread; actionItems: OpsCommsActionItem[] }>({
    queryKey: ["/api/ops/comms/threads", selectedThreadId],
    queryFn: async () => {
      const res = await fetch(`/api/ops/comms/threads/${selectedThreadId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch thread details");
      return res.json();
    },
    enabled: !!selectedThreadId,
  });
  
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/ops/comms/threads"] });
    toast({ title: "Refreshed" });
  };
  
  const criticalCount = threadsQuery.data?.filter(t => t.urgencyScore >= 70).length || 0;
  const highCount = threadsQuery.data?.filter(t => t.urgencyScore >= 50 && t.urgencyScore < 70).length || 0;
  
  return (
    <RoleGate allowedRoles={["OWNER", "ADMIN"]}>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/settings/comms-studio">
              <Button variant="ghost" size="sm" data-testid="link-back-comms-studio">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Comms Studio
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Active Comms</h1>
              <p className="text-sm text-muted-foreground">Operations triage view</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-sm">
                {criticalCount} Critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="text-sm bg-orange-500 text-white">
                {highCount} High
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
        
        <div className="flex-1 flex overflow-hidden">
          <div className={`${selectedThreadId ? "hidden md:flex" : "flex"} flex-col w-full md:w-96 border-r`}>
            <div className="p-3 border-b flex items-center gap-2 flex-wrap">
              <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                <SelectTrigger className="w-32" data-testid="select-audience-filter">
                  <SelectValue placeholder="Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="LEAD">Leads</SelectItem>
                  <SelectItem value="CUSTOMER">Customers</SelectItem>
                  <SelectItem value="CREW">Crew</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="WAITING">Waiting</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <ScrollArea className="flex-1">
              {threadsQuery.isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : threadsQuery.data?.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No threads found"
                  description="No communication threads match your filters"
                />
              ) : (
                threadsQuery.data?.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    isSelected={thread.id === selectedThreadId}
                    onClick={() => setSelectedThreadId(thread.id)}
                  />
                ))
              )}
            </ScrollArea>
          </div>
          
          <div className={`${selectedThreadId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
            {selectedThreadId && threadDetailQuery.data ? (
              <ThreadDetailPanel
                thread={threadDetailQuery.data.thread}
                actionItems={threadDetailQuery.data.actionItems}
                onClose={() => setSelectedThreadId(null)}
                onActionUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/ops/comms/threads"] });
                }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={MessageSquare}
                  title="Select a thread"
                  description="Choose a conversation from the list to view details and actions"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
