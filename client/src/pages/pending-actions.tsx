import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Calendar,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingAction } from "@shared/schema";

const actionTypeIcons: Record<string, React.ReactNode> = {
  send_quote: <DollarSign className="h-5 w-5" />,
  schedule_job: <Calendar className="h-5 w-5" />,
  send_sms: <MessageSquare className="h-5 w-5" />,
};

const actionTypeLabels: Record<string, string> = {
  send_quote: "Send Quote",
  schedule_job: "Schedule Job",
  send_sms: "Send SMS",
};

function ActionCard({ action }: { action: PendingAction }) {
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/pending-actions/${action.id}/approve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Action Approved",
        description: "The action has been executed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve action. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/pending-actions/${action.id}/reject`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-actions"] });
      toast({
        title: "Action Rejected",
        description: "The action has been declined.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject action. Please try again.",
        variant: "destructive",
      });
    },
  });

  const payload = action.payload as Record<string, unknown>;
  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Card
      className="border-l-4 border-l-yellow-500"
      data-testid={`card-action-${action.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
              {actionTypeIcons[action.actionType] || <Clock className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-base">
                {actionTypeLabels[action.actionType] || action.actionType}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conversation #{action.conversationId}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-yellow-500/10 text-yellow-600 border-yellow-300 dark:border-yellow-700"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm font-medium mb-2">Proposed Action</p>
          <p className="text-sm text-muted-foreground">{action.description}</p>
        </div>

        {payload && Object.keys(payload).length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-2">Details</p>
            <dl className="text-sm space-y-1">
              {Object.entries(payload).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}:
                  </dt>
                  <dd className="font-medium">
                    {typeof value === "number" && key.includes("price")
                      ? `$${(value / 100).toFixed(2)}`
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">
            Notes (optional)
          </label>
          <Textarea
            placeholder="Add any modifications or notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none"
            rows={2}
            data-testid={`textarea-notes-${action.id}`}
          />
        </div>
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button
          onClick={() => approveMutation.mutate()}
          disabled={isPending}
          className="flex-1"
          data-testid={`button-approve-${action.id}`}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Approve
        </Button>
        <Button
          variant="outline"
          onClick={() => rejectMutation.mutate()}
          disabled={isPending}
          className="flex-1"
          data-testid={`button-reject-${action.id}`}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function PendingActionsPage() {
  const { data: actions, isLoading } = useQuery<PendingAction[]>({
    queryKey: ["/api/pending-actions"],
  });

  const pendingActions = actions?.filter((a) => a.status === "pending") || [];
  const resolvedActions = actions?.filter((a) => a.status !== "pending") || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Pending Actions
        </h1>
        <p className="text-sm text-muted-foreground">
          Review and approve AI-proposed actions
        </p>
      </div>

      {pendingActions.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            You have {pendingActions.length} action{pendingActions.length !== 1 ? "s" : ""}{" "}
            awaiting your approval
          </p>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Awaiting Approval</h2>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
                <CardFooter className="gap-2">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : pendingActions.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {pendingActions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground">
                No actions require your approval right now
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {resolvedActions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-muted-foreground">
            Recently Resolved
          </h2>
          <div className="space-y-2">
            {resolvedActions.slice(0, 5).map((action) => (
              <Card key={action.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                        {actionTypeIcons[action.actionType] || <Clock className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{action.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {action.resolvedAt
                            ? new Date(action.resolvedAt).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={action.status === "approved" ? "default" : "secondary"}
                    >
                      {action.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
