import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Users,
  AlertTriangle,
  MessageSquare,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import {
  inboxTaskTypes,
  slaLevels,
  getSLALevel,
  formatTimeRemaining,
  type InboxTaskType,
  type SLALevel,
} from "@/lib/ui/tokens";

interface PendingAction {
  id: number;
  type: string;
  stage: string;
  description: string;
  context: any;
  createdAt: string;
  conversationId?: number;
  jobRequestId?: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Users,
  AlertTriangle,
  MessageSquare,
  AlertCircle,
};

function getTaskType(action: PendingAction): InboxTaskType {
  const stage = action.stage?.toLowerCase() || "";
  const type = action.type?.toLowerCase() || "";
  
  if (stage.includes("quote") || type.includes("quote")) return "quote_approval";
  if (stage.includes("crew") || type.includes("assignment")) return "crew_assignment";
  if (type.includes("low_confidence") || type.includes("confidence")) return "low_confidence";
  if (type.includes("reply") || type.includes("message")) return "customer_reply";
  if (type.includes("error") || type.includes("integration")) return "integration_error";
  
  return "quote_approval";
}

function getSLADueDate(createdAt: string): Date {
  const created = new Date(createdAt);
  return new Date(created.getTime() + 2 * 60 * 60 * 1000);
}

function TaskCard({ action, onApprove, onReject, isPending }: {
  action: PendingAction;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}) {
  const taskType = getTaskType(action);
  const taskConfig = inboxTaskTypes[taskType];
  const Icon = iconMap[taskConfig.icon] || FileText;
  const dueDate = getSLADueDate(action.createdAt);
  const slaLevel = getSLALevel(dueDate);
  const slaConfig = slaLevels[slaLevel];

  return (
    <Card className="hover-elevate" data-testid={`task-card-${action.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-md ${slaConfig.bgColor}`}>
            <Icon className={`h-5 w-5 ${slaConfig.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{taskConfig.label}</span>
              <Badge variant="outline" className="text-xs">
                {action.stage}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
              {action.description}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className={slaConfig.color}>
                  {formatTimeRemaining(dueDate)}
                </span>
              </div>
              {action.context?.customerName && (
                <span>Customer: {action.context.customerName}</span>
              )}
              {action.context?.amount && (
                <span>${(action.context.amount / 100).toFixed(2)}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              disabled={isPending}
              data-testid={`button-reject-${action.id}`}
            >
              <XCircle className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={onApprove}
              disabled={isPending}
              data-testid={`button-approve-${action.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {taskConfig.primaryAction}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InboxPage() {
  const { toast } = useToast();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");

  const { data, isLoading, error } = useQuery<PendingAction[]>({
    queryKey: ["/api/pending-actions"],
  });

  const approveMutation = useMutation({
    mutationFn: async (actionId: number) => {
      await apiRequest("POST", `/api/pending-actions/${actionId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-actions"] });
      toast({ title: "Action approved", description: "The orchestrator will continue automatically." });
    },
    onError: (error: any) => {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (actionId: number) => {
      await apiRequest("POST", `/api/pending-actions/${actionId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-actions"] });
      toast({ title: "Action rejected" });
    },
    onError: (error: any) => {
      toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
    },
  });

  const actions = Array.isArray(data) ? data.filter(a => a.status === 'pending') : [];
  
  const filteredActions = actions.filter((action) => {
    if (filterType !== "all") {
      const taskType = getTaskType(action);
      if (taskType !== filterType) return false;
    }
    
    if (filterUrgency !== "all") {
      const dueDate = getSLADueDate(action.createdAt);
      const slaLevel = getSLALevel(dueDate);
      if (slaLevel !== filterUrgency) return false;
    }
    
    return true;
  });

  const urgentCount = actions.filter((a) => getSLALevel(getSLADueDate(a.createdAt)) === "urgent").length;
  const warningCount = actions.filter((a) => getSLALevel(getSLADueDate(a.createdAt)) === "warning").length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {actions.length} pending {actions.length === 1 ? "action" : "actions"}
            {urgentCount > 0 && (
              <span className="text-red-600 dark:text-red-400 ml-2">
                ({urgentCount} urgent)
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40" data-testid="select-filter-type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="quote_approval">Quote Approval</SelectItem>
              <SelectItem value="crew_assignment">Crew Assignment</SelectItem>
              <SelectItem value="low_confidence">Low Confidence</SelectItem>
              <SelectItem value="customer_reply">Customer Reply</SelectItem>
              <SelectItem value="integration_error">Integration Error</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterUrgency} onValueChange={setFilterUrgency}>
            <SelectTrigger className="w-32" data-testid="select-filter-urgency">
              <SelectValue placeholder="All urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="warning">Soon</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load inbox</p>
          </CardContent>
        </Card>
      ) : filteredActions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-medium mb-2">All caught up!</h3>
            <p className="text-sm text-muted-foreground">
              {actions.length === 0 
                ? "No pending actions right now. The AI agents are handling everything."
                : "No actions match your filters."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredActions.map((action) => (
            <TaskCard
              key={action.id}
              action={action}
              onApprove={() => approveMutation.mutate(action.id)}
              onReject={() => rejectMutation.mutate(action.id)}
              isPending={approveMutation.isPending || rejectMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
