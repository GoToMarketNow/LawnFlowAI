import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  CheckCircle, 
  XCircle, 
  Edit, 
  Clock,
  FileText,
  Calendar,
  Users,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ApprovalType = 'QUOTE' | 'SCHEDULE' | 'CREW' | 'ESCALATION';

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  description: string;
  changes: string[];
  reason: string;
  requestedBy: string;
  requestedAt: string;
  dueAt?: string;
  contextJson?: any;
}

const typeLabels: Record<ApprovalType, string> = {
  QUOTE: 'Quote Approval',
  SCHEDULE: 'Schedule Change',
  CREW: 'Crew Reassignment',
  ESCALATION: 'Customer Escalation',
};

const typeIcons: Record<ApprovalType, React.ElementType> = {
  QUOTE: FileText,
  SCHEDULE: Calendar,
  CREW: Users,
  ESCALATION: AlertTriangle,
};

function ApprovalCard({ 
  item, 
  isSelected, 
  onSelect 
}: { 
  item: ApprovalItem; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const Icon = typeIcons[item.type] || FileText;
  const isUrgent = item.dueAt && new Date(item.dueAt) < new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <div
      className={`p-4 rounded-md cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-accent border border-accent-foreground/20' 
          : 'border hover-elevate'
      }`}
      onClick={onSelect}
      data-testid={`approval-item-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
          isUrgent ? 'bg-amber-500/20' : 'bg-muted'
        }`}>
          <Icon className={`h-4 w-4 ${isUrgent ? 'text-amber-600' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">{item.title}</span>
            {isUrgent && (
              <Badge variant="destructive" className="text-xs">Urgent</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{typeLabels[item.type]}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{new Date(item.requestedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalDetail({ 
  item,
  onApprove,
  onReject,
  onEdit,
  isApproving,
  isRejecting,
}: { 
  item: ApprovalItem | null;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onEdit: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Select an approval</h3>
        <p className="text-sm text-muted-foreground">
          Choose an item from the list to review and approve
        </p>
      </div>
    );
  }

  const Icon = typeIcons[item.type] || FileText;

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="text-sm text-muted-foreground">{typeLabels[item.type]}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={onApprove} 
            disabled={isApproving || isRejecting}
            data-testid="button-approve"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {isApproving ? 'Approving...' : 'Approve'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onEdit}
            disabled={isApproving || isRejecting}
            data-testid="button-edit-approve"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit & Approve
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowRejectDialog(true)}
            disabled={isApproving || isRejecting}
            data-testid="button-reject"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Description</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">What Changed</h3>
            <ul className="space-y-1">
              {item.changes.map((change, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Reason for Change</h3>
            <p className="text-sm text-muted-foreground">{item.reason}</p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Requested by: {item.requestedBy}</span>
            <span>On: {new Date(item.requestedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Approval</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                onReject(rejectReason);
                setShowRejectDialog(false);
                setRejectReason("");
              }}
              disabled={!rejectReason.trim() || isRejecting}
              data-testid="button-confirm-reject"
            >
              {isRejecting ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ApprovalsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: approvals, isLoading, error } = useQuery<ApprovalItem[]>({
    queryKey: ["/api/approvals"],
    staleTime: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/approvals/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-actions"] });
      toast({ title: "Approved", description: "The request has been approved." });
      setSelectedId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve request.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest('POST', `/api/approvals/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-actions"] });
      toast({ title: "Rejected", description: "The request has been rejected." });
      setSelectedId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject request.", variant: "destructive" });
    },
  });

  const items = approvals || [];
  const selectedItem = items.find(item => item.id === selectedId) || null;

  if (error) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-medium mb-2">Failed to load approvals</h2>
          <p className="text-sm text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-semibold" data-testid="page-title-approvals">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} pending approvals
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <CheckCircle className="h-8 w-8 text-primary mb-2" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending approvals</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {items.map(item => (
                  <ApprovalCard
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1">
          <ApprovalDetail 
            item={selectedItem}
            onApprove={() => selectedItem && approveMutation.mutate(selectedItem.id)}
            onReject={(reason) => selectedItem && rejectMutation.mutate({ id: selectedItem.id, reason })}
            onEdit={() => {
              toast({ title: "Edit mode", description: "Opening edit dialog..." });
            }}
            isApproving={approveMutation.isPending}
            isRejecting={rejectMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
